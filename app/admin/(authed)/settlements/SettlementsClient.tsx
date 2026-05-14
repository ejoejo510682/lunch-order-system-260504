'use client';

import { useState, useTransition } from 'react';
import { markPaid, unmarkPaid } from './actions';

export interface PaymentInfo {
  id: string;
  amount: number;
  paidAt: string;
  note: string | null;
  paidByName: string | null;
}

export interface EmployeeSettlement {
  employeeId: string | null;
  employeeName: string;
  orderCount: number;
  totalAmount: number;
  payment: PaymentInfo | null;
}

export interface WeekRange {
  start: string;
  end: string;
}

export function SettlementsClient({
  settlements,
  weekStart,
  weekRange,
}: {
  settlements: EmployeeSettlement[];
  weekStart: string;
  weekRange: WeekRange;
}) {
  if (settlements.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-500">
        <p className="text-sm">本週沒有訂餐紀錄</p>
      </div>
    );
  }

  const total      = settlements.reduce((s, e) => s + e.totalAmount, 0);
  const paidCount  = settlements.filter((e) => e.payment !== null).length;
  const unpaidCount = settlements.length - paidCount;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="人數" value={`${settlements.length} 人`} />
        <Stat label="已付清" value={`${paidCount} 人`} />
        <Stat label="尚未付清" value={`${unpaidCount} 人`} accent={unpaidCount > 0 ? 'amber' : undefined} />
      </div>

      <CopyLineButton settlements={settlements} weekRange={weekRange} />

      {/* 手機版：卡片列表 */}
      <ul className="sm:hidden space-y-2">
        {settlements.map((e) => (
          <SettlementCard
            key={e.employeeId ?? e.employeeName}
            settlement={e}
            weekStart={weekStart}
          />
        ))}
      </ul>

      {/* 桌機版：表格 */}
      <div className="hidden sm:block bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[26%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-4 py-3">姓名</th>
              <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-4 py-3">筆數</th>
              <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-4 py-3">金額</th>
              <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-4 py-3">狀態</th>
              <th className="text-right text-xs font-semibold text-zinc-600 uppercase px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {settlements.map((e) => (
              <SettlementRow
                key={e.employeeId ?? e.employeeName}
                settlement={e}
                weekStart={weekStart}
              />
            ))}
          </tbody>
          <tfoot className="bg-zinc-50 border-t border-zinc-200">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-right text-xs text-zinc-500">合計</td>
              <td className="px-4 py-3 font-bold text-zinc-900">NT$ {total}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function buildLineMessage(
  settlements: EmployeeSettlement[],
  weekRange: WeekRange,
): string {
  const fmt = (ymd: string) => {
    const [, m, d] = ymd.split('-');
    return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
  };
  const lines: string[] = [];
  lines.push(`📅 ${fmt(weekRange.start)}-${fmt(weekRange.end)} 本週餐費結算`);
  lines.push('──────────');
  for (const s of settlements) {
    if (s.totalAmount === 0 && !s.payment) continue;
    const paid = s.payment !== null ? ' ✓ 已付' : '';
    lines.push(`${s.employeeName} NT$ ${s.totalAmount}${paid}`);
  }
  lines.push('──────────');
  lines.push('請週五結束前完成付款，完成後請通知訂餐員（付現、Linepay、轉帳皆可）');
  return lines.join('\n');
}

function fallbackCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {}
  document.body.removeChild(ta);
  return ok;
}

function CopyLineButton({
  settlements,
  weekRange,
}: {
  settlements: EmployeeSettlement[];
  weekRange: WeekRange;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    const text = buildLineMessage(settlements, weekRange);
    let ok = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        ok = fallbackCopy(text);
      }
    } else {
      ok = fallbackCopy(text);
    }
    if (ok) {
      setCopied(true);
      setError(null);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setError('複製失敗，請手動長按下方預覽文字選取');
    }
  };

  const preview = buildLineMessage(settlements, weekRange);

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-zinc-50">
        <div>
          <p className="text-sm font-semibold text-zinc-800">📨 一鍵複製給 LINE 群組</p>
          <p className="text-xs text-zinc-500 mt-0.5">複製後直接貼到群組通知大家付款</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition shrink-0"
        >
          {copied ? '✓ 已複製' : '複製為 LINE 訊息'}
        </button>
      </div>
      {error && (
        <div className="px-4 py-2 bg-red-50 text-sm text-red-700 border-b border-red-100">
          {error}
        </div>
      )}
      <pre className="px-4 sm:px-5 py-3 text-xs text-zinc-700 whitespace-pre-wrap font-sans bg-zinc-50/50 max-h-48 overflow-y-auto">
        {preview}
      </pre>
    </div>
  );
}

function SettlementCard({
  settlement,
  weekStart,
}: {
  settlement: EmployeeSettlement;
  weekStart: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isPaid = settlement.payment !== null;
  const amountMismatch = isPaid && settlement.payment!.amount !== settlement.totalAmount;

  const handleMarkPaid = () => {
    if (!settlement.employeeId) {
      setError('員工已被刪除，無法標記');
      return;
    }
    if (!confirm(`確定標記「${settlement.employeeName}」本週已付清 NT$ ${settlement.totalAmount}？`)) return;
    setError(null);
    startTransition(async () => {
      const r = await markPaid({
        employeeId: settlement.employeeId!,
        weekStart,
        amount: settlement.totalAmount,
      });
      if (!r.ok) setError(r.error ?? '標記失敗');
    });
  };

  const handleUnmark = () => {
    if (!settlement.payment) return;
    if (!confirm(`取消「${settlement.employeeName}」本週的付清標記？`)) return;
    setError(null);
    startTransition(async () => {
      const r = await unmarkPaid(settlement.payment!.id);
      if (!r.ok) setError(r.error ?? '取消失敗');
    });
  };

  return (
    <li className={`bg-white border rounded-xl overflow-hidden ${isPaid ? 'border-green-200' : 'border-zinc-200'}`}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-base font-semibold text-zinc-900">
            {settlement.employeeName}
            {!settlement.employeeId && (
              <span className="ml-1 text-xs text-zinc-400 font-normal">（已刪除）</span>
            )}
          </span>
          <span className="text-base font-bold text-zinc-900 tabular-nums">
            NT$ {settlement.totalAmount}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">{settlement.orderCount} 筆訂單</span>
          {isPaid ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
              ✓ 已付 NT$ {settlement.payment!.amount}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
              ⚠️ 未付清
            </span>
          )}
        </div>
        {amountMismatch && (
          <p className="text-xs text-amber-600 mt-1">
            ⚠️ 已付 NT${settlement.payment!.amount} 與目前 NT${settlement.totalAmount} 不符
          </p>
        )}
      </div>
      <div className="px-4 py-2 border-t border-zinc-100 flex items-center justify-end gap-2 bg-zinc-50">
        {isPaid ? (
          <button
            type="button"
            onClick={handleUnmark}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg text-sm text-zinc-600 hover:bg-zinc-200 font-medium disabled:opacity-50"
          >
            {pending ? '處理中…' : '取消標記'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleMarkPaid}
            disabled={pending || !settlement.employeeId || settlement.totalAmount === 0}
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition disabled:opacity-40"
          >
            {pending ? '標記中…' : '標記已付'}
          </button>
        )}
      </div>
      {error && (
        <div className="px-4 py-2 bg-red-50 text-sm text-red-700 border-t border-red-100">
          {error}
        </div>
      )}
    </li>
  );
}

function SettlementRow({
  settlement,
  weekStart,
}: {
  settlement: EmployeeSettlement;
  weekStart: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleMarkPaid = () => {
    if (!settlement.employeeId) {
      setError('員工已被刪除，無法標記');
      return;
    }
    if (!confirm(`確定標記「${settlement.employeeName}」本週已付清 NT$ ${settlement.totalAmount}？`)) return;
    setError(null);
    startTransition(async () => {
      const r = await markPaid({
        employeeId: settlement.employeeId!,
        weekStart,
        amount: settlement.totalAmount,
      });
      if (!r.ok) setError(r.error ?? '標記失敗');
    });
  };

  const handleUnmark = () => {
    if (!settlement.payment) return;
    if (!confirm(`取消「${settlement.employeeName}」本週的付清標記？`)) return;
    setError(null);
    startTransition(async () => {
      const r = await unmarkPaid(settlement.payment!.id);
      if (!r.ok) setError(r.error ?? '取消失敗');
    });
  };

  const isPaid = settlement.payment !== null;
  const amountMismatch = isPaid && settlement.payment!.amount !== settlement.totalAmount;

  return (
    <>
      <tr>
        <td className="px-4 py-3 text-sm font-medium text-zinc-900 truncate">
          {settlement.employeeName}
          {!settlement.employeeId && (
            <span className="ml-1 text-xs text-zinc-400">（已刪除）</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-zinc-600">
          {settlement.orderCount}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-zinc-900">
          NT$ {settlement.totalAmount}
        </td>
        <td className="px-4 py-3 text-sm">
          {isPaid ? (
            <div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                ✓ 已付 NT$ {settlement.payment!.amount}
              </span>
              <div className="text-xs text-zinc-500 mt-1">
                {settlement.payment!.paidByName ? `${settlement.payment!.paidByName}　` : ''}
                {fmtDateTime(settlement.payment!.paidAt)}
              </div>
              {amountMismatch && (
                <div className="text-xs text-amber-600 mt-1">
                  ⚠️ 已付金額 NT${settlement.payment!.amount} 與目前總額 NT${settlement.totalAmount} 不符
                </div>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              ⚠️ 未付清
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          {isPaid ? (
            <button
              type="button"
              onClick={handleUnmark}
              disabled={pending}
              className="text-sm text-zinc-600 hover:text-zinc-800 font-medium disabled:opacity-50"
            >
              {pending ? '處理中…' : '取消標記'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMarkPaid}
              disabled={pending || !settlement.employeeId || settlement.totalAmount === 0}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition disabled:opacity-50"
            >
              {pending ? '標記中…' : '標記已付'}
            </button>
          )}
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={5} className="px-4 py-2 bg-red-50 text-sm text-red-700">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'amber';
}) {
  const cls = accent === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-white';
  const valueCls = accent === 'amber' ? 'text-amber-800' : 'text-zinc-900';
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${valueCls}`}>{value}</div>
    </div>
  );
}

function fmtDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}
