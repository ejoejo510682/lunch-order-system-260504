'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Employee {
  id: string;
  name: string;
}

interface SavedIdentity {
  id: string;
  name: string;
}

const STORAGE_KEY = 'lunch.identity';

export function IdentitySelector({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedIdentity | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [forceSelect, setForceSelect] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  if (!loaded) {
    return <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">載入中…</div>;
  }

  // 已選過身份且不是要切換 → 顯示歡迎頁
  if (saved && !forceSelect) {
    // 確認 saved.id 還存在（員工被刪的情況）
    const stillExists = employees.some((e) => e.id === saved.id);
    if (!stillExists) {
      // 員工被刪了，強制重選
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      setSaved(null);
      return null;
    }

    return (
      <div className="flex-1 flex flex-col">
        <header className="px-6 pt-12 pb-6">
          <h1 className="text-2xl font-bold text-zinc-900">公司訂餐</h1>
          <p className="text-sm text-zinc-500 mt-1">請開始今日點餐</p>
        </header>

        <main className="flex-1 px-6 flex flex-col justify-center">
          <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-6 text-center mb-6">
            <p className="text-xs text-zinc-500 mb-1">目前身份</p>
            <p className="text-xl font-bold text-zinc-900">{saved.name}</p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/liff/menu')}
            className="w-full py-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-base font-semibold transition shadow-sm"
          >
            開始點餐
          </button>

          <button
            type="button"
            onClick={() => router.push('/liff/today')}
            className="w-full mt-3 py-3 rounded-xl bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-sm font-medium transition"
          >
            我的訂單
          </button>
        </main>

        <footer className="px-6 pb-8 pt-4">
          <button
            type="button"
            onClick={() => {
              setForceSelect(true);
              setSelectedId(saved.id);
            }}
            className="w-full text-sm text-zinc-500 hover:text-zinc-700"
          >
            不是我？切換身份
          </button>
        </footer>
      </div>
    );
  }

  // 第一次或要切換 → 顯示下拉選單
  const onSubmit = () => {
    const emp = employees.find((e) => e.id === selectedId);
    if (!emp) return;
    const data: SavedIdentity = { id: emp.id, name: emp.name };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
    setSaved(data);
    setForceSelect(false);
    router.push('/liff/menu');
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold text-zinc-900">公司訂餐</h1>
        <p className="text-sm text-zinc-500 mt-1">請選擇你的名字</p>
      </header>

      <main className="flex-1 px-6 flex flex-col">
        {employees.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
            目前還沒有員工資料，請聯絡管理員先在後台建立員工名單
          </div>
        ) : (
          <>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-4 py-4 rounded-xl border border-zinc-300 bg-white text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            >
              <option value="" disabled>
                請選擇你的姓名
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onSubmit}
              disabled={!selectedId}
              className="mt-6 w-full py-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-base font-semibold transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {forceSelect ? '切換並開始點餐' : '進入點餐'}
            </button>

            {forceSelect && (
              <button
                type="button"
                onClick={() => setForceSelect(false)}
                className="mt-3 w-full py-3 rounded-xl text-zinc-500 hover:text-zinc-700 text-sm"
              >
                取消
              </button>
            )}
          </>
        )}
      </main>

      <footer className="px-6 pb-8 pt-4 text-center text-xs text-zinc-400">
        身份只儲存在你的手機上，不會傳到雲端
      </footer>
    </div>
  );
}
