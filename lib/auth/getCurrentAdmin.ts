import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AdminRole = 'admin' | 'orderer' | 'accountant';

export interface CurrentAdmin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  expires_at: string | null;
}

// 取目前登入的後台帳號（含 role）。沒登入、不在 admin_users 中、或帳號已過期 → 回傳 null。
// 用 cache() 包住：layout 跟每個 page 都會各自呼叫這個函式，包了之後同一次請求裡
// 不管呼叫幾次都只會真的問 Supabase 一次，不然每次都要多等好幾百毫秒。
// 這裡不先打 getUser() 問「這是誰」，改叫 current_admin_profile()（資料庫函式，靠
// auth.uid() 認人）直接查出自己那一筆，省掉一趟網路來回。
// （原本想直接查 admin_users 靠 RLS 篩，但表上還有一條 admin_read_all policy，
// role=admin 的帳號一查會拿回所有人、不是單一列，所以改用函式明確篩選。）
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const supabase = await createClient();

  const { data } = await supabase.rpc('current_admin_profile');
  const admin = data?.[0] ?? null;

  if (!admin) return null;

  // 帳號過期檢查
  if (admin.expires_at && new Date(admin.expires_at) <= new Date()) {
    // 自動登出
    await supabase.auth.signOut();
    return null;
  }

  return admin as CurrentAdmin;
});

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
