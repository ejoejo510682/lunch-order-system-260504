import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/getCurrentAdmin';
import { createClient } from '@/lib/supabase/server';
import { MenuClient } from './MenuClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VendorMenuPage({ params }: Props) {
  await requireRole(['admin', 'orderer']);
  const { id } = await params;

  const supabase = await createClient();

  const { data: vendor, error: vendorErr } = await supabase
    .from('vendors')
    .select('id, name, kind')
    .eq('id', id)
    .maybeSingle();

  if (vendorErr || !vendor) notFound();

  const { data: items, error: itemsErr } = await supabase
    .from('menu_items')
    .select('id, name, price, is_active, sort_order')
    .eq('vendor_id', id)
    .order('sort_order', { ascending: true });

  if (itemsErr) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        載入菜單失敗：{itemsErr.message}
      </div>
    );
  }

  return <MenuClient vendor={vendor} items={items ?? []} />;
}
