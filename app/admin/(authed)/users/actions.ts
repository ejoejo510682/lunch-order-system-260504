'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole, type AdminRole } from '@/lib/auth/getCurrentAdmin';

const PATH = '/admin/users';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function isValidRole(value: string): value is AdminRole {
  return value === 'admin' || value === 'orderer' || value === 'accountant';
}

function parseExpiresAt(value: string): string | null {
  // 接受 'YYYY-MM-DD' 或空字串
  const v = value.trim();
  if (!v) return null;
  // 轉成台北時區的 23:59:59
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error('到期日格式錯誤，應為 YYYY-MM-DD');
  }
  return `${v}T23:59:59+08:00`;
}

// 建立新後台帳號（含 Supabase Auth user + admin_users row）
export async function createAdminUser(input: {
  email: string;
  password: string;
  name: string;
  role: string;
  expiresAtDate: string;  // 'YYYY-MM-DD' 或空字串
}): Promise<ActionResult> {
  await requireRole(['admin']);

  const { email, password, name, role, expiresAtDate } = input;

  if (!email?.trim()) return { ok: false, error: '請填寫 Email' };
  if (!password || password.length < 6) return { ok: false, error: '密碼至少 6 個字元' };
  if (!name?.trim()) return { ok: false, error: '請填寫姓名' };
  if (!isValidRole(role)) return { ok: false, error: '無效的角色' };

  let expiresAt: string | null;
  try {
    expiresAt = parseExpiresAt(expiresAtDate);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '到期日格式錯誤' };
  }

  const sb = createAdminClient();

  // 1. 建立 Supabase Auth user
  const { data: authData, error: authErr } = await sb.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  });
  if (authErr || !authData.user) {
    return { ok: false, error: `建立帳號失敗：${authErr?.message ?? '未知錯誤'}` };
  }

  // 2. INSERT admin_users
  const { error: insertErr } = await sb.from('admin_users').insert({
    id:         authData.user.id,
    email:      email.trim(),
    name:       name.trim(),
    role,
    expires_at: expiresAt,
  });

  if (insertErr) {
    // 補救：把剛建的 auth user 刪掉，避免孤兒
    await sb.auth.admin.deleteUser(authData.user.id);
    return { ok: false, error: `建立帳號失敗：${insertErr.message}` };
  }

  revalidatePath(PATH);
  return { ok: true };
}

// 更新姓名/角色/到期日
export async function updateAdminUser(input: {
  userId: string;
  name: string;
  role: string;
  expiresAtDate: string;
}): Promise<ActionResult> {
  const me = await requireRole(['admin']);
  const { userId, name, role, expiresAtDate } = input;

  if (!userId) return { ok: false, error: '無效的帳號' };
  if (!name?.trim()) return { ok: false, error: '請填寫姓名' };
  if (!isValidRole(role)) return { ok: false, error: '無效的角色' };

  // 不可改自己的 role（避免把自己降級鎖死後台）
  if (userId === me.id && role !== me.role) {
    return { ok: false, error: '不能修改自己的角色' };
  }

  let expiresAt: string | null;
  try {
    expiresAt = parseExpiresAt(expiresAtDate);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '到期日格式錯誤' };
  }

  // 也不可給自己設過期（避免自己鎖死）
  if (userId === me.id && expiresAt && new Date(expiresAt) <= new Date()) {
    return { ok: false, error: '不能把自己的到期日設在過去' };
  }

  const sb = createAdminClient();
  const { error } = await sb
    .from('admin_users')
    .update({ name: name.trim(), role, expires_at: expiresAt })
    .eq('id', userId);

  if (error) return { ok: false, error: `更新失敗：${error.message}` };
  revalidatePath(PATH);
  return { ok: true };
}

// 延期（快捷按鈕：+7 天 / +30 天）
export async function extendAdminUser(input: {
  userId: string;
  days: number;
}): Promise<ActionResult> {
  await requireRole(['admin']);
  const { userId, days } = input;
  if (!userId) return { ok: false, error: '無效的帳號' };
  if (!Number.isInteger(days) || days <= 0) return { ok: false, error: '無效的天數' };

  const sb = createAdminClient();

  const { data: existing } = await sb
    .from('admin_users')
    .select('expires_at')
    .eq('id', userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: '帳號不存在' };

  // 從「目前到期日」或「現在」較大的時間往後加
  const now = new Date();
  const base = existing.expires_at && new Date(existing.expires_at) > now
    ? new Date(existing.expires_at)
    : now;
  const newExpires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const { error } = await sb
    .from('admin_users')
    .update({ expires_at: newExpires.toISOString() })
    .eq('id', userId);
  if (error) return { ok: false, error: `延期失敗：${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}

// 重設密碼
export async function resetAdminPassword(input: {
  userId: string;
  newPassword: string;
}): Promise<ActionResult> {
  await requireRole(['admin']);
  const { userId, newPassword } = input;
  if (!userId) return { ok: false, error: '無效的帳號' };
  if (!newPassword || newPassword.length < 6) return { ok: false, error: '密碼至少 6 個字元' };

  const sb = createAdminClient();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { ok: false, error: `重設密碼失敗：${error.message}` };
  return { ok: true };
}

// 刪除帳號（連同 auth.users 一起刪，admin_users 透過 ON DELETE CASCADE 自動清）
export async function deleteAdminUser(userId: string): Promise<ActionResult> {
  const me = await requireRole(['admin']);
  if (!userId) return { ok: false, error: '無效的帳號' };
  if (userId === me.id) return { ok: false, error: '不能刪除自己的帳號' };

  const sb = createAdminClient();
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: `刪除失敗：${error.message}` };

  revalidatePath(PATH);
  return { ok: true };
}
