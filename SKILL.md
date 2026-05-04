# 本專案開發守則 (For Claude Code)

> 這份文件是 Claude Code 開發本專案時必須遵守的規則。每次對話開始前先讀過。

## 一、溝通原則

- **使用者非程式背景**，回覆時：
  - 用中文，避免艱深的技術術語
  - 解釋要白話、用比喻、舉例子
  - 不要假設使用者懂 Git / SQL / API / Schema
- **每個決策先確認**，不要直接實作大段功能
- **每個 Phase 結束做一次 Git commit**，並提示使用者 push

## 二、開發節奏

1. **先做能跑的最小版本**：廠商 → 菜單 → 點餐 → 看到訂單
2. 之後再回頭加：結算、權限、報表、Realtime
3. 每完成一個小步驟（不是 Phase）就更新 `PROJECT_LOG.md`
4. 每次對話開始先讀：`CLAUDE.md` + `PROJECT_LOG.md`（看上次做到哪）

## 三、資料庫鐵則

### 快照欄位（snapshot columns）
凡是與「歷史資料正確性」有關的欄位都用快照：
- `order_items.item_name` / `item_price` — 菜單改價不影響舊單
- `orders.employee_name` — 員工被刪除仍保留訂單姓名

**寫入時機**：下單那一刻，從來源表（menu_items / employees）讀當下值，複製到 orders/order_items。
**之後不再變動**（即使來源表改了）。

### Foreign Key 設定
- `orders.employee_id` → `employees.id` ：**ON DELETE SET NULL**（員工被刪不影響訂單）
- `order_items.menu_item_id` → `menu_items.id` ：**ON DELETE SET NULL**（菜單品項被刪也不影響歷史）
- `orders.session_id` → `daily_sessions.id` ：**ON DELETE RESTRICT**（不可刪除有訂單的 session）
- `daily_sessions.vendor_id` → `vendors.id` ：**ON DELETE RESTRICT**

### RLS (Row Level Security)
- **所有表都啟用 RLS**
- 員工端（LIFF）只透過 anon key 讀公開資料（vendor、menu、employees 名單）
- 後台透過 Supabase Auth + role 判斷可寫入的範圍
- 寫入訂單時用 service role key（從 API Routes 後端代寫，不暴露給前端）

## 四、安全鐵則

### 5 分鐘可修改驗證
- 前端倒數計時只是 UX，**後端 API 必須驗證 `editable_until > now()`**
- 攻擊者可繞過前端直接打 API → 後端要檔下來

### 環境變數
- 所有 API key 放 `.env.local`，**不可 commit 到 git**（`.gitignore` 必含）
- Supabase service role key 只能在後端 API Routes 用，**絕不暴露給前端**
- 上 Vercel 時把 env vars 放 Vercel 後台

### 員工身份（第一階段）
- 第一階段用 LINE userId + 下拉選單，**沒有密碼驗證**
- 因此員工端 API 不應允許「以任意 employee_id 下單」之外的危險操作
- 員工只能：讀今日菜單、下自己的單、改／取消自己 5 分鐘內的單
- 任何「看別人訂單」「改別人訂單」必須經後台

## 五、檔案結構規範

```
/app
  /api/...           ← 所有後端邏輯，不要在 client component 直接寫資料庫
  /admin/...         ← 後台頁面，layout 內驗證登入 + role
  /liff/...          ← LIFF 員工端，layout 內初始化 LIFF SDK
/lib
  /supabase
    client.ts        ← 給 client component 用（anon key）
    server.ts        ← 給 API Routes 用（service role key）
  /auth
    requireRole.ts   ← 中介層，檢查後台使用者 role
/components/ui       ← 純 UI 元件（按鈕、表格、Modal）
/components/admin    ← 後台專用元件
/components/liff     ← LIFF 專用元件
/supabase
  /migrations        ← 每次 schema 改動建一個 .sql 檔
```

## 六、Git 規範

- 每個 Phase 結束 commit 一次（最小單位）
- 重要決策變更也獨立 commit
- Commit message 用中文，格式：
  ```
  Phase X: 簡短描述

  - 細節 1
  - 細節 2
  ```
- 使用者要求才 push，不要自動 push

## 七、UI/UX 原則

- 員工端（LIFF）優先**手機版面**，按鈕大、字大
- 後台桌機優先，但不要破壞手機可讀
- Tailwind 用 mobile-first 原則
- 所有金額顯示加 `NT$` 前綴，整數
- 日期顯示用 `YYYY/MM/DD`，時間用 `HH:mm`
- 訂單狀態用顏色：
  - 進行中：藍色
  - 已結單：灰色
  - 取消：紅色

## 八、不要做的事

- ❌ 不要為了「未來可能用到」加欄位／加表
- ❌ 不要寫過度抽象的 helper / 通用元件（先重複，三次以上才抽）
- ❌ 不要加 try/catch 包裹「不可能失敗」的程式碼
- ❌ 不要在 commit 訊息加「Generated with Claude」「Co-Authored-By」（除非使用者要求）
- ❌ 不要建立 README.md（CLAUDE.md 已足夠）
- ❌ 不要寫多行註解。必要的單行註解只解釋 **為什麼**，不解釋 **做什麼**

## 九、測試原則

- 第一階段不寫單元測試（成本高，使用者不熟）
- 每個 Phase 結束**手動測試**主要流程，並寫進 PROJECT_LOG.md
- Phase 6 才開始考慮加 E2E 測試
