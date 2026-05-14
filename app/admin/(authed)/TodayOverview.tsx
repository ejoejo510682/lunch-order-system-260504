'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  openSession,
  closeSession,
  cancelSession,
  type SessionActionState,
} from './actions';

// ---------- types ----------

export type Kind = 'food' | 'drink';

export interface VendorOption {
  id: string;
  name: string;
  kind: Kind;
}

export interface SessionRow {
  id: string;
  kind: Kind;
  status: 'open' | 'closed' | 'cancelled';
  order_date: string;
  auto_close_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  vendor: { id: string; name: string; phone: string | null } | null;
}

export interface SessionStats {
  count: number;
  total: number;
}

interface Props {
  today: string;
  sessions: SessionRow[];
  vendors: VendorOption[];
  stats: Record<string, SessionStats>;
  canEdit: boolean;
}

const KIND_LABEL: Record<Kind, { label: string; emoji: string }> = {
  food:  { label: '吃的', emoji: '🍱' },
  drink: { label: '喝的', emoji: '🥤' },
};

// ---------- main component ----------

export function TodayOverview({ today, sessions, vendors, stats, canEdit }: Props) {
  const router = useRouter();
  const food  = sessions.find((s) => s.kind === 'food');
  const drink = sessions.find((s) => s.kind === 'drink');

  const formattedDate = today.replaceAll('-', '/');

  // Realtime：訂單 / 場次有變動就重新載入 server data
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('today-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
        () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' },
        () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_sessions' },
        () => router.refresh())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [router]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">今日總覽</h1>
        <p className="text-sm text-zinc-500 mt-1">{formattedDate}</p>
      </div>

      <SessionCard
        kind="food"
        session={food}
        stats={food ? stats[food.id] : undefined}
        vendors={vendors.filter((v) => v.kind === 'food')}
        canEdit={canEdit}
      />

      <SessionCard
        kind="drink"
        session={drink}
        stats={drink ? stats[drink.id] : undefined}
        vendors={vendors.filter((v) => v.kind === 'drink')}
        canEdit={canEdit}
      />
    </div>
  );
}

// ---------- session card ----------

type DialogState =
  | { mode: 'closed' }
  | { mode: 'open' }
  | { mode: 'cancel' };

function SessionCard({
  kind,
  session,
  stats,
  vendors,
  canEdit,
}: {
  kind: Kind;
  session: SessionRow | undefined;
  stats: SessionStats | undefined;
  vendors: VendorOption[];
  canEdit: boolean;
}) {
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' });
  const [closing, startClosing] = useTransition();
  const closeDialog = () => setDialog({ mode: 'closed' });

  const { label, emoji } = KIND_LABEL[kind];

  const handleClose = () => {
    if (!session) return;
    if (!confirm(`確定要結束「${label}」場次嗎？\n結單後員工就不能再點餐。`)) return;
    startClosing(async () => {
      try {
        await closeSession(session.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <h2 className="text-lg font-semibold text-zinc-900">{label}</h2>
          {session && <StatusBadge status={session.status} />}
        </div>
        {canEdit && session?.status === 'open' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={closing}
              className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white transition disabled:opacity-50"
            >
              {closing ? '結單中...' : '結單'}
            </button>
            <button
              type="button"
              onClick={() => setDialog({ mode: 'cancel' })}
              className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium border border-red-200 text-red-700 hover:bg-red-50 transition"
            >
              取消整場
            </button>
          </div>
        )}
        {canEdit && session?.status === 'closed' && (
          <button
            type="button"
            onClick={() => setDialog({ mode: 'cancel' })}
            className="px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium border border-red-200 text-red-700 hover:bg-red-50 transition"
          >
            取消整場
          </button>
        )}
      </div>

      <div className="px-4 sm:px-6 py-5">
        {!session ? (
          <NoSessionView kind={kind} canEdit={canEdit} hasVendors={vendors.length > 0} onOpen={() => setDialog({ mode: 'open' })} />
        ) : (
          <SessionInfoView session={session} stats={stats} />
        )}
      </div>

      {session && (
        <div className="px-4 sm:px-6 py-3 bg-zinc-50 border-t border-zinc-100">
          <Link
            href={`/admin/sessions/${session.id}`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            查看訂單明細與叫貨單 →
          </Link>
        </div>
      )}

      {dialog.mode === 'open' && (
        <Modal title={`開單：${label}`} onClose={closeDialog}>
          <OpenSessionForm kind={kind} vendors={vendors} onClose={closeDialog} />
        </Modal>
      )}

      {dialog.mode === 'cancel' && session && (
        <Modal title={`取消「${label}」場次`} onClose={closeDialog}>
          <CancelSessionForm sessionId={session.id} kindLabel={label} stats={stats} onClose={closeDialog} />
        </Modal>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SessionRow['status'] }) {
  const cfg: Record<SessionRow['status'], { label: string; cls: string }> = {
    open:      { label: '進行中', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    closed:    { label: '已結單', cls: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
    cancelled: { label: '已取消', cls: 'bg-red-50 text-red-700 border-red-200' },
  };
  const { label, cls } = cfg[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

// ---------- "no session yet" view ----------

function NoSessionView({
  kind,
  canEdit,
  hasVendors,
  onOpen,
}: {
  kind: Kind;
  canEdit: boolean;
  hasVendors: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="text-center py-6">
      <p className="text-sm text-zinc-500 mb-4">今日尚未開單</p>
      {canEdit ? (
        hasVendors ? (
          <button
            type="button"
            onClick={onOpen}
            className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition"
          >
            + 開單
          </button>
        ) : (
          <p className="text-xs text-zinc-400">
            目前沒有「{KIND_LABEL[kind].label}」分類的啟用中廠商，請先到「廠商與菜單」新增
          </p>
        )
      ) : (
        <p className="text-xs text-zinc-400">等待訂餐員開單</p>
      )}
    </div>
  );
}

// ---------- session info view ----------

function SessionInfoView({
  session,
  stats,
}: {
  session: SessionRow;
  stats: SessionStats | undefined;
}) {
  const orderCount = stats?.count ?? 0;
  const total = stats?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <div className="text-base font-medium text-zinc-900">
          {session.vendor?.name ?? <span className="text-zinc-400">廠商已刪除</span>}
        </div>
        {session.vendor?.phone && (
          <div className="text-xs text-zinc-500">{session.vendor.phone}</div>
        )}
      </div>

      {session.status === 'cancelled' && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          <div className="font-medium mb-0.5">取消原因</div>
          <div className="text-red-700">{session.cancellation_reason ?? '（未填寫）'}</div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="訂單筆數" value={`${orderCount} 筆`} />
        <Stat label="總金額" value={`NT$ ${total}`} />
        <Stat
          label={session.status === 'open' ? '自動結單' : session.status === 'closed' ? '結單時間' : '取消時間'}
          value={
            session.status === 'open'
              ? formatTime(session.auto_close_at) ?? '未設定'
              : session.status === 'closed'
              ? formatTime(session.closed_at) ?? '—'
              : formatTime(session.cancelled_at) ?? '—'
          }
        />
      </div>

      {orderCount === 0 && session.status === 'open' && (
        <p className="text-xs text-zinc-400 text-center pt-2">
          尚無員工下單，等員工點餐功能完成（Phase 3）即可看到訂單
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-100">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm font-semibold text-zinc-900 mt-0.5">{value}</div>
    </div>
  );
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

// ---------- open session form ----------

const TIME_OPTIONS: { value: string; label: string }[] = [
  { value: '10:00', label: '10:00' },
  { value: '10:30', label: '10:30' },
  { value: '11:00', label: '11:00' },
  { value: '',      label: '不設定' },
];

const initialState: SessionActionState = {};

function OpenSessionForm({
  kind,
  vendors,
  onClose,
}: {
  kind: Kind;
  vendors: VendorOption[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(openSession, initialState);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />

      <div>
        <label htmlFor="vendor_id" className="block text-sm font-medium text-zinc-700 mb-1">
          廠商 <span className="text-red-500">*</span>
        </label>
        <select
          id="vendor_id"
          name="vendor_id"
          required
          disabled={pending}
          defaultValue=""
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition disabled:bg-zinc-50"
        >
          <option value="" disabled>
            請選擇廠商
          </option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">
          自動結單時間
        </label>
        <div className="grid grid-cols-4 gap-2">
          {TIME_OPTIONS.map((opt) => (
            <label
              key={opt.value || 'none'}
              className="flex items-center justify-center px-3 py-2 rounded-lg border border-zinc-300 cursor-pointer hover:bg-zinc-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400 transition"
            >
              <input
                type="radio"
                name="auto_close"
                value={opt.value}
                required
                disabled={pending}
                defaultChecked={opt.value === ''}
                className="sr-only"
              />
              <span className="text-sm font-medium">{opt.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          設定後系統會在該時間自動結單；選「不設定」需手動結單
        </p>
      </div>

      {state.error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="px-4 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-50"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg text-sm bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition disabled:opacity-50"
        >
          {pending ? '開單中...' : '開單'}
        </button>
      </div>
    </form>
  );
}

// ---------- cancel session form ----------

function CancelSessionForm({
  sessionId,
  kindLabel,
  stats,
  onClose,
}: {
  sessionId: string;
  kindLabel: string;
  stats: SessionStats | undefined;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(cancelSession, initialState);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  const orderCount = stats?.count ?? 0;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="session_id" value={sessionId} />

      <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
        <div className="font-medium">取消整場「{kindLabel}」</div>
        <div className="text-xs mt-1 text-amber-700">
          {orderCount > 0
            ? `共 ${orderCount} 筆訂單會被標記為「人數不足取消」，員工會看到原因`
            : '目前沒有訂單，可放心取消'}
        </div>
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-zinc-700 mb-1">
          取消原因 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          required
          autoFocus
          placeholder="例：人數太少不划算外送"
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition disabled:bg-zinc-50 resize-none"
        />
        <p className="text-xs text-zinc-500 mt-1">
          員工和會計都會看到這個原因，請寫清楚
        </p>
      </div>

      {state.error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="px-4 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-50"
        >
          返回
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white font-medium transition disabled:opacity-50"
        >
          {pending ? '取消中...' : '確定取消整場'}
        </button>
      </div>
    </form>
  );
}

// ---------- modal ----------

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-zinc-900 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
