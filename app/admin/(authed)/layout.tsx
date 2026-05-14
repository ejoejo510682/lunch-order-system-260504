import { requireAdmin } from '@/lib/auth/getCurrentAdmin';
import { AdminShell, type NavItem } from './AdminShell';

interface NavItemDef extends NavItem {
  roles: ('admin' | 'orderer' | 'accountant')[];
}

const NAV_ITEMS: NavItemDef[] = [
  { href: '/admin',             label: '今日總覽',     roles: ['admin', 'orderer', 'accountant'] },
  { href: '/admin/vendors',     label: '廠商與菜單',   roles: ['admin', 'orderer'] },
  { href: '/admin/settlements', label: '週結勾選',     roles: ['admin', 'orderer'] },
  { href: '/admin/employees',   label: '員工管理',     roles: ['admin'] },
  { href: '/admin/reports',     label: '結算報表',     roles: ['admin', 'accountant'] },
  { href: '/admin/users',       label: '後台帳號',     roles: ['admin'] },
];

export default async function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const visibleNav = NAV_ITEMS
    .filter((item) => item.roles.includes(admin.role))
    .map(({ href, label }) => ({ href, label }));

  return (
    <AdminShell admin={{ name: admin.name, role: admin.role }} navItems={visibleNav}>
      {children}
    </AdminShell>
  );
}
