'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTodayOrders, type TodayOrder } from './actions';
import { createClient } from '@/lib/supabase/client';

const STORAGE_KEY = 'lunch.identity';

interface SavedIdentity {
  id: string;
  name: string;
}

export function TodayClient({ warning }: { warning: string | null }) {
  const [identity, setIdentity] = useState<SavedIdentity | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<TodayOrder[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [today, setToday] = useState<string>('');

  // 讀身份
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setIdentity(JSON.parse(raw));
    } catch {}
    setIdentityLoaded(true);
  }, []);

  // 拉訂單
  const refetch = async (id: string) => {
    setLoading(true);
    const r = await getTodayOrders(id);
    if (r.ok) {
      setOrders(r.orders);
      setTotalAmount(r.totalAmount);
      setToday(r.today);
      setError(null);
    } else {
      setError(r.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (identityLoaded && identity) {
      refetch(identity.id);
    } else if (identityLoaded && !identity) {
      setLoading(false);
    }
  }, [identityLoaded, identity]);

  // Realtime：訂單有變動就重抓
  useEffect(() => {
    if (!identity) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`liff-today-${identity.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refetch(identity.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        refetch(identity.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_sessions' }, () => {
        refetch(identity.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [identity]);

  if (!identityLoaded || (identity && loading && orders.length === 0)) {
    return <FullScreen>載入中…</FullScreen>;
  }

  if (!identity) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-zinc-500 text-sm mb-4">請先選擇身份</p>
        <Link href="/liff" className="px-5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium">
          回身份選擇
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <Link href="/liff" className="text-xs text-zinc-500 hover:text-zinc-700">
            ← 回首頁
          </Link>
          <h1 className="text-xl font-bold text-zinc-900 mt-2">我的訂單（今日）</h1>
          {today && <p className="text-xs text-zinc-500 mt-1">{today.replaceAll('-', '/')}</p>}
        </div>
        <Link
          href="/liff/history"
          className="text-xs text-zinc-500 hover:text-zinc-700 underline whitespace-nowrap"
        >
          本週
        </Link>
      </header>

      <main className="flex-1 px-5 pb-24 space-y-4">
        {warning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <p className="font-medium mb-0.5">部分訂單未送出</p>
            <p className="text-xs whitespace-pre-line">{warning}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-zinc-900 text-white rounded-2xl px-5 py-4">
          <p className="text-xs opacity-80">{identity.name}　今日累積</p>
          <p className="text-3xl font-bold mt-1">NT$ {totalAmount}</p>
          <p className="text-xs opacity-60 mt-1">
            （已扣除取消的訂單與被取消的場次）
          </p>
        </div>

        {orders.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-sm text-zinc-500 mb-4">今日還沒有訂單</p>
            <Link
              href="/liff/menu"
              className="inline-block px-5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium"
            >
              去點餐
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </ul>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto p-3">
          <button
            type="button"
            onClick={() => (window.location.href = '/liff/menu')}
            className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold transition shadow-lg"
          >
            繼續點餐 / 再下一單
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: TodayOrder }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const editableMs = Math.max(0, new Date(order.editable_until).getTime() - now);
  const sessionOpen = order.session_status === 'open';
  const isEditable = editableMs > 0 && order.status === 'submitted' && sessionOpen;

  const min = Math.floor(editableMs / 60000);
  const sec = Math.floor((editableMs % 60000) / 1000);

  const kindEmoji = order.kind === 'food' ? '🍱' : '🥤';
  const time = formatTime(order.submitted_at);

  let statusBadge: React.ReactNode = null;
  if (order.status === 'cancelled') {
    statusBadge = <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">已取消</span>;
  } else if (order.session_status === 'cancelled') {
    statusBadge = <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">場次取消</span>;
  } else if (order.session_status === 'closed') {
    statusBadge = <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">已結單</span>;
  } else if (isEditable) {
    statusBadge = <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">可修改</span>;
  } else {
    statusBadge = <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">已送出</span>;
  }

  // 找出最後一個被修改的品項（取最新的 modified_at），顯示原因
  const modifiedItem = [...order.items]
    .filter((it) => it.modified_at !== null)
    .sort((a, b) => (b.modified_at ?? '').localeCompare(a.modified_at ?? ''))[0];
  const isModified = !!modifiedItem;

  return (
    <li className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-900">
          {kindEmoji} {order.vendor_name ?? '—'}
        </span>
        <div className="flex items-center gap-1">
          {isModified && order.status !== 'cancelled' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">已調整</span>
          )}
          {statusBadge}
        </div>
      </div>

      {order.session_status === 'cancelled' && order.session_cancel_reason && (
        <div className="px-4 py-2 bg-red-50 text-xs text-red-700 border-b border-red-100">
          場次取消原因：{order.session_cancel_reason}
        </div>
      )}

      {isModified && modifiedItem && order.status !== 'cancelled' && (
        <div className="px-4 py-2 bg-amber-50 text-xs text-amber-800 border-b border-amber-100">
          <p>
            <span className="font-medium">已由</span>
            {modifiedItem.modified_by_name && ` ${modifiedItem.modified_by_name} `}
            <span className="font-medium">調整</span>
            ：{modifiedItem.modified_reason ?? '（未填原因）'}
          </p>
        </div>
      )}

      <ul className="divide-y divide-zinc-100">
        {order.items.map((it, i) => (
          <li key={i} className="px-4 py-2.5 text-sm">
            <div className="flex items-center">
              <span className="flex-1 truncate text-zinc-700">{it.item_name}</span>
              <span className="text-xs text-zinc-500 mr-3">×{it.quantity}</span>
              <span className="font-medium text-zinc-900">NT$ {it.item_price * it.quantity}</span>
            </div>
            {it.note && (
              <p className="mt-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded inline-block">
                📝 {it.note}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="px-4 py-3 bg-zinc-50 flex items-center justify-between border-t border-zinc-100">
        <span className="text-xs text-zinc-500">送出 {time}</span>
        <span className="text-sm font-bold text-zinc-900">NT$ {order.total_amount}</span>
      </div>

      {isEditable && (
        <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-blue-700">剩餘可修改</p>
            <p className="text-base font-bold text-blue-900 tabular-nums">
              {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/liff/orders/${order.id}`)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
          >
            修改 / 取消
          </button>
        </div>
      )}
    </li>
  );
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
      {children}
    </div>
  );
}
