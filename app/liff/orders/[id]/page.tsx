import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { OrderClient, type OrderData, type MenuItemOpt } from './OrderClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderPage({ params }: Props) {
  const { id } = await params;

  // 用 service_role 撈訂單，繞過 RLS（員工沒登入）
  // 安全性：UUID 不可猜，且後續編輯/取消 action 會驗證 employee_id 是否符合
  const supabase = createAdminClient();

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id, employee_id, employee_name, total_amount, status,
      submitted_at, editable_until,
      session_id,
      session:daily_sessions (
        id, kind, status, vendor_id,
        vendor:vendors ( id, name, phone )
      ),
      items:order_items (
        id, menu_item_id, item_name, item_price, quantity,
        modified_at, modified_reason,
        modified_by_admin:admin_users!order_items_modified_by_fkey ( name )
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !order) notFound();

  // 為了「修改訂單」功能，撈當下廠商的菜單品項
  const session = (order as unknown as OrderData).session;
  let menuItems: MenuItemOpt[] = [];
  if (session?.vendor) {
    const { data: items } = await supabase
      .from('menu_items')
      .select('id, name, price')
      .eq('vendor_id', session.vendor.id)
      .eq('is_active', true)
      .order('sort_order');
    menuItems = items ?? [];
  }

  return <OrderClient order={order as unknown as OrderData} menuItems={menuItems} />;
}
