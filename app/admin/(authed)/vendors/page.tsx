import { requireRole } from '@/lib/auth/getCurrentAdmin';
import { createClient } from '@/lib/supabase/server';
import { VendorsClient } from './VendorsClient';

export default async function VendorsPage() {
  await requireRole(['admin', 'orderer']);

  const supabase = await createClient();
  const { data: vendors, error } = await supabase
    .from('vendors')
    .select('*')
    .order('kind',       { ascending: true })  // 'drink' 排 'food' 之後（字母序），但分組顯示，順序不影響
    .order('is_active',  { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        載入廠商列表失敗：{error.message}
      </div>
    );
  }

  return <VendorsClient vendors={vendors ?? []} />;
}
