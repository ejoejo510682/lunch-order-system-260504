import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/getCurrentAdmin';
import { logoutAction } from '../login/actions';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理員',
  orderer: '訂餐員',
  accountant: '會計',
};

interface NavItem {
  href: string;
  label: string;
  roles: ('admin' | 'orderer' | 'accountant')[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin',           label: '今日總覽',     roles: ['admin', 'orderer', 'accountant'] },
  { href: '/admin/vendors',   label: '廠商與菜單',   roles: ['admin', 'orderer'] },
  { href: '/admin/employees', label: '員工管理',     roles: ['admin'] },
  { href: '/admin/reports',   label: '結算報表',     roles: ['admin', 'accountant'] },
  { href: '/admin/users',     label: '後台帳號',     roles: ['admin'] },
];

export default async function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(admin.role));

  return (
    <div className="min-h-screen flex bg-zinc-50">
      <aside className="w-60 shrink-0 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-5 border-b border-zinc-200">
          <div className="font-bold text-zinc-900">訂餐系統</div>
          <div className="text-xs text-zinc-500 mt-0.5">後台管理</div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-lg text-sm text-zinc-700 hover:bg-zinc-100 transition"
            >
              {item.label}
            </Link>
          ))}
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

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
