// 在瀏覽器內壓縮圖片，避免上傳超大照片造成載入緩慢
// 預設：最大寬 1920px、JPEG 品質 80%

export async function compressImage(
  file: File,
  maxWidth = 1920,
  quality = 0.8,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.floor(img.width * scale);
      const h = Math.floor(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('瀏覽器不支援 Canvas'));
        return;
      }

      // 白色底（避免 PNG 透明被當成黑色）
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('圖片壓縮失敗'));
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('讀取圖片失敗'));
    };

    img.src = objectUrl;
  });
}
