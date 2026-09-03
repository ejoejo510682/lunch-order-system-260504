'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getThisWeekMonFri, getMonFriOfWeekContaining, shiftWeek } from '@/lib/week';

export interface WeeklyOrder {
  id: string;
  total_amount: number;
  status: 'submitted' | 'cancelled';
  submitted_at: string;
  order_date: string;
  kind: 'food' | 'drink';
  vendor_name: string | null;
  session_status: 'open' | 'closed' | 'cancelled';
  items: {
    item_name: string;
    item_price: number;
    quantity: number;
    note: string | null;
    modified_at: string | null;
  }[];
  is_modified: boolean;
}

export interface WeeklyPaymentInfo {
  amount: number;
  paidAt: string;
  paidByName: string | null;
}

export interface WeeklyResult {
  ok: true;
  range: { start: string; end: string };
  orders: WeeklyOrder[];
  totalAmount: number;
  payment: WeeklyPaymentInfo | null;
}

export interface WeeklyError {
  ok: false;
  error: string;
}

export async function getWeeklyOrders(employeeId: string): Promise<WeeklyResult | WeeklyError> {
  if (!employeeId) return { ok: false, error: '缺少身份資訊' };

  const supabase = createAdminClient();
  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .maybeSingle();
  if (!emp) return { ok: false, error: '員工不存在' };

  const range = getThisWeekMonFri();
  const nextWeekMonday = shiftWeek(range.start, 1);

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, total_amount, status, submitted_at,
      session:daily_sessions ( order_date, kind, status, vendor:vendors ( name ) ),
      items:order_items ( item_name, item_price, quantity, note, modified_at )
    `)
    .eq('employee_id', employeeId)
    .gte('submitted_at', `${range.start}T00:00:00+08:00`)
    .lt('submitted_at', `${nextWeekMonday}T00:00:00+08:00`)
    .order('submitted_at', { ascending: false });

  if (error) return { ok: false, error: `查詢失敗：${error.message}` };

  type RawItem = { item_name: string; item_price: number; quantity: number; note: string | null; modified_at: string | null };
  type RawOrder = {
    id: string;
    total_amount: number;
    status: 'submitted' | 'cancelled';
    submitted_at: string;
    session: {
      order_date: string;
      kind: 'food' | 'drink';
      status: 'open' | 'closed' | 'cancelled';
      vendor: { name: string } | null;
    } | null;
    items: RawItem[];
  };

  const formatted: WeeklyOrder[] = (orders as unknown as RawOrder[] ?? []).map((o) => ({
    id:             o.id,
    total_amount:   o.total_amount,
    status:         o.status,
    submitted_at:   o.submitted_at,
    order_date:     o.session?.order_date ?? '',
    kind:           o.session?.kind ?? 'food',
    vendor_name:    o.session?.vendor?.name ?? null,
    session_status: o.session?.status ?? 'open',
    items:          o.items ?? [],
    is_modified:    (o.items ?? []).some((it) => it.modified_at !== null),
  }));

  // 累積金額：扣除個人 cancelled 訂單與 cancelled session
  const totalAmount = formatted
    .filter((o) => o.status === 'submitted' && o.session_status !== 'cancelled')
    .reduce((s, o) => s + o.total_amount, 0);

  // 撈本週付款紀錄
  const { data: payment } = await supabase
    .from('weekly_payments')
    .select('amount, paid_at, paid_by_admin:admin_users!weekly_payments_paid_by_fkey ( name )')
    .eq('employee_id', employeeId)
    .eq('week_start', range.start)
    .maybeSingle();

  type RawPayment = {
    amount: number;
    paid_at: string;
    paid_by_admin: { name: string } | null;
  };

  const paymentInfo: WeeklyPaymentInfo | null = payment
    ? {
        amount:     (payment as unknown as RawPayment).amount,
        paidAt:     (payment as unknown as RawPayment).paid_at,
        paidByName: (payment as unknown as RawPayment).paid_by_admin?.name ?? null,
      }
    : null;

  return { ok: true, range, orders: formatted, totalAmount, payment: paymentInfo };
}

export interface UnpaidResult {
  ok: true;
  amount: number;
}

// 未付款金額：只算「已結束的過去週次」（不含本週還在進行中的），
// 依訂單所屬週彙總金額，扣掉已經被訂餐員勾選付清的週次
export async function getUnpaidAmount(employeeId: string): Promise<UnpaidResult | WeeklyError> {
  if (!employeeId) return { ok: false, error: '缺少身份資訊' };

  const supabase = createAdminClient();
  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .maybeSingle();
  if (!emp) return { ok: false, error: '員工不存在' };

  const thisWeekStart = getThisWeekMonFri().start;

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      total_amount, status,
      session:daily_sessions ( order_date, status )
    `)
    .eq('employee_id', employeeId)
    .eq('status', 'submitted')
    .lt('submitted_at', `${thisWeekStart}T00:00:00+08:00`);

  if (error) return { ok: false, error: `查詢失敗：${error.message}` };

  type RawOrder = {
    total_amount: number;
    session: { order_date: string; status: 'open' | 'closed' | 'cancelled' } | null;
  };

  // 依週彙總金額，排除場次已取消的
  const weekTotals = new Map<string, number>();
  for (const o of (orders as unknown as RawOrder[]) ?? []) {
    if (!o.session || o.session.status === 'cancelled') continue;
    const weekStart = getMonFriOfWeekContaining(o.session.order_date).start;
    weekTotals.set(weekStart, (weekTotals.get(weekStart) ?? 0) + o.total_amount);
  }

  if (weekTotals.size === 0) return { ok: true, amount: 0 };

  const { data: payments, error: payErr } = await supabase
    .from('weekly_payments')
    .select('week_start')
    .eq('employee_id', employeeId)
    .in('week_start', Array.from(weekTotals.keys()));

  if (payErr) return { ok: false, error: `查詢付款紀錄失敗：${payErr.message}` };

  const paidWeeks = new Set((payments ?? []).map((p) => p.week_start));

  let unpaid = 0;
  for (const [week, amount] of weekTotals) {
    if (!paidWeeks.has(week)) unpaid += amount;
  }

  return { ok: true, amount: unpaid };
}
