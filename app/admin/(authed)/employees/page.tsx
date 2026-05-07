import { requireRole } from '@/lib/auth/getCurrentAdmin';
import { createClient } from '@/lib/supabase/server';
import { EmployeesClient } from './EmployeesClient';

export default async function EmployeesPage() {
  await requireRole(['admin']);

  const supabase = await createClient();
  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, name, line_user_id, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        載入員工列表失敗：{error.message}
      </div>
    );
  }

  return <EmployeesClient employees={employees ?? []} />;
}
