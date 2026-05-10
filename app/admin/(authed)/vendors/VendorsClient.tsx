'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { VendorForm } from './VendorForm';
import { toggleVendorActive, deleteVendor } from './actions';

interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  is_active: boolean;
  kind: 'food' | 'drink';
  menu_image_urls: string[];
  created_at: string;
}

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; vendor: Vendor };

export function VendorsClient({ vendors }: { vendors: Vendor[] }) {
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const closeModal = () => setModal({ mode: 'closed' });

  const handleToggle = (vendor: Vendor) => {
    setBusyId(vendor.id);
    startTransition(async () => {
      try {
        await toggleVendorActive(vendor.id, !vendor.is_active);
      } finally {
        setBusyId(null);
      }
    });
  };

  const handleDelete = (vendor: Vendor) => {
    const ok = confirm(
      `確定要刪除「${vendor.name}」嗎？\n\n` +
      `⚠️ 這家廠商的菜單品項也會一起刪除。\n` +
      `（如果已有訂餐紀錄則會自動擋下，保護歷史資料）`,
    );
    if (!ok) return;

    setBusyId(vendor.id);
    startTransition(async () => {
      try {
        await deleteVendor(vendor.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    });
  };

  const foodVendors  = vendors.filter((v) => v.kind === 'food');
  const drinkVendors = vendors.filter((v) => v.kind === 'drink');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">廠商與菜單</h1>
          <p className="text-sm text-zinc-500 mt-1">
            管理合作廠商，點擊廠商名稱進入該廠商菜單管理
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition"
        >
          + 新增廠商
        </button>
      </div>

      {vendors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-500">
          <p className="text-sm">還沒有廠商，點右上「新增廠商」開始</p>
        </div>
      ) : (
        <>
          <VendorSection
            title="🍱 吃的"
            vendors={foodVendors}
            onEdit={(v) => setModal({ mode: 'edit', vendor: v })}
            onToggle={handleToggle}
            onDelete={handleDelete}
            busyId={busyId}
          />
          <VendorSection
            title="🥤 喝的"
            vendors={drinkVendors}
            onEdit={(v) => setModal({ mode: 'edit', vendor: v })}
            onToggle={handleToggle}
            onDelete={handleDelete}
            busyId={busyId}
          />
        </>
      )}

      {modal.mode !== 'closed' && (
        <Modal title={modal.mode === 'create' ? '新增廠商' : '編輯廠商'} onClose={closeModal}>
          <VendorForm
            initialData={modal.mode === 'edit' ? modal.vendor : undefined}
            onClose={closeModal}
          />
        </Modal>
      )}
    </div>
  );
}

function VendorSection({
  title,
  vendors,
  onEdit,
  onToggle,
  onDelete,
  busyId,
}: {
  title: string;
  vendors: Vendor[];
  onEdit: (v: Vendor) => void;
  onToggle: (v: Vendor) => void;
  onDelete: (v: Vendor) => void;
  busyId: string | null;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-600 mb-2 px-1">
        {title}
        <span className="ml-2 text-xs text-zinc-400">{vendors.length} 家</span>
      </h2>
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {vendors.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-sm">
            這個分類還沒有廠商
          </div>
        ) : (
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[18%]" />
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">名稱</th>
                <th className="text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">電話</th>
                <th className="text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">備註</th>
                <th className="text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">狀態</th>
                <th className="text-right text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 truncate">
                    <Link
                      href={`/admin/vendors/${v.id}`}
                      className="text-sm font-medium text-zinc-900 hover:text-blue-600 hover:underline"
                    >
                      {v.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600 truncate">
                    {v.phone ?? <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600 truncate">
                    {v.note ?? <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    {v.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        啟用中
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                        已停用
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onEdit(v)}
                      disabled={busyId === v.id}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggle(v)}
                      disabled={busyId === v.id}
                      className="text-sm text-zinc-600 hover:text-zinc-800 font-medium disabled:opacity-50"
                    >
                      {busyId === v.id ? '處理中...' : v.is_active ? '停用' : '啟用'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(v)}
                      disabled={busyId === v.id}
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
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-zinc-900 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
