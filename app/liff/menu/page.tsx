import { createClient } from '@/lib/supabase/server';
import { getTodayInTaipei } from '@/lib/date';
import { MenuClient, type KindData, type MenuItem } from './MenuClient';

interface SessionRow {
  id: string;
  kind: 'food' | 'drink';
  status: 'open' | 'closed' | 'cancelled';
  vendor_id: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  vendor: {
    id: string;
    name: string;
    phone: string | null;
    menu_image_urls: string[];
  } | null;
}

export default async function MenuPage() {
  const today = getTodayInTaipei();
  const supabase = await createClient();

  const { data: sessionsRaw, error: sessionErr } = await supabase
    .from('daily_sessions')
    .select(`
      id, kind, status, vendor_id,
      cancelled_at, cancellation_reason,
      vendor:vendors ( id, name, phone, menu_image_urls )
    `)
    .eq('order_date', today);

  if (sessionErr) {
    return <ErrorBox message={`載入今日場次失敗：${sessionErr.message}`} />;
  }

  const sessions = (sessionsRaw ?? []) as unknown as SessionRow[];

  // 撈所有 open session 的 vendor 菜單品項
  const openVendorIds = sessions
    .filter((s) => s.status === 'open')
    .map((s) => s.vendor_id);

  let menuItemsByVendor: Record<string, MenuItem[]> = {};
  if (openVendorIds.length > 0) {
    const { data: items, error: itemsErr } = await supabase
      .from('menu_items')
      .select('id, vendor_id, name, price, sort_order')
      .in('vendor_id', openVendorIds)
      .eq('is_active', true)
      .order('sort_order');
    if (itemsErr) {
      return <ErrorBox message={`載入菜單失敗：${itemsErr.message}`} />;
    }
    menuItemsByVendor = (items ?? []).reduce<Record<string, MenuItem[]>>((acc, it) => {
      const list = acc[it.vendor_id] ?? [];
      list.push({ id: it.id, name: it.name, price: it.price });
      acc[it.vendor_id] = list;
      return acc;
    }, {});
  }

  const food  = buildKindData(sessions.find((s) => s.kind === 'food'),  menuItemsByVendor);
  const drink = buildKindData(sessions.find((s) => s.kind === 'drink'), menuItemsByVendor);

  return <MenuClient today={today} food={food} drink={drink} />;
}

function buildKindData(
  session: SessionRow | undefined,
  menuItemsByVendor: Record<string, MenuItem[]>,
): KindData {
  if (!session) return { state: 'none' };
  if (session.status === 'cancelled') {
    return { state: 'cancelled', reason: session.cancellation_reason ?? null };
  }
  if (session.status === 'closed') {
    return { state: 'closed' };
  }
  // status === 'open'
  const vendor = session.vendor ?? {
    id: session.vendor_id,
    name: '（廠商已刪除）',
    phone: null,
    menu_image_urls: [],
  };
  return {
    state: 'open',
    sessionId: session.id,
    vendor,
    items: menuItemsByVendor[session.vendor_id] ?? [],
  };
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
        {message}
      </div>
    </div>
  );
}
