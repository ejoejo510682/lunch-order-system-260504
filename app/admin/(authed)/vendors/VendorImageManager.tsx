'use client';

import { useState, useTransition } from 'react';
import { compressImage } from '@/lib/imageCompress';
import { uploadVendorImage, deleteVendorImage } from './imageActions';

export function VendorImageManager({
  vendorId,
  initialUrls,
}: {
  vendorId: string;
  initialUrls: string[];
}) {
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [error, setError] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const uploadOne = async (file: File) => {
    setError(null);
    setUploadingCount((c) => c + 1);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressed);

      const result = await uploadVendorImage(vendorId, formData);
      if (result.ok && result.url) {
        setUrls((prev) => [...prev, result.url!]);
      } else {
        setError(result.error ?? '上傳失敗');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingCount((c) => c - 1);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      void uploadOne(file);
    }
  };

  const handleDelete = (url: string) => {
    if (!confirm('確定要刪除這張圖片？')) return;
    setError(null);
    setDeletingUrl(url);
    startTransition(async () => {
      const result = await deleteVendorImage(vendorId, url);
      if (result.ok) {
        setUrls((prev) => prev.filter((u) => u !== url));
      } else {
        setError(result.error ?? '刪除失敗');
      }
      setDeletingUrl(null);
    });
  };

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-2">
        菜單圖片
      </label>

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {urls.map((url, i) => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`菜單 ${i + 1}`}
                className="w-full h-24 object-cover rounded-lg border border-zinc-200"
              />
              <button
                type="button"
                onClick={() => handleDelete(url)}
                disabled={deletingUrl === url}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center shadow hover:bg-red-700 disabled:opacity-50"
                aria-label="刪除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="inline-block">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileChange}
          disabled={uploadingCount > 0}
          className="hidden"
        />
        <span className={`inline-block px-4 py-2 rounded-lg border border-zinc-300 text-sm cursor-pointer transition ${
          uploadingCount > 0 ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-white hover:bg-zinc-50 text-zinc-700'
        }`}>
          {uploadingCount > 0 ? `上傳中... (${uploadingCount})` : '+ 上傳圖片'}
        </span>
      </label>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      <p className="mt-2 text-xs text-zinc-500">
        可一次選多張。上傳前自動壓縮（最大 1920px / JPEG 80%）。
      </p>
    </div>
  );
}
