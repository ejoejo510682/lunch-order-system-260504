import { requireAdmin } from '@/lib/auth/getCurrentAdmin';

export default async function AdminHome() {
  const admin = await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">今日總覽</h1>
        <p className="text-sm text-zinc-500 mt-1">
          歡迎，{admin.name}（{admin.role}）
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-8">
        <div className="text-center py-12 text-zinc-500">
          <p className="text-sm">今日總覽功能將於 Phase 2 實作</p>
          <p className="text-xs mt-2">目前可使用左側選單管理廠商、菜單、員工</p>
        </div>
      </div>
    </div>
  );
}
