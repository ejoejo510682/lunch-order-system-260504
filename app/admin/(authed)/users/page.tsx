import { requireRole } from '@/lib/auth/getCurrentAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { UsersClient, type AdminUserRow } from './UsersClient';

export default async function AdminUsersPage() {
  const me = await requireRole(['admin']);

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('admin_users')
    .select('id, email, name, role, expires_at')
    .order('name', { ascending: true });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        載入帳號列表失敗：{error.message}
      </div>
    );
  }

  return <UsersClient users={(data ?? []) as AdminUserRow[]} myId={me.id} />;
}
