# 開發進度與決策記錄

> 每完成一個小步驟、每做一個決策，就在這裡新增一筆。新項目放最上面（倒序）。

---

## 2026-05-10

### Phase 2 完成 ✅

**資料庫**
- `0005_enable_realtime.sql`：把 `daily_sessions` / `orders` / `order_items` 加到 `supabase_realtime` publication，讓前端可訂閱即時變動

**後端**
- `lib/date.ts`：台北時區 helper（getTodayInTaipei / buildTodayTimestamp）
- `app/admin/(authed)/actions.ts`：3 個 server action — `openSession`、`closeSession`、`cancelSession`
  - 23505 重複鍵錯誤友善訊息
  - cancelSession 必填原因，記錄 cancelled_by + cancelled_at + cancellation_reason
  - closeSession / cancelSession 用 `.eq('status', 'open')` 等狀態守門，避免重複觸發
- `app/api/cron/auto-close/route.ts`：Vercel Cron 端點
  - 用 `service_role` key 繞過 RLS
  - 要求 `Authorization: Bearer ${CRON_SECRET}` 才能呼叫
  - 找出 `auto_close_at <= now() AND status='open'` 的 session 全部關掉
- `vercel.json`：cron 排程 `* * * * *`（每分鐘）

**後台 UI**
- `app/admin/(authed)/page.tsx`（取代原 placeholder）：撈今日 sessions + active vendors + 訂單統計
- `app/admin/(authed)/TodayOverview.tsx` 客戶端元件：
  - 上下兩塊卡片：吃的 / 喝的
  - 三種狀態分別顯示：未開單 / 進行中（開單時段）/ 已結單 / 已取消
  - 開單 modal：選廠商 + 4 個自動結單快捷鈕（10:00 / 10:30 / 11:00 / 不設定）
  - 結單按鈕（含 confirm 對話框）
  - 取消整場 modal（必填原因、預警會影響的訂單筆數）
  - **Supabase Realtime 訂閱**：orders / order_items / daily_sessions 任何變動 → router.refresh()

**環境變數**
- `.env.local.example` 加 `CRON_SECRET` 說明
- 使用者已提供 `SUPABASE_SERVICE_ROLE_KEY` 到本地 `.env.local`

**測試**（手動瀏覽器 + curl）
- ✅ 開「吃的」場次（含自動結單時間）
- ✅ 開「喝的」場次
- ✅ 結單 → 狀態變灰
- ✅ 取消整場（含原因填寫）→ 狀態變紅，顯示原因
- ✅ Cron API：`Invoke-RestMethod` 帶 `Authorization` header → 回傳 `closed: 1` + 自動關掉過期的 session
- ✅ Realtime：Cron 關掉 session 後，分頁無 F5 即時更新成「已結單」

**未完成**（移到後面 Phase）
- [ ] 部署到 Vercel + 後台設 env vars（讓 Cron 真的每分鐘自動跑）
- [ ] 員工 LIFF 點餐（Phase 3）

---

## 2026-05-07

### Phase 1 完成 ✅

**資料庫**（4 份 migration）
- `0001_initial_schema.sql`：7 張表 + 3 個 enum + 索引 + FK
- `0002_rls_policies.sql`：RLS 啟用 + 4 個權限 helper 函式 + 各表政策
- `0003_order_modification.sql`：order_items 加 modified_at/by/reason 三欄
- `0004_vendor_kind_and_session_cancel.sql`：vendor_kind enum、vendors/daily_sessions 加 kind、session_status 加 cancelled、daily_sessions 取消相關欄位、kind 一致性 trigger
- 第一個 admin 帳號已建好（手動 INSERT 到 admin_users）

**認證**
- `proxy.ts`：每次請求自動刷新 Supabase token（Next.js 16 已從 middleware 改名為 proxy）
- `lib/auth/getCurrentAdmin.ts`：getCurrentAdmin / requireAdmin / requireRole 三個 helper
- `lib/supabase/{client,server,admin}.ts`：三套 client（瀏覽器、Server Component、service_role）
- `/admin/login`：Email + 密碼登入頁，含「未授權帳號」自動登出
- 登出 server action

**後台 UI**
- `/admin/(authed)` route group：所有需登入的頁面
- 後台 Layout：左側選單依 role 動態顯示、右下登入者 + 登出
- 「今日總覽」（Phase 2 placeholder）
- 「廠商與菜單」/admin/vendors：
  - 列表分「🍱 吃的」「🥤 喝的」兩區，固定欄寬對齊
  - 新增/編輯廠商 modal，含 kind radio 選擇
  - 停用/啟用 toggle、刪除（FK 衝突自動擋下）
- 「廠商菜單頁」/admin/vendors/[id]：
  - 標頭顯示廠商分類標籤
  - 菜單品項 CRUD + 上下排序按鈕
- 「員工管理」/admin/employees（admin 限定）：
  - 員工 CRUD（無 is_active）
  - 刪除按鈕（員工被刪後歷史訂單仍保留 employee_name 快照）
  - LINE 綁定狀態顯示（Phase 2/3 用）

**測試**（手動瀏覽器）
- ✅ 未登入訪 /admin → 自動跳 /admin/login
- ✅ 錯密碼登入 → 紅色錯誤訊息
- ✅ 對的密碼登入 → 進到 /admin 看到「歡迎，管理員（admin）」
- ✅ 登出 → 跳回登入頁
- ✅ 廠商新增（吃的/喝的）→ 列表分區顯示
- ✅ 廠商編輯（含改分類）→ 即時更新
- ✅ 廠商停用/啟用 → 狀態 badge 切換
- ✅ 廠商刪除（無訂單時）→ 連同菜單一起刪
- ✅ 菜單 CRUD + 上下排序 → 順序保存
- ✅ 員工 CRUD + 刪除確認框

**未完成**（移到後面 Phase）
- [ ] Supabase service_role key 取得（Phase 2 寫訂單時用）
- [ ] LINE LIFF channel（Phase 3）
- [ ] Vercel 部署（Phase 1 結束後可開始）
- [ ] 拍照匯入菜單品項（使用者下次有時間時做）

### 開發過程中追加的需求

1. **訂單修改追蹤**（餐廳缺貨換餐）：order_items 加 modified_* 三欄，UI 排 Phase 4
2. **廠商分類「吃的／喝的」**：vendor.kind + daily_session.kind，整個系統依此分流
3. **場次取消**：session_status 加 'cancelled'，必填取消原因，UI 排 Phase 2
4. **廠商刪除按鈕**：原本只有停用，補上 hard delete（FK 自動保護）

---

## 2026-05-07（早些時候）

### 新增需求：訂單修改追蹤（餐廳缺貨換餐情境）

**情境**：訂餐員打電話給餐廳時，發現某員工點的東西餐廳缺貨／沒做，員工臨時改點別的餐點。需要在系統上修改已結單訂單，避免月結金額對不起來。

**決策**（使用者全選 A）：
1. **誰可以改**：admin + orderer
2. **修改原因**：必填（例：「餐廳缺貨換咖哩飯」）
3. **員工可見性**：訂單顯示「已由訂餐員調整」+ 修改人 + 時間 + 原因
4. **時程**：現在（Phase 1）加資料庫欄位，UI 排到 Phase 4

**Schema 變更**（`0003_order_modification.sql`）：
- `order_items` 新增三欄：
  - `modified_at` (timestamptz, nullable) — 修改時間，NULL 表示未被修改過
  - `modified_by` (uuid, nullable, FK → admin_users) — 修改者
  - `modified_reason` (text, nullable) — 修改原因（UI 上必填）
- 補強 RLS：`order_items` 加 admin/orderer 寫入政策；`orders` 加 admin/orderer UPDATE 政策

**Phase 4 待辦補充**：
- 後台訂單詳情頁加「編輯」按鈕（admin/orderer 可見）
- 編輯 modal：每項可改數量／換品項／刪除；底部可加新品項；必填修改原因
- 儲存時：更新 order_items（modified_*三欄）+ 重新計算 orders.total_amount
- 員工 LIFF 訂單顯示：「已由訂餐員 王小明 於 5/8 14:32 調整 — 餐廳缺貨換咖哩飯」

---

## 2026-05-05

### Phase 0 完成 ✅

- ✅ Node.js v24.15.0 + npm 11.12.1 安裝
- ✅ Next.js 16.2.4 + React 19.2.4 + Tailwind CSS 4 + TypeScript 專案建立
  - App Router、無 src/、`@/*` import alias、Turbopack
- ✅ 套件安裝：`@supabase/supabase-js`、`@supabase/ssr`、`@line/liff`
- ✅ `.env.local` 含 Supabase URL + anon key（已被 .gitignore 排除）
- ✅ `.env.local.example` 範本（Supabase + LIFF 變數說明）
- ✅ Supabase client 三檔：
  - `lib/supabase/client.ts` — 瀏覽器端
  - `lib/supabase/server.ts` — Server Component / Route Handler
  - `lib/supabase/admin.ts` — service_role 後端寫入（key 未提供前不能用）
- ✅ 測試首頁：三項自檢通過（Next.js / Tailwind / Supabase 連線）
- ✅ Dev server 跑起來（http://localhost:3000，Ready in <1s）

**未完成**（需手動操作）：
- [ ] Supabase service_role key 取得 → 加入 `.env.local`（Phase 2 寫訂單時需要）
- [ ] LINE LIFF channel 建立（Phase 3 需要）
- [ ] Vercel 連動 GitHub 自動部署

### 注意事項

- Next.js 16 是新版本（AGENTS.md 提醒：「This is NOT the Next.js you know」），開發前須查 `node_modules/next/dist/docs/`
- Windows PowerShell ExecutionPolicy 預設擋 `.ps1` 腳本，需用 `npm.cmd` / `npx.cmd` 直接呼叫
- 中文資料夾名稱無法當 npm package name → 用 `lunch-order-system` 為內部名稱

---

## 2026-05-04

### 規格調整：員工資料表簡化 + 訂單加快照

**決策**：
- `employees` 移除 `is_active` 欄位 → 員工只剩 `id` / `name` / `line_user_id`
- 管理員可從後台**直接刪除**員工（hard delete，非軟刪除）
- 為避免歷史訂單姓名遺失，`orders` 新增 `employee_name` 快照欄位
- `orders.employee_id` 改為 nullable（員工被刪除後變 NULL，但 employee_name 仍保留）

**理由**：
- 使用者希望員工管理介面簡潔，不要有「在職／離職」切換
- 延續規格書既有的「快照」設計理念（order_items 已有 item_name/item_price 快照），保持一致
- 結算報表、叫貨單仍能正確顯示已離職員工的歷史資料

### 建立專案三檔

- `CLAUDE.md`：專案概述 + 規格書摘要 + Schema 設計
- `PROJECT_LOG.md`：本檔，開發進度與決策記錄
- `SKILL.md`：專案專屬開發守則

### Phase 0 啟動

- ✅ Git 倉庫初始化（`git init`）
- ✅ 連接 GitHub remote: lunch-order-system-260504
- ⏳ Next.js 專案建置
- ⏳ Supabase 帳號 + 專案建立
- ⏳ LINE LIFF channel 建立
- ⏳ Vercel 連動 GitHub 自動部署
