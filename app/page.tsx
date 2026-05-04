import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  let supabaseStatus: { ok: boolean; message: string };

  try {
    const supabase = await createClient();
    // 試呼叫一個不存在的資料表，目的是確認連線通到 Supabase（會拿到 PostgREST 的錯誤訊息而非 fetch 失敗）
    const { error } = await supabase.from('_connection_test').select('*').limit(1);
    if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
      // 拿到「找不到資料表」的錯誤 = Supabase 已回應，連線 OK（資料表尚未建立才是預期）
      supabaseStatus = { ok: true, message: '已連線（資料表尚未建立）' };
    } else if (error) {
      supabaseStatus = { ok: false, message: `${error.code}: ${error.message}` };
    } else {
      supabaseStatus = { ok: true, message: '已連線' };
    }
  } catch (e) {
    supabaseStatus = {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-zinc-200 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">公司內部訂餐系統</h1>
          <p className="text-sm text-zinc-500 mt-1">Phase 0：環境建置完成</p>
        </div>

        <div className="space-y-3">
          <CheckItem label="Next.js" ok detail="v16.2.4" />
          <CheckItem label="Tailwind CSS" ok detail="v4" />
          <CheckItem
            label="Supabase 連線"
            ok={supabaseStatus.ok}
            detail={supabaseStatus.message}
          />
        </div>

        <div className="pt-4 border-t border-zinc-100 text-sm text-zinc-500">
          下一步：Phase 1 — 建立資料表 + 後台登入
        </div>
      </div>
    </main>
  );
}

function CheckItem({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-1 inline-block w-2.5 h-2.5 rounded-full ${
          ok ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-zinc-900">{label}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{detail}</div>
      </div>
    </div>
  );
}
