import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

// 廠商、菜單、員工名單這類資料很少變動，但後台跟 LIFF 幾乎每次點擊/換頁都要重新問一次。
// 這裡快取 60 秒：對訂餐操作來說幾乎不會察覺差異，但能省下大量重複查詢。
// 用 service role 讀，因為 unstable_cache 內部不能碰 cookies，一般的 createClient() 會踩到這個限制；
// 這份資料本來就是公開的參考資料（不因登入者不同而有差異），用 service role 讀沒有安全疑慮。
// 廠商管理頁本身（真正在編輯這些資料的地方）刻意不套用快取，改了要馬上看到自己的結果。

export const getCachedActiveVendors = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('vendors')
      .select('id, name, kind')
      .eq('is_active', true)
      .order('name');
    return data ?? [];
  },
  ['vendors-active'],
  { revalidate: 60 },
);

export const getCachedEmployees = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase.from('employees').select('id, name').order('name');
    return data ?? [];
  },
  ['employees'],
  { revalidate: 60 },
);

export function getCachedActiveMenuItemsForVendor(vendorId: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('menu_items')
        .select('id, vendor_id, name, price, sort_order')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('sort_order');
      return data ?? [];
    },
    ['menu-items', vendorId],
    { revalidate: 60 },
  )();
}

export function getCachedActiveMenuItemsForVendors(vendorIds: string[]) {
  const sortedIds = [...vendorIds].sort();
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('menu_items')
        .select('id, vendor_id, name, price, sort_order')
        .in('vendor_id', sortedIds)
        .eq('is_active', true)
        .order('sort_order');
      return data ?? [];
    },
    ['menu-items', ...sortedIds],
    { revalidate: 60 },
  )();
}
