import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // 只有後台頁面會用到 Supabase Auth 的 session；LIFF 員工端第一階段沒有密碼驗證，
  // 完全不需要每次都多花一趟連線去續期一個根本不存在的 session
  matcher: ['/admin/:path*'],
};
