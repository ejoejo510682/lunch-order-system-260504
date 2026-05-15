'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/getCurrentAdmin';
import { getMonFriOfWeekContaining } from '@/lib/week';

export interface AdminEditItem {
  menu_item_id: string | null;
  item_name: string;
  item_price: number;
  quantity: number;
  note?: string;
}

export interface AdminUpdateOrderResult {
  ok: boolean;
  error?: string;
}

export async function adminUpdateOrder(input: {
  orderId: string;
  items: AdminEditItem[];
  reason: string;
}): Promise<AdminUpdateOrderResult> {
  const admin = await requireRole(['admin', 'orderer']);

  const { orderId, items, reason } = input;

  if (!orderId)            return { ok: false, error: '無效的訂單' };
  if (!reason?.trim())     return { ok: false, error: '修改原因為必填' };
  if (!items || items.length === 0) return { ok: false, error: '至少要保留一個品項，要全刪請取消整筆訂單' };

  // 驗證每個品項
  for (const it of items) {
    if (!it.item_name?.trim()) return { ok: false, error: '每個品項都必須有名稱' };
    if (!Number.isInteger(it.item_price) || it.item_price < 0) {
      return { ok: false, error: `「${it.item_name}」的價格不正確` };
    }
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      return { ok: false, error: `「${it.item_name}」的數量必須為正整數` };
    }
  }

  const supabase = await createClient();

  // 撈訂單與場次狀態
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, session_id, status, session:daily_sessions(status)')
    .eq('id', orderId)
    .maybeSingle();

  if (fetchErr || !order) return { ok: false, error: '訂單不存在' };

  type OrderRaw = { id: string; session_id: string; status: string; session: { status: string } | null };
  const o = order as unknown as OrderRaw;

  if (o.status === 'cancelled') return { ok: false, error: '此訂單已取消，無法編輯' };
  if (o.session?.status === 'cancelled') return { ok: false, error: '此場次已取消，無法編輯訂單' };

  const newTotal = items.reduce((s, it) => s + it.item_price * it.quantity, 0);
  const now = new Date().toISOString();

  // 先刪舊明細
  const { error: deleteErr } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId);
  if (deleteErr) return { ok: false, error: `修改失敗（刪舊）：${deleteErr.message}` };

  // 插新明細，全部標 modified_*
  const { error: insertErr } = await supabase
    .from('order_items')
    .insert(items.map((it) => {
      const trimmedNote = it.note?.trim() ?? '';
      return {
        order_id:        orderId,
        menu_item_id:    it.menu_item_id,
        item_name:       it.item_name.trim(),
        item_price:      it.item_price,
        quantity:        it.quantity,
        note:            trimmedNote || null,
        modified_at:     now,
        modified_by:     admin.id,
        modified_reason: reason.trim(),
      };
    }));
  if (insertErr) return { ok: false, error: `修改失敗（新增）：${insertErr.message}` };

  // 更新總額
  const { error: updateErr } = await supabase
    .from('orders')
    .update({ total_amount: newTotal })
    .eq('id', orderId);
  if (updateErr) return { ok: false, error: `修改失敗（總額）：${updateErr.message}` };

  revalidatePath(`/admin/sessions/${o.session_id}`);
  revalidatePath('/admin');
  return { ok: true };
}

// 批次調整某品項在該場次的價格（含同步更新菜單、取消已付清標記）
export async function bulkUpdateItemPrice(input: {
  sessionId: string;
  itemName: string;
  oldPrice: number;
  newPrice: number;
  reason: string;
  syncMenu: boolean;
}): Promise<{
  ok: boolean;
  error?: string;
  affectedOrders?: number;
  affectedItems?: number;
  unmarkedPayments?: number;
  menuSynced?: boolean;
}> {
  const admin = await requireRole(['admin', 'orderer']);
  const { sessionId, itemName, oldPrice, newPrice, reason, syncMenu } = input;

  if (!sessionId) return { ok: false, error: '無效的場次' };
  if (!itemName?.trim()) return { ok: false, error: '無效的品項名稱' };
  if (!Number.isInteger(newPrice) || newPrice < 0) return { ok: false, error: '新價格必須是非負整數' };
  if (newPrice === oldPrice) return { ok: false, error: '新價格與原價相同，無需修改' };
  if (!reason?.trim()) return { ok: false, error: '修改原因為必填' };

  const sb = createAdminClient();

  // 1. 撈場次資訊
  const { data: session, error: sessErr } = await sb
    .from('daily_sessions')
    .select('id, vendor_id, status, order_date')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessErr || !session) return { ok: false, error: '場次不存在' };
  if (session.status === 'cancelled') return { ok: false, error: '此場次已取消，無法調整價格' };

  // 2. 撈該場次所有 submitted 訂單
  const { data: orders, error: ordersErr } = await sb
    .from('orders')
    .select('id, employee_id')
    .eq('session_id', sessionId)
    .eq('status', 'submitted');
  if (ordersErr) return { ok: false, error: `撈訂單失敗：${ordersErr.message}` };
  if (!orders || orders.length === 0) return { ok: false, error: '此場次沒有有效訂單' };

  const orderIdToEmployee = new Map(orders.map((o) => [o.id, o.employee_id]));
  const orderIds = orders.map((o) => o.id);

  // 3. 找出該品項+原價的 order_items
  const { data: items, error: itemsErr } = await sb
    .from('order_items')
    .select('id, order_id')
    .in('order_id', orderIds)
    .eq('item_name', itemName.trim())
    .eq('item_price', oldPrice);
  if (itemsErr) return { ok: false, error: `撈品項失敗：${itemsErr.message}` };
  if (!items || items.length === 0) return { ok: false, error: '找不到符合「品名 + 原價」的品項' };

  const itemIds = items.map((i) => i.id);
  const affectedOrderIds = Array.from(new Set(items.map((i) => i.order_id)));
  const affectedEmployeeIds = Array.from(
    new Set(affectedOrderIds.map((oid) => orderIdToEmployee.get(oid)).filter((e): e is string => !!e)),
  );

  const now = new Date().toISOString();

  // 4. 更新 order_items 價格 + 修改紀錄
  const { error: updItemsErr } = await sb
    .from('order_items')
    .update({
      item_price: newPrice,
      modified_at: now,
      modified_by: admin.id,
      modified_reason: reason.trim(),
    })
    .in('id', itemIds);
  if (updItemsErr) return { ok: false, error: `更新訂單品項失敗：${updItemsErr.message}` };

  // 5. 重算每筆受影響訂單的總額
  for (const oid of affectedOrderIds) {
    const { data: oitems } = await sb
      .from('order_items')
      .select('item_price, quantity')
      .eq('order_id', oid);
    const total = (oitems ?? []).reduce(
      (s, it) => s + (it.item_price as number) * (it.quantity as number),
      0,
    );
    await sb.from('orders').update({ total_amount: total }).eq('id', oid);
  }

  // 6. 取消受影響員工本週的已付清標記
  let unmarkedCount = 0;
  if (affectedEmployeeIds.length > 0) {
    const weekRange = getMonFriOfWeekContaining(session.order_date);
    const { data: deletedPays, error: delErr } = await sb
      .from('weekly_payments')
      .delete()
      .eq('week_start', weekRange.start)
      .in('employee_id', affectedEmployeeIds)
      .select('id');
    if (!delErr && deletedPays) unmarkedCount = deletedPays.length;
  }

  // 7. 同步菜單（可選）
  let menuSynced = false;
  if (syncMenu) {
    const { error: menuErr } = await sb
      .from('menu_items')
      .update({ price: newPrice })
      .eq('vendor_id', session.vendor_id)
      .eq('name', itemName.trim());
    if (!menuErr) menuSynced = true;
  }

  revalidatePath(`/admin/sessions/${sessionId}`);
  revalidatePath('/admin');
  revalidatePath('/admin/settlements');
  revalidatePath(`/admin/vendors/${session.vendor_id}`);

  return {
    ok: true,
    affectedOrders: affectedOrderIds.length,
    affectedItems: itemIds.length,
    unmarkedPayments: unmarkedCount,
    menuSynced,
  };
}

// 取消整筆訂單（admin/orderer 不受 5 分鐘限制）
export async function adminCancelOrder(orderId: string): Promise<AdminUpdateOrderResult> {
  await requireRole(['admin', 'orderer']);

  if (!orderId) return { ok: false, error: '無效的訂單' };

  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, session_id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: '訂單不存在' };
  if (order.status === 'cancelled') return { ok: false, error: '訂單已取消' };

  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId);

  if (error) return { ok: false, error: `取消失敗：${error.message}` };

  revalidatePath(`/admin/sessions/${order.session_id}`);
  revalidatePath('/admin');
  return { ok: true };
}
