'use client';

import { useActionState, useEffect } from 'react';
import { createVendor, updateVendor, type VendorActionState } from './actions';
import { VendorImageManager } from './VendorImageManager';

interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  kind: 'food' | 'drink';
  menu_image_urls: string[];
}

interface Props {
  initialData?: Vendor;
  onClose: () => void;
}

const initialState: VendorActionState = {};

export function VendorForm({ initialData, onClose }: Props) {
  const isEdit = !!initialData;
  const action = isEdit
    ? updateVendor.bind(null, initialData!.id)
    : createVendor;

  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">
          分類 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 cursor-pointer hover:bg-zinc-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400 transition">
            <input
              type="radio"
              name="kind"
              value="food"
              required
              defaultChecked={(initialData?.kind ?? 'food') === 'food'}
              disabled={pending}
              className="sr-only"
            />
            <span className="text-base">🍱</span>
            <span className="text-sm font-medium">吃的</span>
          </label>
          <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-300 cursor-pointer hover:bg-zinc-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400 transition">
            <input
              type="radio"
              name="kind"
              value="drink"
              required
              defaultChecked={initialData?.kind === 'drink'}
              disabled={pending}
              className="sr-only"
            />
            <span className="text-base">🥤</span>
            <span className="text-sm font-medium">喝的</span>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
          廠商名稱 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={initialData?.name ?? ''}
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition disabled:bg-zinc-50"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-zinc-700 mb-1">
          電話
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={initialData?.phone ?? ''}
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition disabled:bg-zinc-50"
        />
      </div>

      <div>
        <label htmlFor="note" className="block text-sm font-medium text-zinc-700 mb-1">
          備註（地址、聯絡人等）
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={initialData?.note ?? ''}
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition disabled:bg-zinc-50 resize-none"
        />
      </div>

      {state.error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {isEdit && initialData && (
        <div className="pt-3 border-t border-zinc-200">
          <VendorImageManager
            vendorId={initialData.id}
            initialUrls={initialData.menu_image_urls ?? []}
          />
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
          {pending ? '儲存中...' : isEdit ? '更新' : '新增'}
        </button>
      </div>
    </form>
  );
}
