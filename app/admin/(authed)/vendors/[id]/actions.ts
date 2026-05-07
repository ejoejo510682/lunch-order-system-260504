'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/getCurrentAdmin';

export interface MenuItemActionState {
  error?: string;
  success?: boolean;
}

function revalidate(vendorId: string) {
  revalidatePath(`/admin/vendors/${vendorId}`);
}

export async function createMenuItem(
  vendorId: string,
  _prev: MenuItemActionState,
  formData: FormData,
): Promise<MenuItemActionState> {
  await requireRole(['admin', 'orderer']);

  const name      = String(formData.get('name')  ?? '').trim();
  const priceStr  = String(formData.get('price') ?? '').trim();
  const price     = parseInt(priceStr, 10);

  if (!name) return { error: '請輸入品名' };
  if (!Number.isFinite(price) || price < 0) return { error: '請輸入有效價格（非負整數）' };

  const supabase = await createClient();

  // 取目前最大 sort_order，新項目放最下面
  const { data: maxRow } = await supabase
    .from('menu_items')
    .select('sort_order')
    .eq('vendor_id', vendorId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase.from('menu_items').insert({
    vendor_id:  vendorId,
    name,
    price,
    sort_order: nextOrder,
  });

  if (error) return { error: `新增失敗：${error.message}` };

  revalidate(vendorId);
  return { success: true };
}

export async function updateMenuItem(
  vendorId: string,
  itemId: string,
  _prev: MenuItemActionState,
  formData: FormData,
): Promise<MenuItemActionState> {
  await requireRole(['admin', 'orderer']);

  const name     = String(formData.get('name')  ?? '').trim();
  const priceStr = String(formData.get('price') ?? '').trim();
  const price    = parseInt(priceStr, 10);

  if (!name) return { error: '請輸入品名' };
  if (!Number.isFinite(price) || price < 0) return { error: '請輸入有效價格（非負整數）' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('menu_items')
    .update({ name, price })
    .eq('id', itemId);

  if (error) return { error: `更新失敗：${error.message}` };

  revalidate(vendorId);
  return { success: true };
}

export async function toggleMenuItemActive(
  vendorId: string,
  itemId: string,
  nextActive: boolean,
) {
  await requireRole(['admin', 'orderer']);

  const supabase = await createClient();
  const { error } = await supabase
    .from('menu_items')
    .update({ is_active: nextActive })
    .eq('id', itemId);

  if (error) throw new Error(`切換狀態失敗：${error.message}`);

  revalidate(vendorId);
}

export async function deleteMenuItem(vendorId: string, itemId: string) {
  await requireRole(['admin', 'orderer']);

  const supabase = await createClient();
  const { error } = await supabase.from('menu_items').delete().eq('id', itemId);

  if (error) throw new Error(`刪除失敗：${error.message}`);

  revalidate(vendorId);
}

export async function moveMenuItem(
  vendorId: string,
  itemId: string,
  direction: 'up' | 'down',
) {
  await requireRole(['admin', 'orderer']);

  const supabase = await createClient();

  const { data: items } = await supabase
    .from('menu_items')
    .select('id, sort_order')
    .eq('vendor_id', vendorId)
    .order('sort_order', { ascending: true });

  if (!items || items.length < 2) return;

  const idx = items.findIndex((it) => it.id === itemId);
  if (idx === -1) return;

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) return;

  const a = items[idx];
  const b = items[swapIdx];

  await supabase.from('menu_items').update({ sort_order: b.sort_order }).eq('id', a.id);
  await supabase.from('menu_items').update({ sort_order: a.sort_order }).eq('id', b.id);

  revalidate(vendorId);
}
