'use client';

import { useActionState, useEffect } from 'react';
import { createMenuItem, updateMenuItem, type MenuItemActionState } from './actions';

interface MenuItem {
  id: string;
  name: string;
  price: number;
}

interface Props {
  vendorId: string;
  initialData?: MenuItem;
  onClose: () => void;
}

const initialState: MenuItemActionState = {};

export function MenuItemForm({ vendorId, initialData, onClose }: Props) {
  const isEdit = !!initialData;
  const action = isEdit
    ? updateMenuItem.bind(null, vendorId, initialData!.id)
    : createMenuItem.bind(null, vendorId);

  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
          品名 <span className="text-red-500">*</span>
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
        <label htmlFor="price" className="block text-sm font-medium text-zinc-700 mb-1">
          價格（NT$） <span className="text-red-500">*</span>
        </label>
        <input
          id="price"
          name="price"
          type="number"
          min="0"
          step="1"
          required
          defaultValue={initialData?.price ?? ''}
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition disabled:bg-zinc-50"
        />
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
          {pending ? '儲存中...' : isEdit ? '更新' : '新增'}
        </button>
      </div>
    </form>
  );
}
