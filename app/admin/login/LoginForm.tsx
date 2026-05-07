'use client';

import { useActionState } from 'react';
import { loginAction, type LoginActionState } from './actions';

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition disabled:bg-zinc-50"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
          密碼
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition disabled:bg-zinc-50"
        />
      </div>

      {state.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? '登入中...' : '登入'}
      </button>
    </form>
  );
}
