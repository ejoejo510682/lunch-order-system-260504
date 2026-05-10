import { requireAdmin } from '@/lib/auth/getCurrentAdmin';
import { createClient } from '@/lib/supabase/server';
import { getTodayInTaipei } from '@/lib/date';
import { TodayOverview, type SessionRow, type VendorOption, type SessionStats } from './TodayOverview';

export default async function AdminHome() {
  const admin = await requireAdmin();
  const today = getTodayInTaipei();
  const supabase = await createClient();

  const [sessionsRes, vendorsRes] = await Promise.all([
    supabase
      .from('daily_sessions')
      .select(`
        id, kind, status, order_date,
        auto_close_at, closed_at,
        cancelled_at, cancellation_reason,
        vendor:vendors ( id, name, phone )
      `)
      .eq('order_date', today),
    supabase
      .from('vendors')
      .select('id, name, kind')
      .eq('is_active', true)
      .order('name'),
  ]);

  if (sessionsRes.error) {
    return <ErrorBox message={`載入今日場次失敗：${sessionsRes.error.message}`} />;
  }
  if (vendorsRes.error) {
    return <ErrorBox message={`載入廠商列表失敗：${vendorsRes.error.message}`} />;
  }

  const sessions = (sessionsRes.data ?? []) as unknown as SessionRow[];

  // 拉每個 session 的訂單統計（人數、總金額）
  const stats: Record<string, SessionStats> = {};
  if (sessions.length > 0) {
    const ids = sessions.map((s) => s.id);
    const { data: orders } = await supabase
      .from('orders')
      .select('session_id, total_amount')
      .in('session_id', ids)
      .eq('status', 'submitted');

    for (const o of orders ?? []) {
      const sid = (o as { session_id: string }).session_id;
      const amt = (o as { total_amount: number }).total_amount;
      if (!stats[sid]) stats[sid] = { count: 0, total: 0 };
      stats[sid].count += 1;
      stats[sid].total += amt;
    }
  }

  const canEdit = admin.role === 'admin' || admin.role === 'orderer';
  const vendors = (vendorsRes.data ?? []) as VendorOption[];

  return (
    <TodayOverview
      today={today}
      sessions={sessions}
      vendors={vendors}
      stats={stats}
      canEdit={canEdit}
    />
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
      {message}
    </div>
  );
}
