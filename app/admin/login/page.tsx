import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth/getCurrentAdmin';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  // 已登入就直接進後台
  const admin = await getCurrentAdmin();
  if (admin) redirect('/admin');

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">後台登入</h1>
          <p className="text-sm text-zinc-500 mt-1">公司內部訂餐系統</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
