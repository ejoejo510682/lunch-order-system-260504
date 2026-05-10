'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getThisWeekMonFri, shiftWeek } from '@/lib/week';

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
      items:order_items ( item_name, item_price, quantity, modified_at )
    `)
    .eq('employee_id', employeeId)
    .gte('submitted_at', `${range.start}T00:00:00+08:00`)
    .lt('submitted_at', `${nextWeekMonday}T00:00:00+08:00`)
    .order('submitted_at', { ascending: false });

  if (error) return { ok: false, error: `查詢失敗：${error.message}` };

  type RawItem = { item_name: string; item_price: number; quantity: number; modified_at: string | null };
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
