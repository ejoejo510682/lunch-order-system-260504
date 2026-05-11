'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

interface BaseInput {
  orderId: string;
  employeeId: string;
}

export interface CancelOrderResult {
  ok: boolean;
  error?: string;
}

export async function cancelOrder({ orderId, employeeId }: BaseInput): Promise<CancelOrderResult> {
  if (!orderId || !employeeId) return { ok: false, error: '參數缺失' };

  const supabase = createAdminClient();

  // 撈訂單，驗證 employee_id 與 editable_until
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, employee_id, editable_until, status')
    .eq('id', orderId)
    .maybeSingle();

  if (fetchErr || !order) return { ok: false, error: '訂單不存在' };
  if (order.employee_id !== employeeId) return { ok: false, error: '此訂單不屬於你' };
  if (order.status === 'cancelled') return { ok: false, error: '訂單已取消' };
  if (new Date(order.editable_until).getTime() <= Date.now()) {
    return { ok: false, error: '已超過 5 分鐘可修改時限，請聯絡訂餐員' };
  }

  const { error: updateErr } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId);

  if (updateErr) return { ok: false, error: `取消失敗：${updateErr.message}` };

  revalidatePath(`/liff/orders/${orderId}`);
  revalidatePath('/admin');
  return { ok: true };
}

export interface UpdateOrderInput extends BaseInput {
  items: { menuItemId: string; quantity: number; note?: string }[];
}

export interface UpdateOrderResult {
  ok: boolean;
  error?: string;
}

export async function updateOrderItems({
  orderId,
  employeeId,
  items,
}: UpdateOrderInput): Promise<UpdateOrderResult> {
  if (!orderId || !employeeId) return { ok: false, error: '參數缺失' };
  if (!items || items.length === 0) return { ok: false, error: '請至少選擇一個品項' };

  const supabase = createAdminClient();

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, employee_id, editable_until, status, session_id')
    .eq('id', orderId)
    .maybeSingle();

  if (fetchErr || !order) return { ok: false, error: '訂單不存在' };
  if (order.employee_id !== employeeId) return { ok: false, error: '此訂單不屬於你' };
  if (order.status !== 'submitted') return { ok: false, error: '訂單狀態不允許修改' };
  if (new Date(order.editable_until).getTime() <= Date.now()) {
    return { ok: false, error: '已超過 5 分鐘可修改時限，請聯絡訂餐員' };
  }

  // 找出 session vendor，用來驗證 menu_items
  const { data: session } = await supabase
    .from('daily_sessions')
    .select('vendor_id, status')
    .eq('id', order.session_id)
    .single();

  if (!session)              return { ok: false, error: '場次不存在' };
  if (session.status !== 'open') {
    return { ok: false, error: '場次已結單，無法修改訂單' };
  }

  const ids = items.map((i) => i.menuItemId);
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('id, name, price, vendor_id, is_active')
    .in('id', ids);

  if (!menuItems || menuItems.length !== ids.length) {
    return { ok: false, error: '部分品項已下架' };
  }
  for (const m of menuItems) {
    if (m.vendor_id !== session.vendor_id) return { ok: false, error: '品項與場次不符' };
    if (!m.is_active) return { ok: false, error: `「${m.name}」已下架` };
  }

  const priceMap = new Map(menuItems.map((m) => [m.id, m]));
  const newOrderItems = items.map((it) => {
    const m = priceMap.get(it.menuItemId)!;
    const trimmedNote = it.note?.trim() ?? '';
    return {
      order_id:     orderId,
      menu_item_id: m.id,
      item_name:    m.name,
      item_price:   m.price,
      quantity:     it.quantity,
      note:         trimmedNote || null,
    };
  });
  const newTotal = newOrderItems.reduce((s, oi) => s + oi.item_price * oi.quantity, 0);

  // 先刪舊明細，再插新明細
  const { error: deleteErr } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId);
  if (deleteErr) return { ok: false, error: `修改失敗（刪舊）：${deleteErr.message}` };

  const { error: insertErr } = await supabase
    .from('order_items')
    .insert(newOrderItems);
  if (insertErr) return { ok: false, error: `修改失敗（新增）：${insertErr.message}` };

  const { error: updateErr } = await supabase
    .from('orders')
    .update({ total_amount: newTotal })
    .eq('id', orderId);
  if (updateErr) return { ok: false, error: `修改失敗（總額）：${updateErr.message}` };

  revalidatePath(`/liff/orders/${orderId}`);
  revalidatePath('/admin');
  return { ok: true };
}
