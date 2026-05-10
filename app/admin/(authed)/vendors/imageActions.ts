'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/getCurrentAdmin';

export interface ImageActionResult {
  ok: boolean;
  error?: string;
  url?: string;
}

const BUCKET = 'menu-images';

export async function uploadVendorImage(
  vendorId: string,
  formData: FormData,
): Promise<ImageActionResult> {
  await requireRole(['admin', 'orderer']);

  if (!vendorId) return { ok: false, error: '無效的廠商' };

  const file = formData.get('file');
  if (!(file instanceof Blob)) return { ok: false, error: '無檔案' };

  const filename = `${vendorId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

  const supabase = await createClient();

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, { contentType: 'image/jpeg' });

  if (uploadErr) return { ok: false, error: `上傳失敗：${uploadErr.message}` };

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  const publicUrl = urlData.publicUrl;

  // 把 URL 加進 vendor.menu_image_urls
  const { data: vendor, error: fetchErr } = await supabase
    .from('vendors')
    .select('menu_image_urls')
    .eq('id', vendorId)
    .single();

  if (fetchErr || !vendor) {
    await supabase.storage.from(BUCKET).remove([filename]);
    return { ok: false, error: '廠商不存在' };
  }

  const newUrls = [...(vendor.menu_image_urls ?? []), publicUrl];
  const { error: updateErr } = await supabase
    .from('vendors')
    .update({ menu_image_urls: newUrls })
    .eq('id', vendorId);

  if (updateErr) {
    await supabase.storage.from(BUCKET).remove([filename]);
    return { ok: false, error: `更新失敗：${updateErr.message}` };
  }

  revalidatePath('/admin/vendors');
  revalidatePath(`/admin/vendors/${vendorId}`);
  return { ok: true, url: publicUrl };
}

export async function deleteVendorImage(
  vendorId: string,
  url: string,
): Promise<ImageActionResult> {
  await requireRole(['admin', 'orderer']);

  if (!vendorId || !url) return { ok: false, error: '參數缺失' };

  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from('vendors')
    .select('menu_image_urls')
    .eq('id', vendorId)
    .single();

  if (!vendor) return { ok: false, error: '廠商不存在' };

  const newUrls = (vendor.menu_image_urls ?? []).filter((u: string) => u !== url);
  const { error: updateErr } = await supabase
    .from('vendors')
    .update({ menu_image_urls: newUrls })
    .eq('id', vendorId);

  if (updateErr) return { ok: false, error: `更新失敗：${updateErr.message}` };

  // 從 URL 抽出 storage path 並刪除（即使刪不掉也沒關係，DB 才是真相）
  const match = url.match(/\/menu-images\/(.+)$/);
  if (match) {
    await supabase.storage.from(BUCKET).remove([match[1]]);
  }

  revalidatePath('/admin/vendors');
  revalidatePath(`/admin/vendors/${vendorId}`);
  return { ok: true };
}
