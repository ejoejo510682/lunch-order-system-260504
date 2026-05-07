'use client';

import { useState, useTransition } from 'react';
import { EmployeeForm } from './EmployeeForm';
import { deleteEmployee } from './actions';

interface Employee {
  id: string;
  name: string;
  line_user_id: string | null;
  created_at: string;
}

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; employee: Employee };

export function EmployeesClient({ employees }: { employees: Employee[] }) {
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const closeModal = () => setModal({ mode: 'closed' });

  const handleDelete = (employee: Employee) => {
    const ok = confirm(
      `確定要刪除「${employee.name}」嗎？\n\n` +
      `這位員工過去的訂單會保留，但姓名顯示會用快照（已記下的姓名）。\n` +
      `此動作無法還原。`,
    );
    if (!ok) return;

    setBusyId(employee.id);
    startTransition(async () => {
      try {
        await deleteEmployee(employee.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">員工管理</h1>
          <p className="text-sm text-zinc-500 mt-1">
            管理員工名單。員工被刪除後，歷史訂單仍會保留姓名紀錄。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition"
        >
          + 新增員工
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {employees.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <p className="text-sm">還沒有員工，點右上「新增員工」開始</p>
          </div>
        ) : (
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[35%]" />
              <col className="w-[40%]" />
              <col className="w-[25%]" />
            </colgroup>
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">姓名</th>
                <th className="text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">LINE 綁定</th>
                <th className="text-right text-xs font-semibold text-zinc-600 uppercase tracking-wider px-6 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 text-sm font-medium text-zinc-900 truncate">
                    {e.name}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {e.line_user_id ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        已綁定
                      </span>
                    ) : (
                      <span className="text-zinc-400">尚未綁定</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setModal({ mode: 'edit', employee: e })}
                      disabled={busyId === e.id}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(e)}
                      disabled={busyId === e.id}
                      className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      {busyId === e.id ? '刪除中...' : '刪除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal.mode !== 'closed' && (
        <Modal title={modal.mode === 'create' ? '新增員工' : '編輯員工'} onClose={closeModal}>
          <EmployeeForm
            initialData={modal.mode === 'edit' ? modal.employee : undefined}
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
