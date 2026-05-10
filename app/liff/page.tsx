import { createClient } from '@/lib/supabase/server';
import { IdentitySelector } from './IdentitySelector';

export default async function LiffEntry() {
  const supabase = await createClient();
  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, name')
    .order('name');

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          載入員工列表失敗：{error.message}
        </div>
      </div>
    );
  }

  return <IdentitySelector employees={employees ?? []} />;
}
