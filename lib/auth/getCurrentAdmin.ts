import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AdminRole = 'admin' | 'orderer' | 'accountant';

export interface CurrentAdmin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

// 取目前登入的後台帳號（含 role）。沒登入或不在 admin_users 中 → 回傳 null。
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data: admin } = await supabase
    .from('admin_users')
    .select('id, email, name, role')
    .eq('id', authData.user.id)
    .single();

  if (!admin) return null;
  return admin as CurrentAdmin;
}

// 強制要求登入。沒登入 → 重導到 /admin/login。
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}

// 強制要求特定角色（任一即可）。權限不足 → 重導到後台首頁。
export async function requireRole(roles: AdminRole[]): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (!roles.includes(admin.role)) redirect('/admin');
  return admin;
}
