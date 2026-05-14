'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminUpdateOrder, adminCancelOrder, type AdminEditItem } from './actions';

// ---------- types ----------

export interface SessionData {
  id: string;
  kind: 'food' | 'drink';
  status: 'open' | 'closed' | 'cancelled';
  order_date: string;
  auto_close_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  vendor: { id: string; name: string; phone: string | null; note: string | null } | null;
}

export interface OrderForAdmin {
  id: string;
  employee_id: string | null;
  employee_name: string;
  total_amount: number;
  status: 'submitted' | 'cancelled';
  submitted_at: string;
  items: {
    id: string;
    menu_item_id: string | null;
    item_name: string;
    item_price: number;
    quantity: number;
    note: string | null;
    modified_at: string | null;
    modified_reason: string | null;
    modified_by_admin: { name: string } | null;
  }[];
}

export interface MenuItemOption {
  id: string;
  name: string;
  price: number;
}

const KIND_LABEL: Record<'food' | 'drink', { label: string; emoji: string }> = {
  food:  { label: '吃的', emoji: '🍱' },
  drink: { label: '喝的', emoji: '🥤' },
};

export function SessionDetailClient({
  session,
  orders,
  menuItems,
}: {
  session: SessionData;
  orders: OrderForAdmin[];
  menuItems: MenuItemOption[];
}) {
  const [editingOrder, setEditingOrder] = useState<OrderForAdmin | null>(null);

  const validOrders = orders.filter((o) => o.status === 'submitted');
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled');

  const totalCount = validOrders.length;
  const totalAmount = validOrders.reduce((s, o) => s + o.total_amount, 0);

  const kindCfg = KIND_LABEL[session.kind];

  return (
    <div className="space-y-4">
      <header className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xl">{kindCfg.emoji}</span>
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900">
            {session.vendor?.name ?? '（廠商已刪除）'}
          </h1>
          <SessionBadge status={session.status} />
        </div>
        {session.vendor?.phone && (
          <p className="text-sm text-zinc-600">
            <a href={`tel:${session.vendor.phone}`} className="text-blue-600 hover:underline">
              📞 {session.vendor.phone}
            </a>
          </p>
        )}
        <p className="text-xs text-zinc-500 mt-2">
          {session.order_date.replaceAll('-', '/')}　{kindCfg.label}場次
        </p>

        {session.vendor?.note && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-900">
            <span className="font-medium">📌 廠商備註：</span>
            <span className="whitespace-pre-line">{session.vendor.note}</span>
          </div>
        )}

        {session.status === 'cancelled' && session.cancellation_reason && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            <span className="font-medium">取消原因：</span>{session.cancellation_reason}
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="訂單筆數" value={`${totalCount} 筆`} />
        <Stat label="總金額" value={`NT$ ${totalAmount}`} />
      </div>

      {validOrders.length > 0 && session.status !== 'cancelled' && (
        <PurchaseList session={session} orders={validOrders} />
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-800 px-1">
          訂單列表（{validOrders.length} 筆）
        </h2>
        {validOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-500 text-sm">
            目前還沒有訂單
          </div>
        ) : (
          <div className="space-y-2">
            {validOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                editable={session.status !== 'cancelled'}
                onEdit={() => setEditingOrder(order)}
              />
            ))}
          </div>
        )}
      </section>

      {cancelledOrders.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-500 px-1">
            已取消訂單（{cancelledOrders.length} 筆，不計入統計）
          </h2>
          <div className="space-y-2">
            {cancelledOrders.map((order) => (
              <OrderCard key={order.id} order={order} editable={false} onEdit={() => {}} />
            ))}
          </div>
        </section>
      )}

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          menuItems={menuItems}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </div>
  );
}

function SessionBadge({ status }: { status: SessionData['status'] }) {
  const cfg: Record<SessionData['status'], { label: string; cls: string }> = {
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-bold text-zinc-900 mt-0.5">{value}</div>
    </div>
  );
}

// ---------- 叫貨單（B 版） ----------

interface AggregatedItem {
  name: string;
  price: number;
  count: number;
  buyers: { name: string; quantity: number; note: string | null }[];
}

function PurchaseList({
  session,
  orders,
}: {
  session: SessionData;
  orders: OrderForAdmin[];
}) {
  const [copied, setCopied] = useState(false);

  // 聚合品項 (item_name + item_price 為一組，因為改價後同名不同價)
  // 每個買家獨立列一筆（同人不同備註要分開顯示）
  const map = new Map<string, AggregatedItem>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.item_name}__${item.item_price}`;
      const existing = map.get(key);
      const buyer = { name: order.employee_name, quantity: item.quantity, note: item.note };
      if (existing) {
        existing.count += item.quantity;
        existing.buyers.push(buyer);
      } else {
        map.set(key, {
          name:   item.item_name,
          price:  item.item_price,
          count:  item.quantity,
          buyers: [buyer],
        });
      }
    }
  }
  const aggregated = Array.from(map.values()).sort((a, b) => b.count - a.count);

  const formatBuyer = (b: { name: string; quantity: number; note: string | null }): string => {
    const qtyPart  = b.quantity > 1 ? `（${b.quantity}份）` : '';
    const notePart = b.note ? ` 📝${b.note}` : '';
    return `${b.name}${qtyPart}${notePart}`;
  };

  const totalCount = aggregated.reduce((s, a) => s + a.count, 0);
  const totalAmount = aggregated.reduce((s, a) => s + a.count * a.price, 0);

  // 純文字版，可複製
  const buildText = (): string => {
    const kindCfg = KIND_LABEL[session.kind];
    const lines: string[] = [];
    lines.push(`📅 ${session.order_date.replaceAll('-', '/')}　${kindCfg.emoji} ${kindCfg.label}叫貨單`);
    lines.push('');
    for (const a of aggregated) {
      lines.push(`${a.name} ×${a.count}`);
      const buyersText = a.buyers.map(formatBuyer).join('、');
      lines.push(`  - ${buyersText}`);
    }
    lines.push('──────────────');
    lines.push(`總計：${totalCount} 份，金額 NT$ ${totalAmount}`);
    if (session.vendor) {
      const phone = session.vendor.phone ? `（${session.vendor.phone}）` : '';
      lines.push(`廠商：${session.vendor.name}${phone}`);
      if (session.vendor.note) {
        lines.push(`備註：${session.vendor.note}`);
      }
    }
    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('複製失敗，請手動選取文字');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-zinc-50">
        <h2 className="text-base font-semibold text-zinc-800">📋 叫貨單</h2>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-lg text-sm bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition"
          >
            {copied ? '✓ 已複製' : '複製為純文字'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-sm bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-medium transition"
          >
            列印
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 font-mono text-sm space-y-3 print:font-sans">
        <p className="text-zinc-500 text-xs">
          📅 {session.order_date.replaceAll('-', '/')}
          {KIND_LABEL[session.kind].emoji} {KIND_LABEL[session.kind].label}叫貨單
        </p>

        {session.vendor?.note && (
          <div className="bg-amber-50 border-l-4 border-amber-400 px-3 py-2 text-sm text-amber-900 font-sans">
            <p className="font-bold mb-0.5">📌 廠商備註</p>
            <p className="whitespace-pre-line">{session.vendor.note}</p>
          </div>
        )}

        <ul className="space-y-2">
          {aggregated.map((a, i) => (
            <li key={i}>
              <div className="font-bold text-zinc-900">
                {a.name} <span className="text-zinc-600">×{a.count}</span>
                <span className="text-xs text-zinc-400 ml-2 font-normal">NT$ {a.price}/份</span>
              </div>
              <div className="text-zinc-600 ml-3 mt-0.5">
                - {a.buyers.map(formatBuyer).join('、')}
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-dashed border-zinc-300 pt-3 space-y-1">
          <p className="font-bold">
            總計：{totalCount} 份，金額 NT$ {totalAmount}
          </p>
          {session.vendor && (
            <p className="text-zinc-700">
              {`廠商：${session.vendor.name}${session.vendor.phone ? `（${session.vendor.phone}）` : ''}`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- 訂單卡片 ----------

function OrderCard({
  order,
  editable,
  onEdit,
}: {
  order: OrderForAdmin;
  editable: boolean;
  onEdit: () => void;
}) {
  const isModified = order.items.some((it) => it.modified_at !== null);
  const modifiedItem = order.items.find((it) => it.modified_at !== null);

  return (
    <div className={`bg-white rounded-xl border ${order.status === 'cancelled' ? 'border-red-200 opacity-70' : 'border-zinc-200'} overflow-hidden`}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100">
        <div>
          <span className="text-sm font-medium text-zinc-900">{order.employee_name}</span>
          <span className="text-xs text-zinc-500 ml-2">
            {new Intl.DateTimeFormat('en-US', {
              timeZone: 'Asia/Taipei',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(new Date(order.submitted_at))}
            　送出
          </span>
          {order.status === 'cancelled' && (
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">已取消</span>
          )}
          {isModified && order.status !== 'cancelled' && (
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
              已調整
            </span>
          )}
        </div>
        {editable && order.status !== 'cancelled' && (
          <button
            type="button"
            onClick={onEdit}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            編輯
          </button>
        )}
      </div>

      <ul className="divide-y divide-zinc-100">
        {order.items.map((item) => (
          <li key={item.id} className="px-4 py-2 text-sm">
            <div className="flex items-center">
              <span className="flex-1 text-zinc-700 truncate">{item.item_name}</span>
              <span className="text-xs text-zinc-500 mr-3">×{item.quantity}</span>
              <span className="text-zinc-900 font-medium">NT$ {item.item_price * item.quantity}</span>
            </div>
            {item.note && (
              <div className="mt-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded inline-block">
                📝 {item.note}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
        <span className="text-xs text-zinc-500">小計</span>
        <span className="text-sm font-bold text-zinc-900">NT$ {order.total_amount}</span>
      </div>

      {isModified && modifiedItem && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-800">
          <p>
            <span className="font-medium">已由</span>
            {modifiedItem.modified_by_admin?.name && ` ${modifiedItem.modified_by_admin.name} `}
            <span className="font-medium">調整</span>
            ：{modifiedItem.modified_reason ?? '（未填原因）'}
          </p>
          {modifiedItem.modified_at && (
            <p className="text-amber-600 mt-0.5">
              {new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Taipei',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }).format(new Date(modifiedItem.modified_at))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- 編輯 modal ----------

interface EditableItem {
  tempId: string;
  menu_item_id: string | null;
  item_name: string;
  item_price: number;
  quantity: number;
  note: string;
}

let nextTempId = 1;

function EditOrderModal({
  order,
  menuItems,
  onClose,
}: {
  order: OrderForAdmin;
  menuItems: MenuItemOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<EditableItem[]>(
    order.items.map((it, i) => ({
      tempId:       `existing-${i}`,
      menu_item_id: it.menu_item_id,
      item_name:    it.item_name,
      item_price:   it.item_price,
      quantity:     it.quantity,
      note:         it.note ?? '',
    })),
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = items.reduce((s, it) => s + it.item_price * it.quantity, 0);

  const updateItem = (tempId: string, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)));
  };

  const removeItem = (tempId: string) => {
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
  };

  const addItemFromMenu = (m: MenuItemOption) => {
    setItems((prev) => [
      ...prev,
      {
        tempId:       `new-${nextTempId++}`,
        menu_item_id: m.id,
        item_name:    m.name,
        item_price:   m.price,
        quantity:     1,
        note:         '',
      },
    ]);
  };

  const addCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        tempId:       `new-${nextTempId++}`,
        menu_item_id: null,
        item_name:    '',
        item_price:   0,
        quantity:     1,
        note:         '',
      },
    ]);
  };

  const handleCancelOrder = () => {
    if (!confirm(`確定要取消「${order.employee_name}」的整筆訂單？`)) return;
    setError(null);
    startTransition(async () => {
      const r = await adminCancelOrder(order.id);
      if (!r.ok) setError(r.error ?? '取消失敗');
      else {
        onClose();
        router.refresh();
      }
    });
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const r = await adminUpdateOrder({
        orderId: order.id,
        items:   items.map((it) => ({
          menu_item_id: it.menu_item_id,
          item_name:    it.item_name,
          item_price:   it.item_price,
          quantity:     it.quantity,
          note:         it.note,
        })),
        reason,
      });
      if (!r.ok) setError(r.error ?? '修改失敗');
      else {
        onClose();
        router.refresh();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-white sm:rounded-2xl shadow-xl w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-zinc-900">編輯訂單</h2>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{order.employee_name} 的訂單</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-zinc-500 text-sm px-2 py-1 rounded hover:bg-zinc-100"
          >
            關閉
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 sm:py-4 space-y-4">
          {/* 既有與新增的品項 */}
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.tempId} className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={it.item_name}
                    onChange={(e) => updateItem(it.tempId, { item_name: e.target.value })}
                    placeholder="品名"
                    disabled={pending}
                    className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.tempId)}
                    disabled={pending}
                    className="px-2 py-1 text-xs text-red-600 hover:text-red-800"
                  >
                    刪除
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500 w-12">價格</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={it.item_price}
                    onChange={(e) => updateItem(it.tempId, { item_price: parseInt(e.target.value || '0', 10) })}
                    disabled={pending}
                    className="w-24 px-2 py-1 rounded border border-zinc-300 text-sm"
                  />
                  <span className="text-xs text-zinc-500 ml-3">數量</span>
                  <button
                    type="button"
                    onClick={() => updateItem(it.tempId, { quantity: Math.max(1, it.quantity - 1) })}
                    disabled={pending || it.quantity <= 1}
                    className="w-7 h-7 rounded bg-zinc-200 hover:bg-zinc-300 text-zinc-700 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{it.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateItem(it.tempId, { quantity: it.quantity + 1 })}
                    disabled={pending}
                    className="w-7 h-7 rounded bg-zinc-900 hover:bg-zinc-800 text-white"
                  >
                    +
                  </button>
                  <span className="ml-auto text-sm font-medium text-zinc-900">
                    NT$ {it.item_price * it.quantity}
                  </span>
                </div>
                <input
                  type="text"
                  value={it.note}
                  onChange={(e) => updateItem(it.tempId, { note: e.target.value })}
                  placeholder="員工備註（少糖、加料、不要香菜...）"
                  maxLength={100}
                  disabled={pending}
                  className="w-full px-3 py-1.5 rounded border border-zinc-300 text-xs bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none"
                />
              </div>
            ))}
          </div>

          {/* 從菜單加入 */}
          {menuItems.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">從菜單加入</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {menuItems.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addItemFromMenu(m)}
                    disabled={pending}
                    className="px-3 py-2 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-50 text-sm text-left transition disabled:opacity-50 flex items-center justify-between gap-2"
                  >
                    <span className="truncate font-medium text-zinc-900">{m.name}</span>
                    <span className="text-xs text-zinc-500 shrink-0">NT$ {m.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={addCustomItem}
            disabled={pending}
            className="w-full py-2 rounded-lg border border-dashed border-zinc-300 hover:bg-zinc-50 text-sm text-zinc-600 transition"
          >
            + 新增自訂品項（不在菜單上）
          </button>

          {/* 修改原因 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              修改原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              required
              placeholder="例：餐廳缺貨換咖哩飯 / 餐廳實際收費 NT$90 與菜單不符"
              disabled={pending}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none resize-none"
            />
            <p className="text-xs text-zinc-500 mt-1">
              員工會在 LINE 內看到這個原因
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-zinc-200 bg-zinc-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-600">{items.length} 個品項</span>
            <span className="text-lg font-bold text-zinc-900">NT$ {total}</span>
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending || items.length === 0 || !reason.trim()}
              className="col-span-2 sm:order-3 sm:ml-auto px-5 py-2.5 rounded-lg text-sm bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition disabled:opacity-40"
            >
              {pending ? '儲存中…' : '儲存修改'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="sm:order-2 px-4 py-2 rounded-lg text-sm text-zinc-700 border border-zinc-300 sm:border-transparent hover:bg-zinc-100 transition disabled:opacity-50"
            >
              不要動
            </button>
            <button
              type="button"
              onClick={handleCancelOrder}
              disabled={pending}
              className="sm:order-1 sm:mr-auto px-3 py-2 rounded-lg text-sm border border-red-200 text-red-700 hover:bg-red-50 transition disabled:opacity-50"
            >
              取消整筆
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
