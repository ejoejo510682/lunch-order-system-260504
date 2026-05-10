'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cancelOrder, updateOrderItems } from './actions';

export interface MenuItemOpt {
  id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  menu_item_id: string | null;
  item_name: string;
  item_price: number;
  quantity: number;
}

export interface OrderData {
  id: string;
  employee_id: string;
  employee_name: string;
  total_amount: number;
  status: 'submitted' | 'cancelled';
  submitted_at: string;
  editable_until: string;
  session_id: string;
  session: {
    id: string;
    kind: 'food' | 'drink';
    status: 'open' | 'closed' | 'cancelled';
    vendor_id: string;
    vendor: { id: string; name: string; phone: string | null } | null;
  } | null;
  items: OrderItem[];
}

export function OrderClient({
  order,
  menuItems,
}: {
  order: OrderData;
  menuItems: MenuItemOpt[];
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const editableUntilMs = new Date(order.editable_until).getTime();
  const remainingMs = Math.max(0, editableUntilMs - now);
  const remainingMin = Math.floor(remainingMs / 60000);
  const remainingSec = Math.floor((remainingMs % 60000) / 1000);
  const isEditable = remainingMs > 0 && order.status === 'submitted';

  const sessionOpen = order.session?.status === 'open';
  const canStillModify = isEditable && sessionOpen;

  const submittedAt = formatDateTime(order.submitted_at);
  const kindLabel = order.session?.kind === 'food' ? '🍱 吃的' : '🥤 喝的';

  return (
    <div className="flex-1 flex flex-col">
      <header className="px-5 pt-6 pb-4">
        <Link href="/liff/menu" className="text-xs text-zinc-500 hover:text-zinc-700">
          ← 返回菜單
        </Link>
        <h1 className="text-xl font-bold text-zinc-900 mt-2">訂單已送出</h1>
        <p className="text-sm text-zinc-500 mt-1">{submittedAt}</p>
      </header>

      <main className="flex-1 px-5 space-y-4 pb-6">
        <StatusBanner order={order} canStillModify={canStillModify} sessionOpen={sessionOpen} />

        {canStillModify && (
          <CountdownBar minutes={remainingMin} seconds={remainingSec} />
        )}

        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
            <span className="text-xs text-zinc-500">{kindLabel}</span>
            <span className="text-sm font-medium text-zinc-900">
              {order.session?.vendor?.name ?? '—'}
            </span>
          </div>

          <ul className="divide-y divide-zinc-100">
            {order.items.map((it) => (
              <li key={it.id} className="px-4 py-3 flex items-center">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{it.item_name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    NT$ {it.item_price} × {it.quantity}
                  </p>
                </div>
                <p className="text-sm font-semibold text-zinc-900">
                  NT$ {it.item_price * it.quantity}
                </p>
              </li>
            ))}
          </ul>

          <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">總計</span>
            <span className="text-lg font-bold text-zinc-900">NT$ {order.total_amount}</span>
          </div>
        </div>

        {actionError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        <div className="space-y-2">
          {canStillModify ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="w-full py-3 rounded-xl bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-sm font-medium transition"
              >
                修改訂單
              </button>
              <CancelButton orderId={order.id} employeeId={order.employee_id} setError={setActionError} />
            </>
          ) : order.status !== 'cancelled' ? (
            <p className="text-center text-xs text-zinc-500 py-2">
              {!sessionOpen
                ? '場次已結單，如需修改請聯絡訂餐員'
                : '已超過 5 分鐘可修改時限，如需修改請聯絡訂餐員'}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => router.push('/liff/menu')}
            className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition"
          >
            再下一單
          </button>
        </div>
      </main>

      {editing && order.session?.vendor && (
        <EditModal
          order={order}
          menuItems={menuItems}
          onClose={() => {
            setEditing(false);
            setActionError(null);
          }}
          onError={setActionError}
        />
      )}
    </div>
  );
}

function StatusBanner({
  order,
  canStillModify,
  sessionOpen,
}: {
  order: OrderData;
  canStillModify: boolean;
  sessionOpen: boolean;
}) {
  if (order.status === 'cancelled') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <p className="text-sm font-medium text-red-800">此訂單已取消</p>
      </div>
    );
  }
  if (!sessionOpen) {
    return (
      <div className="bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-3">
        <p className="text-sm text-zinc-700">場次已結單，訂單已送出</p>
      </div>
    );
  }
  if (canStillModify) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-sm text-blue-800">
          訂單已送出，可在 5 分鐘內修改或取消
        </p>
      </div>
    );
  }
  return (
    <div className="bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-3">
      <p className="text-sm text-zinc-700">訂單已送出</p>
    </div>
  );
}

function CountdownBar({ minutes, seconds }: { minutes: number; seconds: number }) {
  return (
    <div className="bg-blue-600 text-white rounded-xl px-4 py-3 text-center">
      <p className="text-xs opacity-80">剩餘可修改時間</p>
      <p className="text-2xl font-bold tabular-nums mt-0.5">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </p>
    </div>
  );
}

function CancelButton({
  orderId,
  employeeId,
  setError,
}: {
  orderId: string;
  employeeId: string;
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm('確定要取消這筆訂單嗎？此動作無法還原。')) return;
    setError(null);
    startTransition(async () => {
      const r = await cancelOrder({ orderId, employeeId });
      if (!r.ok) setError(r.error ?? '取消失敗');
      else router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="w-full py-3 rounded-xl bg-white border border-red-300 hover:bg-red-50 text-red-700 text-sm font-medium transition disabled:opacity-50"
    >
      {pending ? '取消中…' : '取消整筆訂單'}
    </button>
  );
}

function EditModal({
  order,
  menuItems,
  onClose,
  onError,
}: {
  order: OrderData;
  menuItems: MenuItemOpt[];
  onClose: () => void;
  onError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const it of order.items) {
      if (it.menu_item_id) map[it.menu_item_id] = it.quantity;
    }
    return map;
  });
  const [pending, startTransition] = useTransition();

  const total = menuItems.reduce((s, m) => s + m.price * (cart[m.id] ?? 0), 0);
  const count = Object.values(cart).reduce((s, q) => s + q, 0);

  const setQty = (id: string, delta: number) => {
    setCart((prev) => {
      const next = { ...prev };
      const cur = next[id] ?? 0;
      const nv = Math.max(0, cur + delta);
      if (nv === 0) delete next[id];
      else next[id] = nv;
      return next;
    });
  };

  const onSave = () => {
    if (count === 0) {
      onError('至少要保留一個品項，如要全刪請按「取消整筆訂單」');
      return;
    }
    onError(null);
    const items = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
    startTransition(async () => {
      const r = await updateOrderItems({ orderId: order.id, employeeId: order.employee_id, items });
      if (!r.ok) onError(r.error ?? '修改失敗');
      else {
        onClose();
        router.refresh();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900">修改訂單</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 text-sm"
            disabled={pending}
          >
            取消
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {menuItems.map((m) => {
            const qty = cart[m.id] ?? 0;
            return (
              <div key={m.id} className="bg-white border border-zinc-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{m.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">NT$ {m.price}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty(m.id, -1)}
                    disabled={qty === 0 || pending}
                    className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-lg flex items-center justify-center disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="min-w-[1.5rem] text-center text-sm font-semibold text-zinc-900">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(m.id, 1)}
                    disabled={pending}
                    className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-lg flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-zinc-200 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-zinc-500">{count} 項</p>
            <p className="text-base font-bold text-zinc-900">NT$ {total}</p>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={pending || count === 0}
            className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold transition disabled:opacity-40"
          >
            {pending ? '儲存中…' : '儲存修改'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-TW', {
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

