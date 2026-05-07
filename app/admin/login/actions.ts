'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface LoginActionState {
  error?: string;
}

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: '請輸入 email 與密碼' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'Email 或密碼錯誤' };
  }

  // 確認此 email 有對應的 admin_users 紀錄；若沒有，立刻登出並擋下
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    const { data: admin } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!admin) {
      await supabase.auth.signOut();
      return { error: '此帳號尚未授權使用後台，請聯絡管理員' };
    }
  }

  redirect('/admin');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
