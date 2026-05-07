'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { MenuItemForm } from './MenuItemForm';
import { toggleMenuItemActive, deleteMenuItem, moveMenuItem } from './actions';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  sort_order: number;
}

interface Vendor {
  id: string;
  name: string;
  kind: 'food' | 'drink';
}

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; item: MenuItem };

export function MenuClient({
  vendor,
  items,
}: {
  vendor: Vendor;
  items: MenuItem[];
}) {
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const closeModal = () => setModal({ mode: 'closed' });

  const run = (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    startTransition(async () => {
      try { await fn(); }
      finally { setBusyId(null); }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/vendors"
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          ← 返回廠商列表
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-900">{vendor.name}</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
              {vendor.kind === 'food' ? '🍱 吃的' : '🥤 喝的'}
            </span>
          </div>
          <p className="text-sm text-zinc-500 mt-1">菜單管理</p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition"
        >
          + 新增品項
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <p className="text-sm">這個廠商還沒有菜單品項</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3 w-24">排序</th>
                <th className="text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">品名</th>
                <th className="text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">價格</th>
                <th className="text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">狀態</th>
                <th className="text-right text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((it, idx) => (
                <tr key={it.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={idx === 0 || busyId === it.id}
                        onClick={() => run(it.id, () => moveMenuItem(vendor.id, it.id, 'up'))}
                        className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="上移"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === items.length - 1 || busyId === it.id}
                        onClick={() => run(it.id, () => moveMenuItem(vendor.id, it.id, 'down'))}
                        className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="下移"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-zinc-900">
                    {it.name}
                  </td>
                  <td className="px-6 py-3 text-sm text-zinc-700">
                    NT$ {it.price}
                  </td>
                  <td className="px-6 py-3">
                    {it.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        上架中
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                        已下架
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setModal({ mode: 'edit', item: it })}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      disabled={busyId === it.id}
                      onClick={() => run(it.id, () => toggleMenuItemActive(vendor.id, it.id, !it.is_active))}
                      className="text-sm text-zinc-600 hover:text-zinc-800 font-medium disabled:opacity-50"
                    >
                      {it.is_active ? '下架' : '上架'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === it.id}
                      onClick={() => {
                        if (!confirm(`確定要刪除「${it.name}」嗎？此動作無法還原。`)) return;
                        run(it.id, () => deleteMenuItem(vendor.id, it.id));
                      }}
                      className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal.mode !== 'closed' && (
        <Modal title={modal.mode === 'create' ? '新增品項' : '編輯品項'} onClose={closeModal}>
          <MenuItemForm
            vendorId={vendor.id}
            initialData={modal.mode === 'edit' ? modal.item : undefined}
            onClose={closeModal}
          />
        </Modal>
      )}
    </div>
  );
}

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
