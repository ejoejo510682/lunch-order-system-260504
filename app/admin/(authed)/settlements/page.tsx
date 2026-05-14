import Link from 'next/link';
import { requireRole } from '@/lib/auth/getCurrentAdmin';
import { createClient } from '@/lib/supabase/server';
import { getThisWeekMonFri, getMonFriOfWeekContaining, shiftWeek } from '@/lib/week';
import { SettlementsClient, type EmployeeSettlement, type WeekRange } from './SettlementsClient';

interface Props {
  searchParams: Promise<{ week?: string }>;
}

export default async function SettlementsPage({ searchParams }: Props) {
  await requireRole(['admin', 'orderer']);
  const { week } = await searchParams;

  // 解析 week 參數，預設本週
  let range: WeekRange;
  if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
    range = getMonFriOfWeekContaining(week);
  } else {
    range = getThisWeekMonFri();
  }

  const prev = shiftWeek(range.start, -1);
  const next = shiftWeek(range.start, 1);
  const thisWeek = getThisWeekMonFri().start;
  const isThisWeek = range.start === thisWeek;

  const supabase = await createClient();

  // 撈本週所有 submitted 訂單（含週末，排除取消的場次和取消的訂單）
  // 範圍：本週週一 00:00 ~ 下週週一 00:00（Mon-Sun 全部包含）
  const nextWeekMonday = shiftWeek(range.start, 1);
  const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select(`
      id, employee_id, employee_name, total_amount, status, submitted_at,
      session:daily_sessions ( status, order_date )
    `)
    .gte('submitted_at', `${range.start}T00:00:00+08:00`)
    .lt('submitted_at', `${nextWeekMonday}T00:00:00+08:00`)
    .eq('status', 'submitted');

  if (orderErr) {
    return <ErrorBox message={`載入訂單失敗：${orderErr.message}`} />;
  }

  type RawOrder = {
    employee_id: string | null;
    employee_name: string;
    total_amount: number;
    session: { status: 'open' | 'closed' | 'cancelled' } | null;
  };

  // 依員工聚合，排除取消場次的訂單
  const aggMap = new Map<string, EmployeeSettlement>();
  for (const o of (orders as unknown as RawOrder[]) ?? []) {
    if (o.session?.status === 'cancelled') continue;
    const key = o.employee_id ?? `__deleted__${o.employee_name}`;
    const existing = aggMap.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalAmount += o.total_amount;
    } else {
      aggMap.set(key, {
        employeeId:    o.employee_id,
        employeeName:  o.employee_name,
        orderCount:    1,
        totalAmount:   o.total_amount,
        payment:       null,
      });
    }
  }

  // 撈本週的付款紀錄
  const { data: payments, error: payErr } = await supabase
    .from('weekly_payments')
    .select('id, employee_id, employee_name, amount, paid_at, note, paid_by_admin:admin_users!weekly_payments_paid_by_fkey ( name )')
    .eq('week_start', range.start);

  if (payErr) {
    return <ErrorBox message={`載入付款紀錄失敗：${payErr.message}`} />;
  }

  type RawPayment = {
    id: string;
    employee_id: string | null;
    employee_name: string;
    amount: number;
    paid_at: string;
    note: string | null;
    paid_by_admin: { name: string } | null;
  };

  // 把付款紀錄合進員工資料；如果有付款但沒訂單，也加進列表
  for (const p of (payments as unknown as RawPayment[]) ?? []) {
    const key = p.employee_id ?? `__deleted__${p.employee_name}`;
    const existing = aggMap.get(key);
    const paymentInfo = {
      id:           p.id,
      amount:       p.amount,
      paidAt:       p.paid_at,
      note:         p.note,
      paidByName:   p.paid_by_admin?.name ?? null,
    };
    if (existing) {
      existing.payment = paymentInfo;
    } else {
      aggMap.set(key, {
        employeeId:    p.employee_id,
        employeeName:  p.employee_name,
        orderCount:    0,
        totalAmount:   0,
        payment:       paymentInfo,
      });
    }
  }

  const settlements = Array.from(aggMap.values()).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, 'zh-Hant'),
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">週結勾選</h1>
        <p className="text-sm text-zinc-500 mt-1">
          標記員工是否已付清當週餐費（員工會在 LIFF 看到狀態）
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-3 sm:p-4 flex items-center justify-between gap-2">
        <Link
          href={`/admin/settlements?week=${prev}`}
          className="px-3 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-100 shrink-0"
        >
          ← 上週
        </Link>
        <div className="text-center min-w-0">
          <p className="text-xs text-zinc-500">
            {isThisWeek ? '本週' : range.start === shiftWeek(thisWeek, -1) ? '上週' : ''}
          </p>
          <p className="text-sm sm:text-base font-semibold text-zinc-900">
            {fmt(range.start)} – {fmt(range.end)}
          </p>
        </div>
        <Link
          href={`/admin/settlements?week=${next}`}
          className="px-3 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-100 shrink-0"
        >
          下週 →
        </Link>
      </div>

      {!isThisWeek && (
        <div>
          <Link
            href="/admin/settlements"
            className="inline-block px-3 py-1.5 rounded-lg text-xs text-blue-600 hover:bg-blue-50 border border-blue-200"
          >
            回到本週
          </Link>
        </div>
      )}

      <SettlementsClient settlements={settlements} weekStart={range.start} weekRange={range} />
    </div>
  );
}

function fmt(ymd: string): string {
  return ymd.replaceAll('-', '/');
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
      {message}
    </div>
  );
}
