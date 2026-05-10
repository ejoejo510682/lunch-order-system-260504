import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/getCurrentAdmin';
import { createClient } from '@/lib/supabase/server';
import { SessionDetailClient, type SessionData, type OrderForAdmin, type MenuItemOption } from './SessionDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: Props) {
  await requireRole(['admin', 'orderer']);
  const { id } = await params;

  const supabase = await createClient();

  const { data: sessionRow, error: sessionErr } = await supabase
    .from('daily_sessions')
    .select(`
      id, kind, status, order_date,
      auto_close_at, closed_at,
      cancelled_at, cancellation_reason,
      vendor:vendors ( id, name, phone )
    `)
    .eq('id', id)
    .maybeSingle();

  if (sessionErr || !sessionRow) notFound();

  const session = sessionRow as unknown as SessionData;

  // 撈訂單 + 明細 + 修改人姓名（透過 modified_by 關聯 admin_users）
  const { data: ordersRaw, error: ordersErr } = await supabase
    .from('orders')
    .select(`
      id, employee_id, employee_name, total_amount, status, submitted_at, editable_until,
      items:order_items (
        id, menu_item_id, item_name, item_price, quantity,
        modified_at, modified_reason,
        modified_by_admin:admin_users!order_items_modified_by_fkey ( name )
      )
    `)
    .eq('session_id', id)
    .order('submitted_at', { ascending: true });

  if (ordersErr) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        載入訂單失敗：{ordersErr.message}
      </div>
    );
  }

  const orders = (ordersRaw ?? []) as unknown as OrderForAdmin[];

  // 撈當前廠商的菜單品項，給編輯時用
  let menuItems: MenuItemOption[] = [];
  if (session.vendor) {
    const { data: items } = await supabase
      .from('menu_items')
      .select('id, name, price')
      .eq('vendor_id', session.vendor.id)
      .eq('is_active', true)
      .order('sort_order');
    menuItems = (items ?? []) as MenuItemOption[];
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← 返回今日總覽
        </Link>
      </div>
      <SessionDetailClient session={session} orders={orders} menuItems={menuItems} />
    </div>
  );
}
