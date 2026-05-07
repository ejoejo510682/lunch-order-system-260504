'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/getCurrentAdmin';

export interface EmployeeActionState {
  error?: string;
  success?: boolean;
}

const PATH = '/admin/employees';

export async function createEmployee(
  _prev: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  await requireRole(['admin']);

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: '請輸入員工姓名' };

  const supabase = await createClient();
  const { error } = await supabase.from('employees').insert({ name });

  if (error) return { error: `新增失敗：${error.message}` };

  revalidatePath(PATH);
  return { success: true };
}

export async function updateEmployee(
  id: string,
  _prev: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  await requireRole(['admin']);

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: '請輸入員工姓名' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('employees')
    .update({ name })
    .eq('id', id);

  if (error) return { error: `更新失敗：${error.message}` };

  revalidatePath(PATH);
  return { success: true };
}

export async function deleteEmployee(id: string) {
  await requireRole(['admin']);

  const supabase = await createClient();
  const { error } = await supabase.from('employees').delete().eq('id', id);

  if (error) throw new Error(`刪除失敗：${error.message}`);

  revalidatePath(PATH);
}
