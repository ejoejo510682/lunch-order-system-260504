# 公司內部訂餐系統 (Lunch Order System)

> 本檔提供給 Claude Code 在每次新對話開始時閱讀，建立對專案的整體理解。

@AGENTS.md
@SKILL.md

## 一、專案目標

公司內部員工訂餐系統：
- **員工端**：透過 LINE LIFF 在手機上點餐
- **後台**：網頁介面供管理員處理菜單、彙整訂單、產生叫貨單與結算報表

## 二、角色

| 角色 | 職責 |
|------|------|
| 員工 (employee) | 透過 LINE LIFF 點餐 |
| 管理員 (admin) | 所有權限，含人員與後台帳號管理 |
| 訂餐員 (orderer) | 每日選廠商、開單／結單、產生叫貨單 |
| 會計 (accountant) | 查看結算報表、匯出收費資料 |

## 三、技術棧

| 層級 | 技術 |
|------|------|
| 前端 + 後台 | Next.js + Tailwind CSS（部署 Vercel） |
| 後端 API | Next.js API Routes |
| 資料庫 | Supabase (PostgreSQL) |
| 認證 | Supabase Auth (Email + 密碼) |
| 員工身份 | LINE LIFF（第一階段：下拉選單選名字 + localStorage） |
| 排程 | Vercel Cron Jobs（自動結單） |

預估月成本：NT$0

## 四、資料庫 Schema 摘要（共 7 張表）

> 完整欄位以 Supabase migration 檔為準，此處列出設計重點。

1. **vendors**（廠商）— id / name / phone / note / is_active / created_at
2. **menu_items**（菜單品項）— id / vendor_id (FK) / name / price / is_active / sort_order
3. **employees**（員工）— id / name / line_user_id (nullable，第二階段用)
   - ⚠️ **不含 is_active**，員工可由管理員直接刪除
4. **daily_sessions**（每日訂餐場次）— id / order_date / vendor_id / status (open/closed) / auto_close_at / closed_at / created_by
5. **orders**（訂單主表）— id / session_id / **employee_id (nullable)** / **employee_name (快照)** / total_amount / status (submitted/cancelled) / submitted_at / editable_until
6. **order_items**（訂單明細）— id / order_id / menu_item_id / **item_name (快照)** / **item_price (快照)** / quantity
7. **admin_users**（後台帳號）— id (對應 Supabase Auth) / email / name / role (admin/orderer/accountant)

### 關鍵設計決策

- **快照欄位**（`employee_name` / `item_name` / `item_price`）：下單當下複製當時的值到訂單，從此不變動。即使菜單改價或員工被刪除，歷史訂單金額與姓名仍正確。
- **daily_sessions**：集中控制每日廠商選擇與開單／結單狀態，避免同日多廠商混雜。
- **5 分鐘可修改**：送出時寫入 `editable_until = submitted_at + 5 分鐘`。前端倒數，**後端 API 必須驗證**（防止繞過前端直接打 API）。
- **自動結單**：Vercel Cron Jobs 每分鐘檢查 `auto_close_at <= now() AND status='open'` 的 session。
- **一個員工一天可下多筆 orders**（每筆獨立顯示）。

## 五、頁面與流程

### A. 員工端（LINE LIFF）

1. **身份選擇**：下拉選全部員工 → 存 localStorage（可切換）
2. **今日菜單**：顯示今日 session 廠商與品項，點擊加減數量
3. **訂單確認**：顯示明細 + 5 分鐘倒數（可修改／取消）
4. **訂單歷史**（可選）：自己的歷史訂單與累積金額

### B. 後台（網頁）

1. **登入**（Email + 密碼）
2. **今日總覽（首頁）**：session 狀態、開單／結單、即時訂單列表、即時統計
3. **廠商與菜單管理**：CRUD + 拖曳排序
4. **員工管理**：CRUD（admin 限定，含刪除）
5. **叫貨單**（B 版格式：每品項列出點餐員工姓名）+ 複製／列印
6. **結算報表**：週／月／自訂區間，每員工累積金額，匯出 Excel
7. **後台帳號管理**（admin 限定）

### 權限矩陣

| 功能 | admin | orderer | accountant |
|------|:-----:|:-------:|:----------:|
| 廠商／菜單管理 | ✅ | ✅ | ❌ |
| 員工名單管理 | ✅ | ❌ | ❌ |
| 後台帳號／權限管理 | ✅ | ❌ | ❌ |
| 開單／選廠商／結單 | ✅ | ✅ | ❌ |
| 即時訂單彙整 | ✅ | ✅ | ❌ |
| 產生叫貨單 | ✅ | ✅ | ❌ |
| 結算報表（週／月） | ✅ | ❌ | ✅ |
| 匯出 Excel | ✅ | ❌ | ✅ |

## 六、檔案結構

```
/app
  /api          ← API Routes（後端）
  /admin        ← 後台頁面
  /liff         ← LINE LIFF 員工端
/lib
  /supabase     ← DB client
  /auth         ← 權限驗證
/components     ← UI 元件
/supabase
  /migrations   ← 資料庫 schema 版本
```

## 七、開發路線圖

| Phase | 內容 | 估時 |
|-------|------|------|
| 0 | 環境建置（Next.js + Supabase + LIFF + Vercel） | 0.5 天 |
| 1 | 資料表 + RLS + 後台登入 + 廠商／菜單／員工管理 | 2-3 天 |
| 2 | 開單／結單 + 即時訂單總覽（Supabase Realtime）+ Cron 自動結單 | 2 天 |
| 3 | LIFF 員工端（身份選擇、菜單、送出、5 分鐘修改、訂單歷史） | 3 天 |
| 4 | 叫貨單（B 版）+ 複製／列印 + 即時統計 | 1-2 天 |
| 5 | 週／月報表 + 個人累積 + Excel 匯出 | 1-2 天 |
| 6 | 後台帳號 CRUD + 權限測試 + UAT | 1 天 |

**總工期估計：10-13 個工作天**（使用者非程式背景，實際會更長，建議分階段測試）

## 八、不在本期範圍

- LINE Bot 推播
- 自動產生付款 QR Code
- 員工請假／外勤不訂餐
- 廠商評分與評論
- 我的常點

## 九、配套文件

- **PROJECT_LOG.md**：開發進度與決策記錄（每完成一個小步驟就更新）
- **SKILL.md**：本專案專屬的開發守則（Claude Code 必讀）

## 十、GitHub Repo

https://github.com/ejoejo510682/lunch-order-system-260504.git
