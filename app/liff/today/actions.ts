'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getTodayInTaipei } from '@/lib/date';

export interface TodayOrder {
  id: string;
  total_amount: number;
  status: 'submitted' | 'cancelled';
  submitted_at: string;
  editable_until: string;
  kind: 'food' | 'drink';
  vendor_name: string | null;
  session_status: 'open' | 'closed' | 'cancelled';
  session_cancel_reason: string | null;
  items: {
    item_name: string;
    item_price: number;
    quantity: number;
    modified_at: string | null;
    modified_reason: string | null;
    modified_by_name: string | null;
  }[];
}

export interface TodayResult {
  ok: true;
  today: string;
  orders: TodayOrder[];
  totalAmount: number;
}

export interface TodayError {
  ok: false;
  error: string;
}

export async function getTodayOrders(employeeId: string): Promise<TodayResult | TodayError> {
  if (!employeeId) return { ok: false, error: '缺少身份資訊' };

  const supabase = createAdminClient();
  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .maybeSingle();
  if (!emp) return { ok: false, error: '員工不存在' };

  const today = getTodayInTaipei();

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, total_amount, status, submitted_at, editable_until,
      session:daily_sessions ( order_date, kind, status, cancellation_reason, vendor:vendors ( name ) ),
      items:order_items (
        item_name, item_price, quantity,
        modified_at, modified_reason,
        modified_by_admin:admin_users!order_items_modified_by_fkey ( name )
      )
    `)
    .eq('employee_id', employeeId)
    .order('submitted_at', { ascending: false });

  if (error) return { ok: false, error: `查詢失敗：${error.message}` };

  type RawItem = {
    item_name: string;
    item_price: number;
    quantity: number;
    modified_at: string | null;
    modified_reason: string | null;
    modified_by_admin: { name: string } | null;
  };
  type RawOrder = {
    id: string;
    total_amount: number;
    status: 'submitted' | 'cancelled';
    submitted_at: string;
    editable_until: string;
    session: {
      order_date: string;
      kind: 'food' | 'drink';
      status: 'open' | 'closed' | 'cancelled';
      cancellation_reason: string | null;
      vendor: { name: string } | null;
    } | null;
    items: RawItem[];
  };

  const todayOrders: TodayOrder[] = (orders as unknown as RawOrder[] ?? [])
    .filter((o) => o.session?.order_date === today)
    .map((o) => ({
      id:                    o.id,
      total_amount:          o.total_amount,
      status:                o.status,
      submitted_at:          o.submitted_at,
      editable_until:        o.editable_until,
      kind:                  o.session?.kind ?? 'food',
      vendor_name:           o.session?.vendor?.name ?? null,
      session_status:        o.session?.status ?? 'open',
      session_cancel_reason: o.session?.cancellation_reason ?? null,
      items: (o.items ?? []).map((it) => ({
        item_name:        it.item_name,
        item_price:       it.item_price,
        quantity:         it.quantity,
        modified_at:      it.modified_at,
        modified_reason:  it.modified_reason,
        modified_by_name: it.modified_by_admin?.name ?? null,
      })),
    }));

  const totalAmount = todayOrders
    .filter((o) => o.status === 'submitted' && o.session_status !== 'cancelled')
    .reduce((s, o) => s + o.total_amount, 0);

  return { ok: true, today, orders: todayOrders, totalAmount };
}
