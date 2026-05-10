'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitOrder } from './actions';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
}

export type KindData =
  | { state: 'none' }
  | { state: 'closed' }
  | { state: 'cancelled'; reason: string | null }
  | {
      state: 'open';
      sessionId: string;
      vendor: { id: string; name: string; phone: string | null };
      items: MenuItem[];
    };

type Kind = 'food' | 'drink';

const KIND_LABEL: Record<Kind, { label: string; emoji: string }> = {
  food:  { label: '吃的', emoji: '🍱' },
  drink: { label: '喝的', emoji: '🥤' },
};

interface SavedIdentity {
  id: string;
  name: string;
}
const STORAGE_KEY = 'lunch.identity';

export function MenuClient({
  today,
  food,
  drink,
}: {
  today: string;
  food: KindData;
  drink: KindData;
}) {
  const router = useRouter();
  const [identity, setIdentity] = useState<SavedIdentity | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);

  // 統一購物車：menuItemId → quantity
  const [cart, setCart] = useState<Record<string, number>>({});

  const visibleKinds: Kind[] = [];
  if (food.state !== 'none')  visibleKinds.push('food');
  if (drink.state !== 'none') visibleKinds.push('drink');

  const [activeKind, setActiveKind] = useState<Kind>(
    visibleKinds[0] ?? 'food',
  );

  const [cartExpanded, setCartExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  // 讀身份
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setIdentity(JSON.parse(raw));
    } catch {}
    setIdentityLoaded(true);
  }, []);

  useEffect(() => {
    if (identityLoaded && !identity) {
      router.replace('/liff');
    }
  }, [identityLoaded, identity, router]);

  if (!identityLoaded || !identity) {
    return <FullScreenMessage>載入中…</FullScreenMessage>;
  }

  if (visibleKinds.length === 0) {
    return <NoSessionLayout identity={identity} today={today} />;
  }

  const currentData = activeKind === 'food' ? food : drink;

  // 計算購物車內容（依 kind 分組）
  const groupCart = (kindData: KindData): { items: (MenuItem & { qty: number })[]; subtotal: number } => {
    if (kindData.state !== 'open') return { items: [], subtotal: 0 };
    const items = kindData.items
      .map((it) => ({ ...it, qty: cart[it.id] ?? 0 }))
      .filter((it) => it.qty > 0);
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    return { items, subtotal };
  };

  const foodCart  = groupCart(food);
  const drinkCart = groupCart(drink);
  const totalCount = foodCart.items.reduce((s, it) => s + it.qty, 0) + drinkCart.items.reduce((s, it) => s + it.qty, 0);
  const totalAmount = foodCart.subtotal + drinkCart.subtotal;

  const handleQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const next = { ...prev };
      const cur = next[itemId] ?? 0;
      const nv = Math.max(0, cur + delta);
      if (nv === 0) delete next[itemId];
      else next[itemId] = nv;
      return next;
    });
  };

  const handleSubmit = () => {
    if (totalCount === 0) return;
    setError(null);

    startSubmit(async () => {
      const orderIds: string[] = [];
      const errors: string[] = [];

      // 先送吃的
      if (foodCart.items.length > 0 && food.state === 'open') {
        const r = await submitOrder({
          employeeId: identity.id,
          sessionId:  food.sessionId,
          items:      foodCart.items.map((it) => ({ menuItemId: it.id, quantity: it.qty })),
        });
        if (r.ok) orderIds.push(r.orderId);
        else errors.push(`吃的：${r.error}`);
      }

      // 再送喝的
      if (drinkCart.items.length > 0 && drink.state === 'open') {
        const r = await submitOrder({
          employeeId: identity.id,
          sessionId:  drink.sessionId,
          items:      drinkCart.items.map((it) => ({ menuItemId: it.id, quantity: it.qty })),
        });
        if (r.ok) orderIds.push(r.orderId);
        else errors.push(`喝的：${r.error}`);
      }

      if (orderIds.length === 0) {
        setError(errors.join('\n'));
        return;
      }

      setCart({});
      setCartExpanded(false);

      if (errors.length > 0) {
        // 部分成功，跳到今日訂單頁並把錯誤訊息透過 query 帶過去
        router.push(`/liff/today?warn=${encodeURIComponent(errors.join('；'))}`);
      } else {
        router.push('/liff/today');
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col pb-32">
      <Header identity={identity} />

      {visibleKinds.length > 1 && (
        <div className="px-4 pt-2 pb-3 bg-white sticky top-0 z-10 border-b border-zinc-100">
          <div className="grid grid-cols-2 gap-2">
            {visibleKinds.map((k) => {
              const dotShown = (k === 'food' ? foodCart.items : drinkCart.items).length > 0;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActiveKind(k)}
                  className={`relative py-2.5 rounded-lg text-sm font-medium transition border ${
                    activeKind === k
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  {KIND_LABEL[k].emoji} {KIND_LABEL[k].label}
                  {dotShown && (
                    <span
                      className={`absolute top-1.5 right-2 w-2 h-2 rounded-full ${
                        activeKind === k ? 'bg-white' : 'bg-blue-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <main className="flex-1 px-4 py-4">
        <KindSection kindData={currentData} cart={cart} onQuantity={handleQuantity} />
      </main>

      {totalCount > 0 && (
        <CartBar
          totalCount={totalCount}
          totalAmount={totalAmount}
          foodCart={foodCart}
          drinkCart={drinkCart}
          food={food}
          drink={drink}
          expanded={cartExpanded}
          submitting={submitting}
          error={error}
          onToggle={() => setCartExpanded((v) => !v)}
          onSubmit={handleSubmit}
          onQuantity={handleQuantity}
        />
      )}
    </div>
  );
}

function Header({ identity }: { identity: SavedIdentity }) {
  return (
    <header className="px-5 pt-6 pb-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-zinc-500">今日點餐</p>
        <p className="text-base font-bold text-zinc-900">{identity.name}</p>
      </div>
      <Link
        href="/liff/today"
        className="text-xs text-zinc-500 hover:text-zinc-700 underline"
      >
        我的訂單
      </Link>
    </header>
  );
}

function KindSection({
  kindData,
  cart,
  onQuantity,
}: {
  kindData: KindData;
  cart: Record<string, number>;
  onQuantity: (itemId: string, delta: number) => void;
}) {
  if (kindData.state === 'closed') {
    return (
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 text-center text-zinc-500 text-sm">
        此場次已結單，無法再點餐
      </div>
    );
  }
  if (kindData.state === 'cancelled') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm">
        <p className="text-red-800 font-medium mb-1">此場次已取消</p>
        {kindData.reason && (
          <p className="text-red-700 text-xs">原因：{kindData.reason}</p>
        )}
      </div>
    );
  }
  if (kindData.state !== 'open') return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-zinc-900">{kindData.vendor.name}</h2>
        {kindData.vendor.phone && (
          <p className="text-xs text-zinc-500 mt-0.5">{kindData.vendor.phone}</p>
        )}
      </div>

      {kindData.items.length === 0 ? (
        <div className="bg-zinc-50 rounded-xl p-6 text-center text-zinc-500 text-sm">
          這個廠商還沒有上架任何品項
        </div>
      ) : (
        <ul className="space-y-2">
          {kindData.items.map((item) => {
            const qty = cart[item.id] ?? 0;
            return (
              <li
                key={item.id}
                className="bg-white border border-zinc-200 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{item.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">NT$ {item.price}</p>
                </div>
                <QtyControl qty={qty} onChange={(d) => onQuantity(item.id, d)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QtyControl({ qty, onChange }: { qty: number; onChange: (delta: number) => void }) {
  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        className="px-4 py-1.5 rounded-full bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition"
      >
        加入
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(-1)}
        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-lg flex items-center justify-center transition"
        aria-label="減少"
      >
        −
      </button>
      <span className="min-w-[1.5rem] text-center text-sm font-semibold text-zinc-900">{qty}</span>
      <button
        type="button"
        onClick={() => onChange(1)}
        className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-lg flex items-center justify-center transition"
        aria-label="增加"
      >
        +
      </button>
    </div>
  );
}

function CartBar({
  totalCount,
  totalAmount,
  foodCart,
  drinkCart,
  food,
  drink,
  expanded,
  submitting,
  error,
  onToggle,
  onSubmit,
  onQuantity,
}: {
  totalCount: number;
  totalAmount: number;
  foodCart: { items: (MenuItem & { qty: number })[]; subtotal: number };
  drinkCart: { items: (MenuItem & { qty: number })[]; subtotal: number };
  food: KindData;
  drink: KindData;
  expanded: boolean;
  submitting: boolean;
  error: string | null;
  onToggle: () => void;
  onSubmit: () => void;
  onQuantity: (itemId: string, delta: number) => void;
}) {
  const foodVendorName  = food.state  === 'open' ? food.vendor.name  : null;
  const drinkVendorName = drink.state === 'open' ? drink.vendor.name : null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        {expanded && (
          <div className="bg-white border-t border-zinc-200 max-h-[60vh] overflow-y-auto">
            <div className="px-4 py-3 sticky top-0 bg-white border-b border-zinc-100 z-10">
              <p className="text-sm font-bold text-zinc-900">我的訂單（{totalCount} 項）</p>
            </div>

            {foodCart.items.length > 0 && (
              <CartGroup
                title={`🍱 吃的　${foodVendorName ?? ''}`}
                items={foodCart.items}
                subtotal={foodCart.subtotal}
                onQuantity={onQuantity}
              />
            )}
            {drinkCart.items.length > 0 && (
              <CartGroup
                title={`🥤 喝的　${drinkVendorName ?? ''}`}
                items={drinkCart.items}
                subtotal={drinkCart.subtotal}
                onQuantity={onQuantity}
              />
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-t border-red-200 px-4 py-2 text-sm text-red-700 whitespace-pre-line">
            {error}
          </div>
        )}

        <div className="bg-white border-t border-zinc-200 p-3 flex items-center gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          <button
            type="button"
            onClick={onToggle}
            className="flex-1 px-3 py-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-medium transition flex items-center justify-between"
          >
            <span>🛒 {totalCount} 項</span>
            <span>NT$ {totalAmount} {expanded ? '▼' : '▲'}</span>
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || totalCount === 0}
            className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold transition disabled:opacity-40"
          >
            {submitting ? '送出中…' : '送出'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartGroup({
  title,
  items,
  subtotal,
  onQuantity,
}: {
  title: string;
  items: (MenuItem & { qty: number })[];
  subtotal: number;
  onQuantity: (itemId: string, delta: number) => void;
}) {
  return (
    <div className="border-b border-zinc-100 last:border-0">
      <div className="px-4 py-2 text-xs font-medium text-zinc-600 bg-zinc-50">{title}</div>
      <ul className="divide-y divide-zinc-100">
        {items.map((it) => (
          <li key={it.id} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">{it.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                NT$ {it.price} × {it.qty} = NT$ {it.price * it.qty}
              </p>
            </div>
            <QtyControl qty={it.qty} onChange={(d) => onQuantity(it.id, d)} />
          </li>
        ))}
      </ul>
      <div className="px-4 py-2 text-xs text-zinc-600 text-right bg-zinc-50">
        小計：NT$ {subtotal}
      </div>
    </div>
  );
}

function NoSessionLayout({
  identity,
  today,
}: {
  identity: SavedIdentity;
  today: string;
}) {
  const formatted = today.replaceAll('-', '/');
  return (
    <div className="flex-1 flex flex-col">
      <Header identity={identity} />
      <main className="flex-1 px-6 flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-4">😴</div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">今日尚未開單</h2>
        <p className="text-sm text-zinc-500 mb-1">{formatted}</p>
        <p className="text-xs text-zinc-400 mt-3">請等待訂餐員開單後再來點餐</p>
      </main>
    </div>
  );
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
      {children}
    </div>
  );
}
