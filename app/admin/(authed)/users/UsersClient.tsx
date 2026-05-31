'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createAdminUser,
  updateAdminUser,
  extendAdminUser,
  resetAdminPassword,
  deleteAdminUser,
} from './actions';

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'orderer' | 'accountant';
  expires_at: string | null;
}

const ROLE_LABEL: Record<AdminUserRow['role'], string> = {
  admin: '管理員',
  orderer: '訂餐員',
  accountant: '會計',
};

const ROLE_COLOR: Record<AdminUserRow['role'], string> = {
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  orderer: 'bg-blue-50 text-blue-700 border-blue-200',
  accountant: 'bg-green-50 text-green-700 border-green-200',
};

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) <= new Date();
}

function fmtExpire(expiresAt: string | null): string {
  if (!expiresAt) return '永不過期';
  const d = new Date(expiresAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

function expireDateInput(expiresAt: string | null): string {
  if (!expiresAt) return '';
  return new Date(expiresAt).toISOString().slice(0, 10);
}

type Modal =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; user: AdminUserRow }
  | { mode: 'password'; user: AdminUserRow };

export function UsersClient({ users, myId }: { users: AdminUserRow[]; myId: string }) {
  const [modal, setModal] = useState<Modal>({ mode: 'closed' });
  const close = () => setModal({ mode: 'closed' });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">後台帳號</h1>
          <p className="text-sm text-zinc-500 mt-1">
            管理後台登入帳號。可設定到期日讓臨時人員自動失效。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className="self-start sm:self-auto px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition"
        >
          + 新增帳號
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {users.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">沒有帳號</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {users.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                isMe={u.id === myId}
                onEdit={() => setModal({ mode: 'edit', user: u })}
                onPassword={() => setModal({ mode: 'password', user: u })}
              />
            ))}
          </ul>
        )}
      </div>

      {modal.mode === 'create' && (
        <Modal title="新增後台帳號" onClose={close}>
          <CreateForm onClose={close} />
        </Modal>
      )}
      {modal.mode === 'edit' && (
        <Modal title={`編輯：${modal.user.name}`} onClose={close}>
          <EditForm user={modal.user} isMe={modal.user.id === myId} onClose={close} />
        </Modal>
      )}
      {modal.mode === 'password' && (
        <Modal title={`重設密碼：${modal.user.name}`} onClose={close}>
          <PasswordForm user={modal.user} onClose={close} />
        </Modal>
      )}
    </div>
  );
}

function UserCard({
  user,
  isMe,
  onEdit,
  onPassword,
}: {
  user: AdminUserRow;
  isMe: boolean;
  onEdit: () => void;
  onPassword: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const expired = isExpired(user.expires_at);

  const handleExtend = (days: number) => {
    setError(null);
    startTransition(async () => {
      const r = await extendAdminUser({ userId: user.id, days });
      if (!r.ok) setError(r.error ?? '延期失敗');
      else router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm(`確定刪除「${user.name}」（${user.email}）？\n此動作無法還原。`)) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteAdminUser(user.id);
      if (!r.ok) setError(r.error ?? '刪除失敗');
      else router.refresh();
    });
  };

  return (
    <li className={`p-4 sm:p-5 ${expired ? 'bg-red-50/30' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-zinc-900">{user.name}</span>
            {isMe && <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">你</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLOR[user.role]}`}>
              {ROLE_LABEL[user.role]}
            </span>
            {expired && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium">
                ⛔ 已過期
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-600 mt-1 truncate">{user.email}</p>
          <p className={`text-xs mt-1 ${expired ? 'text-red-700 font-medium' : 'text-zinc-500'}`}>
            到期：{fmtExpire(user.expires_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 shrink-0">
          {user.expires_at && (
            <>
              <button
                type="button"
                onClick={() => handleExtend(7)}
                disabled={pending}
                className="px-2.5 py-1.5 rounded-lg text-xs text-blue-700 border border-blue-200 hover:bg-blue-50 font-medium disabled:opacity-50"
              >
                +7天
              </button>
              <button
                type="button"
                onClick={() => handleExtend(30)}
                disabled={pending}
                className="px-2.5 py-1.5 rounded-lg text-xs text-blue-700 border border-blue-200 hover:bg-blue-50 font-medium disabled:opacity-50"
              >
                +30天
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onEdit}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg text-xs text-zinc-700 border border-zinc-300 hover:bg-zinc-100 font-medium disabled:opacity-50"
          >
            編輯
          </button>
          <button
            type="button"
            onClick={onPassword}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg text-xs text-zinc-700 border border-zinc-300 hover:bg-zinc-100 font-medium disabled:opacity-50"
          >
            改密碼
          </button>
          {!isMe && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="px-3 py-1.5 rounded-lg text-xs text-red-700 border border-red-200 hover:bg-red-50 font-medium disabled:opacity-50"
            >
              刪除
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </li>
  );
}

// ---------- 新增表單 ----------

function CreateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'orderer' | 'accountant'>('orderer');
  const [expiresAt, setExpiresAt] = useState(daysFromNow(7));  // 預設 7 天後
  const [neverExpire, setNeverExpire] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createAdminUser({
        email,
        password,
        name,
        role,
        expiresAtDate: neverExpire ? '' : expiresAt,
      });
      if (!r.ok) setError(r.error ?? '建立失敗');
      else {
        onClose();
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Email" required>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
        />
      </Field>

      <Field label="密碼" required hint="至少 6 個字元">
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
        />
      </Field>

      <Field label="姓名" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
        />
      </Field>

      <Field label="角色" required>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'orderer' | 'accountant')}
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none bg-white"
        >
          <option value="orderer">訂餐員（開單／結單／改訂單）</option>
          <option value="admin">管理員（所有權限）</option>
          <option value="accountant">會計（看報表）</option>
        </select>
      </Field>

      <ExpireField
        date={expiresAt}
        setDate={setExpiresAt}
        never={neverExpire}
        setNever={setNeverExpire}
        disabled={pending}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="px-4 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg text-sm bg-zinc-900 hover:bg-zinc-800 text-white font-medium disabled:opacity-50"
        >
          {pending ? '建立中…' : '建立帳號'}
        </button>
      </div>
    </form>
  );
}

// ---------- 編輯表單 ----------

function EditForm({
  user,
  isMe,
  onClose,
}: {
  user: AdminUserRow;
  isMe: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [expiresAt, setExpiresAt] = useState(expireDateInput(user.expires_at));
  const [neverExpire, setNeverExpire] = useState(user.expires_at === null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await updateAdminUser({
        userId: user.id,
        name,
        role,
        expiresAtDate: neverExpire ? '' : expiresAt,
      });
      if (!r.ok) setError(r.error ?? '更新失敗');
      else {
        onClose();
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-zinc-50 rounded-lg px-3 py-2 text-sm text-zinc-600">
        Email：<span className="font-medium text-zinc-900">{user.email}</span>
        <span className="text-xs ml-2 text-zinc-400">（Email 無法修改）</span>
      </div>

      <Field label="姓名" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
        />
      </Field>

      <Field label="角色" required hint={isMe ? '不能修改自己的角色' : undefined}>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'orderer' | 'accountant')}
          disabled={pending || isMe}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none bg-white disabled:bg-zinc-50"
        >
          <option value="orderer">訂餐員</option>
          <option value="admin">管理員</option>
          <option value="accountant">會計</option>
        </select>
      </Field>

      <ExpireField
        date={expiresAt}
        setDate={setExpiresAt}
        never={neverExpire}
        setNever={setNeverExpire}
        disabled={pending}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="px-4 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg text-sm bg-zinc-900 hover:bg-zinc-800 text-white font-medium disabled:opacity-50"
        >
          {pending ? '更新中…' : '儲存'}
        </button>
      </div>
    </form>
  );
}

// ---------- 重設密碼表單 ----------

function PasswordForm({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await resetAdminPassword({ userId: user.id, newPassword });
      if (!r.ok) setError(r.error ?? '重設失敗');
      else {
        alert(`✓ 密碼已重設\n\n請告知該用戶新密碼。`);
        onClose();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
        ⚠️ 重設後請告知該用戶新密碼。系統不會自動通知。
      </div>

      <Field label="新密碼" required hint="至少 6 個字元">
        <input
          type="text"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          autoFocus
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
        />
      </Field>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="px-4 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg text-sm bg-zinc-900 hover:bg-zinc-800 text-white font-medium disabled:opacity-50"
        >
          {pending ? '重設中…' : '重設密碼'}
        </button>
      </div>
    </form>
  );
}

// ---------- 共用元件 ----------

function ExpireField({
  date,
  setDate,
  never,
  setNever,
  disabled,
}: {
  date: string;
  setDate: (s: string) => void;
  never: boolean;
  setNever: (b: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">到期日</label>
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={never}
            onChange={(e) => setNever(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4"
          />
          <span className="text-sm text-zinc-700">永不過期（給長期帳號用）</span>
        </label>
        {!never && (
          <>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={disabled}
              required
              min={daysFromNow(0)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
            />
            <div className="flex gap-1.5 text-xs">
              <button type="button" onClick={() => setDate(daysFromNow(7))} disabled={disabled} className="px-2.5 py-1 rounded border border-zinc-300 hover:bg-zinc-100">7 天</button>
              <button type="button" onClick={() => setDate(daysFromNow(14))} disabled={disabled} className="px-2.5 py-1 rounded border border-zinc-300 hover:bg-zinc-100">14 天</button>
              <button type="button" onClick={() => setDate(daysFromNow(30))} disabled={disabled} className="px-2.5 py-1 rounded border border-zinc-300 hover:bg-zinc-100">30 天</button>
              <button type="button" onClick={() => setDate(daysFromNow(90))} disabled={disabled} className="px-2.5 py-1 rounded border border-zinc-300 hover:bg-zinc-100">90 天</button>
            </div>
            <p className="text-xs text-zinc-500">該日 23:59:59 後此帳號無法登入（已登入者下次操作時會被自動登出）</p>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
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
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-2xl shadow-xl w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 text-sm px-2 py-1 rounded hover:bg-zinc-100">關閉</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
