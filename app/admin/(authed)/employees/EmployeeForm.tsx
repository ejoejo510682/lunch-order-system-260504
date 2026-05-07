'use client';

import { useActionState, useEffect } from 'react';
import { createEmployee, updateEmployee, type EmployeeActionState } from './actions';

interface Employee {
  id: string;
  name: string;
}

interface Props {
  initialData?: Employee;
  onClose: () => void;
}

const initialState: EmployeeActionState = {};

export function EmployeeForm({ initialData, onClose }: Props) {
  const isEdit = !!initialData;
  const action = isEdit
    ? updateEmployee.bind(null, initialData!.id)
    : createEmployee;

  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
          員工姓名 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoFocus
          defaultValue={initialData?.name ?? ''}
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
