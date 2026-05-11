'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

export interface SubmitOrderInput {
  employeeId: string;
  sessionId: string;
  items: { menuItemId: string; quantity: number; note?: string }[];
}

export interface SubmitOrderResult {
  ok: true;
  orderId: string;
}

export interface SubmitOrderError {
  ok: false;
  error: string;
}

const EDITABLE_MINUTES = 5;

export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult | SubmitOrderError> {
  const { employeeId, sessionId, items } = input;

  if (!employeeId) return { ok: false, error: '缺少身份資訊，請重新選擇姓名' };
  if (!sessionId)  return { ok: false, error: '無效的場次' };
  if (!items || items.length === 0) return { ok: false, error: '請至少選擇一個品項' };

  const supabase = createAdminClient();

  // 1. 驗證員工
  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select('id, name')
    .eq('id', employeeId)
    .maybeSingle();

  if (empErr) return { ok: false, error: `員工驗證失敗：${empErr.message}` };
  if (!employee) return { ok: false, error: '員工不存在，請重新選擇姓名' };

  // 2. 驗證場次（必須是 open 才能下單）
  const { data: session, error: sessionErr } = await supabase
    .from('daily_sessions')
    .select('id, vendor_id, status, kind')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionErr) return { ok: false, error: `場次驗證失敗：${sessionErr.message}` };
  if (!session)   return { ok: false, error: '場次不存在' };
  if (session.status !== 'open') {
    return { ok: false, error: '此場次已結單或被取消，無法下單' };
  }

  // 3. 驗證品項
  const menuItemIds = items.map((i) => i.menuItemId);
  const { data: menuItems, error: itemsErr } = await supabase
    .from('menu_items')
    .select('id, name, price, vendor_id, is_active')
    .in('id', menuItemIds);

  if (itemsErr) return { ok: false, error: `品項驗證失敗：${itemsErr.message}` };
  if (!menuItems || menuItems.length !== menuItemIds.length) {
    return { ok: false, error: '部分品項已下架' };
  }
  for (const mi of menuItems) {
    if (mi.vendor_id !== session.vendor_id) {
      return { ok: false, error: '品項與場次廠商不符' };
    }
    if (!mi.is_active) {
      return { ok: false, error: `「${mi.name}」已下架，請移除` };
    }
  }

  // 4. 驗證數量
  for (const it of items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      return { ok: false, error: '數量必須是正整數' };
    }
  }

  // 5. 計算總額（用當下菜單價格做快照）
  const priceMap = new Map(menuItems.map((m) => [m.id, m]));
  const orderItems = items.map((it) => {
    const m = priceMap.get(it.menuItemId)!;
    const trimmedNote = it.note?.trim() ?? '';
    return {
      menu_item_id: m.id,
      item_name:    m.name,
      item_price:   m.price,
      quantity:     it.quantity,
      note:         trimmedNote || null,
    };
  });
  const totalAmount = orderItems.reduce((sum, oi) => sum + oi.item_price * oi.quantity, 0);

  // 6. 寫入 orders + order_items
  const submittedAt = new Date();
  const editableUntil = new Date(submittedAt.getTime() + EDITABLE_MINUTES * 60 * 1000);

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      session_id:     session.id,
      employee_id:    employee.id,
      employee_name:  employee.name,
      total_amount:   totalAmount,
      status:         'submitted',
      submitted_at:   submittedAt.toISOString(),
      editable_until: editableUntil.toISOString(),
    })
    .select('id')
    .single();

  if (orderErr || !order) {
    return { ok: false, error: `下單失敗：${orderErr?.message ?? '未知錯誤'}` };
  }

  const { error: itemsInsertErr } = await supabase
    .from('order_items')
    .insert(orderItems.map((oi) => ({ ...oi, order_id: order.id })));

  if (itemsInsertErr) {
    // 補救：刪除剛插入的 order
    await supabase.from('orders').delete().eq('id', order.id);
    return { ok: false, error: `下單失敗（明細）：${itemsInsertErr.message}` };
  }

  revalidatePath('/admin');
  return { ok: true, orderId: order.id };
}
