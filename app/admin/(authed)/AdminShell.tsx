'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '../login/actions';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理員',
  orderer: '訂餐員',
  accountant: '會計',
};

export interface NavItem {
  href: string;
  label: string;
}

export interface AdminInfo {
  name: string;
  role: string;
}

export function AdminShell({
  admin,
  navItems,
  children,
}: {
  admin: AdminInfo;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const currentLabel = navItems.find((n) => {
    if (n.href === '/admin') return pathname === '/admin';
    return pathname.startsWith(n.href);
  })?.label ?? '訂餐系統';

  return (
    <div className="min-h-screen bg-zinc-50 lg:flex">
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="開啟選單"
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-lg hover:bg-zinc-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-zinc-900 truncate">{currentLabel}</p>
        </div>
        <span className="text-xs text-zinc-500 truncate max-w-[120px]">{admin.name}</span>
      </header>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-zinc-200 flex flex-col transform transition-transform lg:transform-none ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-zinc-900">訂餐系統</div>
            <div className="text-xs text-zinc-500 mt-0.5">後台管理</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="關閉選單"
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-500"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2.5 rounded-lg text-sm transition ${
                  active
                    ? 'bg-zinc-900 text-white font-medium'
                    : 'text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-200">
          <div className="px-3 py-2 mb-2">
            <div className="text-sm font-medium text-zinc-900">{admin.name}</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {ROLE_LABEL[admin.role] ?? admin.role}
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full px-3 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 text-left transition"
            >
              登出
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0 lg:overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
