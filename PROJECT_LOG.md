# 開發進度與決策記錄

> 每完成一個小步驟、每做一個決策，就在這裡新增一筆。新項目放最上面（倒序）。

---

## 2026-05-11

### 新增功能：廠商菜單圖片 + LIFF 縮放檢視

**情境**：每間廠商有原始菜單圖（飲料店尤其常見），員工點餐時看圖比較好想像。

**Schema 變更**（`0007_menu_images.sql`）：
- `vendors` 加 `menu_image_urls text[]`（陣列，可放多張圖）
- 建立 Supabase Storage bucket `menu-images`（公開讀取，5MB/檔，限 jpeg/png/webp）
- Storage RLS：所有人可讀；admin/orderer 可寫入/刪除

**新工具**：
- `lib/imageCompress.ts`：瀏覽器端 Canvas 壓縮，最大寬 1920px / JPEG 80%
- 安裝 `react-zoom-pan-pinch`：LIFF 雙指縮放與拖曳

**後台**（廠商編輯 modal）：
- 多一個「菜單圖片」區塊（僅 edit 模式顯示，create 時不顯示）
- 多檔上傳（一次選多張，依序壓縮上傳）
- 縮圖網格顯示，右上角 ✕ 可刪除
- 上傳/刪除直接持久化（不需要點「更新」按鈕）

**LIFF 員工端**（/liff/menu）：
- 在每個 kind tab 下方、品項列表上方顯示菜單圖片
- 點圖片進入全螢幕黑色 modal
- 雙指縮放（0.5x – 5x）、拖曳平移、雙擊縮放切換
- 右上 ✕ 關閉

**部署相關**：
- 拿掉 `vercel.json` 的 cron 設定（Hobby 方案不支援每分鐘）
- 改用 Supabase **pg_cron** 直接在資料庫排程（每分鐘執行 UPDATE）
- 啟用 pg_cron extension + `cron.schedule` 設好「auto-close-sessions」任務
- 已部署到 Vercel：`https://lunch-order-system-260504.vercel.app`
- GitHub repo 改為 public（為通過 Hobby 方案 collaboration 限制）

---

## 2026-05-10

### Phase 4 完成 ✅

**叫貨單（B 版）+ 訂單編輯 UI**

**新頁面 `/admin/sessions/[id]`**（admin + orderer）
- 場次詳細：廠商資訊、狀態、訂單統計
- **📋 叫貨單區塊**：
  - 依 (item_name, item_price) 聚合品項
  - 每品項列出點餐人姓名（同人多份顯示「王小明（2份）」）
  - 「複製為純文字」按鈕：產生格式化文字可貼進 LINE
  - 「列印」按鈕：列印時隱藏操作按鈕
- **訂單列表**：每筆訂單一張卡片，顯示員工/品項/小計
- **編輯 modal**：
  - 既有品項可改：品名 / 價格 / 數量 / 刪除
  - 從菜單選品項加入
  - 自訂品項（不在菜單上的，例：加價、補費用）
  - 必填修改原因
  - 取消整筆訂單按鈕
- 已調整訂單卡片底部顯示橘色提示橫幅（誰改的、什麼時候、原因）

**Server Actions**
- `adminUpdateOrder`：admin/orderer 可改任何訂單（不受 5 分鐘限制）
  - 用「先刪後插」更新 order_items，全部標 modified_at/by/reason
  - 必填修改原因
  - 重算 orders.total_amount
  - 場次取消時阻擋
- `adminCancelOrder`：標記訂單 status='cancelled'

**LIFF 顯示「已調整」**
- `/liff/today`、`/liff/orders/[id]`、`/liff/history` 三個頁面
- 訂單卡片有橘色「已調整」標籤
- 顯示修改原因 + 修改人 + 時間
- 員工看得到自己的單被怎麼調整的

**今日總覽連結**
- 每個 session 卡片底部新增「查看訂單明細與叫貨單 →」連結

**Bug 修復：Hydration mismatch**
- 全域把 `Intl.DateTimeFormat('zh-TW', ...)` 改為 `'en-US'`（共 8 處）
- 原因：Node.js (SSR) 與瀏覽器 (hydrate) 對 zh-TW 的時間格式輸出不一致（差全形空格 / 方向標記等不可見字元）
- 改為 en-US 兩邊都產出 `05/10 21:09` 一致格式，hydration 正常通過
- 影響範圍：原本「查看訂單明細與叫貨單」連結點下去看似沒反應，其實是 hydration error 把畫面 rollback。修完後正常導向

---

## 2026-05-10

### 新增功能：週結付款勾選 + LIFF 付款狀態顯示

**情境**：訂餐員每週五跟員工收完款後，需要在系統上勾選「已付清」；員工自己也要在 LIFF 看得到本週是否已付。

**決策**（使用者選擇）：
- Q1 誰可以勾選付款：admin + orderer（不含 accountant）
- Q2 標記時鎖定金額快照（避免後續訂單異動影響已付紀錄）
- Q3 支援查看過去週次的付款紀錄

**Schema 變更**（`0006_weekly_payments.sql`）：
- 新表 `weekly_payments`：employee_id (FK SET NULL) / employee_name (snapshot) / week_start / amount / paid_at / paid_by / note
- UNIQUE(employee_id, week_start)：同員工同週只能一筆
- RLS：admin/orderer/accountant 可讀；admin/orderer 可寫（per Q1）

**後台頁面**：`/admin/settlements`（新增到左側選單，admin + orderer）
- 上週/本週/下週切換按鈕（URL `?week=YYYY-MM-DD`）
- 列出本週每位員工的訂單筆數 + 累積金額 + 付款狀態
- 「標記已付」按鈕：自動帶入金額快照與標記人
- 「取消標記」按鈕：刪除付款紀錄
- 已付金額與目前累積不符時，顯示警告（可能是後續訂單異動）
- 統計卡：總人數 / 已付清 / 尚未付清

**員工 LIFF**（`/liff/history`）：
- 累積金額卡片下方加狀態橫幅：
  - 已付清：綠色 ✓ + 已收金額 + 收款人 + 時間
  - 未付清且金額 > 0：黃色 ⚠️ + 提醒週五繳付
- 已付金額與累積不符時也會顯示警告

**Bug 修復**：
- `lib/week.ts`：原本 `getMonFriOfWeekContaining` 用 Taipei timezone 解析輸入但用 UTC 拿 day-of-week → 在 GMT+8 環境會偏差一天，導致「下週」按鈕點下去 URL 變了但算出來是同一週。改成全程用 `Date.UTC` 處理，YYYY-MM-DD 純日期不混時區。
- 週查詢範圍從 Mon-Fri 改成 Mon-Sun（顯示仍是 Mon-Fri），讓週末意外送的訂單能正確歸入該週。

---

## 2026-05-10

### Phase 3 完成 ✅

**LIFF 員工點餐前端**

- `app/liff/layout.tsx`：手機優先版面（max-w-md 居中）
- `app/liff/page.tsx` + `IdentitySelector.tsx`：身份選擇頁
  - 下拉選名字 → 存 localStorage（key: `lunch.identity`）
  - 已選過：顯示歡迎卡 + 「開始點餐」/ 「我的訂單」/「切換身份」
  - 員工被刪除時自動清除 localStorage 並回選擇頁
- `app/liff/menu/page.tsx` + `MenuClient.tsx`：今日菜單
  - 撈今日所有 sessions（每 kind）+ 各自 vendor 的 active menu_items
  - 「🍱 吃的」/「🥤 喝的」tab **只切換顯示菜單**，購物車是統一的
  - tab 上有藍點提示對方分頁已加入東西
  - 底部浮動購物車按鈕：`🛒 N 項 NT$X`，展開顯示分組（吃的/喝的）+ 小計
  - 「送出」按鈕：依品項所屬廠商自動拆成 1-2 筆訂單寫入 DB
  - 顯示場次狀態：none / closed / cancelled（含原因）/ open
- `app/liff/menu/actions.ts`：`submitOrder` server action
  - 用 service_role 繞過 RLS，後端嚴格驗證：
    - 員工存在
    - 場次為 open
    - 品項屬於該場次廠商且 is_active
    - 數量為正整數
  - 寫入 `item_name` / `item_price` / `employee_name` 三組快照
  - 設 `editable_until = submitted_at + 5 分鐘`
  - 失敗時回滾（刪除剛插入的 order）
- `app/liff/today/page.tsx` + `TodayClient.tsx`：「我的訂單（今日）」頁
  - 黑色卡片顯示今日累積金額（已扣除 cancelled order/session）
  - 每筆訂單卡片獨立顯示：kind、廠商、品項、總計、狀態 badge
  - 5 分鐘可編輯時段：藍色倒數 + 「修改/取消」按鈕（連到詳細頁）
  - **Realtime 訂閱**：訂單/場次任何變動即時刷新
  - 部分送出失敗時透過 `?warn=` 帶警告訊息
- `app/liff/orders/[id]/page.tsx` + `OrderClient.tsx`：訂單詳細
  - 用 service_role 撈訂單（UUID 不可猜，後續操作再驗證 employee_id）
  - 5 分鐘倒數，每秒更新
  - 「修改訂單」modal：底部彈出菜單品項可加減 + 儲存
  - 「取消整筆訂單」確認後標記 status=cancelled
- `app/liff/orders/[id]/actions.ts`：`cancelOrder` / `updateOrderItems`
  - 後端驗證：員工 ID 對應、editable_until 未過、場次仍 open
  - 改 order_items 用「先刪後插」避免 unique 衝突
  - 重算 orders.total_amount
- `app/liff/history/page.tsx` + `HistoryClient.tsx`：本週訂單歷史
  - `lib/week.ts` getThisWeekMonFri：本週 Mon-Fri
  - 顯示本週累積 + 訂單列表（含 cancelled 標籤）
  - 點訂單可進詳細頁

**RLS 策略沒動**（一律由 LIFF actions 用 service_role 驗證+寫入）

**測試**（手動瀏覽器 + LIFF 模擬）
- ✅ 身份選擇 → localStorage → 自動帶入
- ✅ 兩個分類同時開單，兩個 tab 切換瀏覽
- ✅ 統一購物車：在不同 tab 加品項，底部累計、展開分組顯示
- ✅ 一次送出 → 自動拆成 2 筆訂單寫入
- ✅ 跳到 /liff/today，看到 2 張卡片獨立倒數
- ✅ 修改訂單 modal、取消訂單
- ✅ 後台 /admin Realtime 同步顯示訂單筆數/金額
- ✅ 本週訂單頁顯示累積金額

### 開發過程追加的設計變更

1. **統一購物車**（使用者反饋）：原本「吃的/喝的各自有購物車各自送出」改成「統一購物車一次送出，後端拆成 2 筆」。tab 只負責切換菜單顯示，購物車和送出按鈕都是共用的。
2. **新增 /liff/today 頁**：取代「送出後直接跳訂單詳細頁」的設計，因為一次送出可能產生 2 筆訂單，需要一個彙總頁顯示。

### 未完成（移到後面 Phase）

- [ ] LIFF SDK 真正初始化（要先建 LIFF Channel；本機 web 測試不需要）
- [ ] 部署到 Vercel + 把 LIFF endpoint URL 設成 Vercel 網址

---

## 2026-05-10

### 新增需求：週結（Mon-Fri）+ 一鍵複製 LINE 訊息

**情境**：使用者希望每週五下班前產出本週結算明細，貼進 LINE 群組統一通知大家付錢。

**決策**：
- 結算報表**預設區間改為「本週 Mon-Fri」**（規格書原本是 Mon-Sun，調整為實質工作週）
- Phase 5 加「一鍵複製成 LINE 訊息」按鈕，輸出純文字格式
- Phase 3 員工 LIFF 加「本週累積金額」即時顯示
- 自動寄信／LINE Bot 推播**不在本期範圍**（手動複製貼上即可滿足需求）

**Phase 3 / 5 待辦補充**：
- Phase 3：員工 LIFF 進入時顯示「本週你已點 NT$ XXX」+ 點擊看本週訂單明細
- Phase 5：報表頁預設「本週 Mon-Fri」，含「複製為 LINE 訊息」按鈕（格式如 `王小明 NT$ 320` 一行一人）

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
