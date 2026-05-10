'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/getCurrentAdmin';

export interface AdminEditItem {
  menu_item_id: string | null;
  item_name: string;
  item_price: number;
  quantity: number;
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
    .insert(items.map((it) => ({
      order_id:        orderId,
      menu_item_id:    it.menu_item_id,
      item_name:       it.item_name.trim(),
      item_price:      it.item_price,
      quantity:        it.quantity,
      modified_at:     now,
      modified_by:     admin.id,
      modified_reason: reason.trim(),
    })));
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
