-- =====================================================
-- 訂餐系統 - 廠商菜單圖片 (2026-05-11)
-- =====================================================
-- 1. vendors 加 menu_image_urls 陣列欄位（每家廠商可放多張菜單圖）
-- 2. Supabase Storage bucket: menu-images（公開讀取）
-- 3. Storage RLS：anyone read; admin/orderer 可上傳/刪除
-- =====================================================

-- 1. vendors 加圖片陣列欄位
ALTER TABLE vendors
  ADD COLUMN menu_image_urls text[] NOT NULL DEFAULT '{}';

-- 2. 建立 storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  5242880, -- 5MB per file（壓縮後夠用）
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies

-- 任何人都可讀（含未登入的 LIFF 員工）
CREATE POLICY "menu_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

-- admin/orderer 可上傳
CREATE POLICY "menu_images_admin_orderer_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND public.is_orderer_or_admin()
  );

-- admin/orderer 可刪除
CREATE POLICY "menu_images_admin_orderer_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND public.is_orderer_or_admin()
  );
