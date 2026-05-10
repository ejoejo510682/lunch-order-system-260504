import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Vercel Cron 會在排程時間 GET 這支 API。
// 為了避免被外部隨便呼叫，要求 Authorization: Bearer <CRON_SECRET>。
// （Vercel 會自動帶上 CRON_SECRET 到自己排程的請求；本機測試時請手動帶。）

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET 未設定' }, { status: 500 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: toClose, error: queryErr } = await supabase
    .from('daily_sessions')
    .select('id, kind, vendor_id, auto_close_at')
    .eq('status', 'open')
    .not('auto_close_at', 'is', null)
    .lte('auto_close_at', nowIso);

  if (queryErr) {
    return NextResponse.json({ error: queryErr.message }, { status: 500 });
  }

  if (!toClose || toClose.length === 0) {
    return NextResponse.json({ closed: 0, message: '沒有需要自動結單的場次' });
  }

  const ids = toClose.map((s) => s.id);
  const { error: updateErr } = await supabase
    .from('daily_sessions')
    .update({ status: 'closed', closed_at: nowIso })
    .in('id', ids);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    closed: ids.length,
    sessions: toClose.map((s) => ({ id: s.id, kind: s.kind, auto_close_at: s.auto_close_at })),
  });
}
