'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/getCurrentAdmin';

export interface VendorActionState {
  error?: string;
  success?: boolean;
}

const PATHS_TO_REVALIDATE = ['/admin/vendors'];

function parseKind(formData: FormData): 'food' | 'drink' | null {
  const k = String(formData.get('kind') ?? '');
  return k === 'food' || k === 'drink' ? k : null;
}

export async function createVendor(
  _prev: VendorActionState,
  formData: FormData,
): Promise<VendorActionState> {
  await requireRole(['admin', 'orderer']);

  const name  = String(formData.get('name')  ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const note  = String(formData.get('note')  ?? '').trim();
  const kind  = parseKind(formData);

  if (!name) return { error: '請輸入廠商名稱' };
  if (!kind) return { error: '請選擇分類（吃的 / 喝的）' };

  const supabase = await createClient();
  const { error } = await supabase.from('vendors').insert({
    name,
    kind,
    phone: phone || null,
    note:  note  || null,
  });

  if (error) return { error: `新增失敗：${error.message}` };

  PATHS_TO_REVALIDATE.forEach((p) => revalidatePath(p));
  return { success: true };
}

export async function updateVendor(
  id: string,
  _prev: VendorActionState,
  formData: FormData,
): Promise<VendorActionState> {
  await requireRole(['admin', 'orderer']);

  const name  = String(formData.get('name')  ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const note  = String(formData.get('note')  ?? '').trim();
  const kind  = parseKind(formData);

  if (!name) return { error: '請輸入廠商名稱' };
  if (!kind) return { error: '請選擇分類（吃的 / 喝的）' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('vendors')
    .update({
      name,
      kind,
      phone: phone || null,
      note:  note  || null,
    })
    .eq('id', id);

  if (error) return { error: `更新失敗：${error.message}` };

  PATHS_TO_REVALIDATE.forEach((p) => revalidatePath(p));
  return { success: true };
}

export async function toggleVendorActive(id: string, nextActive: boolean) {
  await requireRole(['admin', 'orderer']);

  const supabase = await createClient();
  const { error } = await supabase
    .from('vendors')
    .update({ is_active: nextActive })
    .eq('id', id);

  if (error) throw new Error(`切換狀態失敗：${error.message}`);

  PATHS_TO_REVALIDATE.forEach((p) => revalidatePath(p));
}

export async function deleteVendor(id: string) {
  await requireRole(['admin', 'orderer']);

  const supabase = await createClient();
  const { error } = await supabase.from('vendors').delete().eq('id', id);

  if (error) {
    // 23503 = foreign_key_violation：有 daily_sessions 卡住
    if (error.code === '23503') {
      throw new Error('這家廠商已有訂餐場次紀錄，無法刪除。請改用「停用」隱藏它。');
    }
    throw new Error(`刪除失敗：${error.message}`);
  }

  PATHS_TO_REVALIDATE.forEach((p) => revalidatePath(p));
}
