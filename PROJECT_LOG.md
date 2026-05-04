# 開發進度與決策記錄

> 每完成一個小步驟、每做一個決策，就在這裡新增一筆。新項目放最上面（倒序）。

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
