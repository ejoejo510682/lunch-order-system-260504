'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getWeeklyOrders, type WeeklyOrder } from './actions';

const STORAGE_KEY = 'lunch.identity';

interface SavedIdentity {
  id: string;
  name: string;
}

export function HistoryClient() {
  const [identity, setIdentity] = useState<SavedIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<WeeklyOrder[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    let id: SavedIdentity | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) id = JSON.parse(raw);
    } catch {}
    setIdentity(id);

    if (!id) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      const r = await getWeeklyOrders(id!.id);
      if (r.ok) {
        setOrders(r.orders);
        setTotalAmount(r.totalAmount);
        setRange(r.range);
      } else {
        setError(r.error);
      }
      setLoading(false);
    })();
  }, []);

  if (!identity) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-zinc-500 text-sm mb-4">請先選擇身份</p>
        <Link
          href="/liff"
          className="px-5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium"
        >
          回身份選擇
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="px-5 pt-6 pb-4">
        <Link href="/liff" className="text-xs text-zinc-500 hover:text-zinc-700">
          ← 回首頁
        </Link>
        <h1 className="text-xl font-bold text-zinc-900 mt-2">本週訂單</h1>
        {range && (
          <p className="text-xs text-zinc-500 mt-1">
            {fmtDate(range.start)} – {fmtDate(range.end)}（週一至週五）
          </p>
        )}
      </header>

      <main className="flex-1 px-5 pb-6 space-y-4">
        <div className="bg-zinc-900 text-white rounded-2xl px-5 py-4">
          <p className="text-xs opacity-80">{identity.name}　本週累積</p>
          <p className="text-3xl font-bold mt-1">NT$ {totalAmount}</p>
          <p className="text-xs opacity-60 mt-1">
            （已扣除取消的訂單與被取消的場次）
          </p>
        </div>

        {loading && (
          <div className="text-center text-zinc-400 text-sm py-8">載入中…</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-sm text-zinc-500">本週還沒有訂單</p>
          </div>
        )}

        {orders.length > 0 && (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/liff/orders/${o.id}`}
                  className="block bg-white border border-zinc-200 rounded-xl px-4 py-3 hover:bg-zinc-50 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-500">
                      {fmtDate(o.order_date)}　{o.kind === 'food' ? '🍱' : '🥤'} {o.vendor_name ?? '—'}
                    </span>
                    <OrderStatusBadge order={o} />
                  </div>
                  <ul className="text-sm text-zinc-700 mb-1">
                    {o.items.map((it, i) => (
                      <li key={i} className="truncate">
                        {it.item_name} × {it.quantity}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm font-semibold text-zinc-900 text-right">
                    NT$ {o.total_amount}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function OrderStatusBadge({ order }: { order: WeeklyOrder }) {
  if (order.status === 'cancelled') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">已取消</span>
    );
  }
  if (order.session_status === 'cancelled') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">場次取消</span>
    );
  }
  if (order.session_status === 'closed') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">已結單</span>
    );
  }
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">進行中</span>
  );
}

function fmtDate(ymd: string): string {
  if (!ymd) return '—';
  const [, m, d] = ymd.split('-');
  return `${m}/${d}`;
}
