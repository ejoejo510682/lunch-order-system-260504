# 交接文件（給新對話視窗用）

> 這份文件是給 Claude Code 在新對話開始時讀的快速狀態快照。  
> 同時請讀 `CLAUDE.md`、`SKILL.md`、`PROJECT_LOG.md` 補完整脈絡。
>
> **注意**：這份文件曾經停留在 2026-05-14 沒更新超過一個月（5/15～7/1 共 8 個 commit 沒記錄），
> 2026-07-28 已補齊。**PROJECT_LOG.md 目前只更新到 5/14**，5/15 之後的細節暫時只存在 git log 裡，
> 之後有空再回補（或至少每次做完事都先看 `git log --oneline --since=<PROJECT_LOG最後日期>` 抓漏）。

## 一、目前狀態（2026-07-28）

### 已部署上線
- 正式網址：https://lunch-order-system-260504.vercel.app
- 員工點餐：`/liff`
- 後台：`/admin`
- GitHub：https://github.com/ejoejo510682/lunch-order-system-260504（**public**）
- Supabase 專案：`fgveummzsitekqnclisf`
- 自動部署：push 到 main 後 Vercel 自動建置（~2 分鐘）
- Cron：用 Supabase **pg_cron** 每分鐘 UPDATE 過期 session（不是 Vercel Cron，因 Hobby 方案限制）

### 環境
- 本地：`C:\Users\Cynthia\Desktop\claude project\訂餐系統`
- Node.js v24.15.0（PATH 沒設好，用 `C:\Program Files\nodejs\npm.cmd` 完整路徑）
- 使用者環境：Windows 11、PowerShell ExecutionPolicy `RemoteSigned`
- `.env.local` 已含 Supabase URL/anon/service_role + CRON_SECRET（**.gitignore 排除**）

### 後台帳號
- 使用者：`ejoejo510682@gmail.com`（role: admin）
- 對應 Supabase Auth 用戶 + admin_users 表

---

## 二、已完成的功能（所有規格 + 追加）

### 規格 Phase 0-4 ✅
- 環境建置（Next.js 16.2.4 + Tailwind 4 + Supabase + LIFF SDK）
- 資料庫 8 份 migration 全跑過
- 後台登入 + 角色權限（admin/orderer/accountant）
- 廠商/菜單/員工 CRUD
- 開單/結單/取消整場 + Realtime
- LIFF 員工點餐（身份選擇、雙 tab、統一購物車、5 分鐘修改）
- 叫貨單 B 版 + 一鍵複製 LINE
- 訂單編輯 UI（admin/orderer 不受 5 分鐘限制）

### 規格外追加 ✅
1. **員工硬刪除**（不留 is_active）+ orders.employee_name 快照
2. **廠商分類「吃的/喝的」** vendor_kind enum
3. **場次取消**（必填原因，且取消後**可重新開單** — 5/19 追加）
4. **訂單修改追蹤**（modified_at/by/reason 三欄）
5. **週結付款勾選**（weekly_payments 表）+ LIFF 顯示「✓ 已付清」
6. **廠商菜單圖片**上傳 + LIFF 雙指縮放（react-zoom-pan-pinch）
7. **員工點餐備註欄**（order_items.note，每分類一個共用備註）
8. **後台手機 RWD**（hamburger drawer + 各頁手機友善）
9. **場次詳細頁顯示廠商備註**（黃色 header 橫幅 + 叫貨單區塊內橘色框 + 純文字輸出包含）
10. **LIFF 備註欄改可收合**（吃／喝兩格保留，預設不擋背景）
11. **LIFF「我的訂單」訂單卡整張可點 + 修改提示橫幅**
12. **週結頁「看明細」展開**（5/15）：每位員工可展開看本週逐筆訂單（日期/廠商/品項/備註）
13. **叫貨單「改價」一鍵批次改價**（5/15）：場次詳細頁每品項可一鍵改價 + 同步更新菜單（可選）+ 自動取消受影響員工的「已付清」標記
14. **場次未開單前可改廠商**（5/19）：進行中且無訂單時可換同類別廠商
15. **輸入欄位加深加粗**（5/19）：修手機 dark mode 看不清問題，並移除 dark mode CSS 覆寫（UI 統一淺色）
16. **後台帳號管理 + 到期日機制**（6/1，migration 0009）：`/admin/users`（admin 限定）— 新增/編輯/刪除帳號、密碼重設、到期日快捷延期（+7/+30 天等）、過期帳號自動擋登入。**取代原本手動 SQL 加帳號的方式，Phase 6 規格已完成**
17. **週結明細加「進入場次調整訂單」連結**（6/9）：從週結頁點明細可直接跳到該天場次頁改價/編輯
18. **拿掉結單功能**（7/1，重大流程變更）：場次開單後**不再有「結單」按鈕**、也拿掉「自動結單時間」設定，開單後永遠 open，要結束只能用「取消整場」。連動：LIFF 5 分鐘可修改的判斷從 `status==='open'` 放寬為 `status !== 'cancelled'`（代表被動結束/仍開著都能改）
19. **後台補單功能**（7/1）：場次詳細頁「+ 替員工新增訂單」— admin/orderer 可直接替員工加訂單，修改紀錄前綴 `[後台新增]`

### 未做（規格 Phase 5）⏳
- **Excel 匯出**（週結頁目前只有「複製為 LINE 訊息」，沒有 Excel）
- 月結 / 自訂區間報表（目前週結頁只支援週切換）
- **LIFF SDK 真正初始化**（要先建 LINE Channel；目前員工用網址訪問就好）
- 訂單歷史 / 雙拼價變動 / 季節限定自動隱藏等微調

### 需要注意的流程變化（7/1 之後）
- ⚠️ **系統已無「結單」概念**：場次一旦開單就是 open，直到「取消整場」。舊有文件／使用者手冊裡提到「結單」的段落已經過時，之後若使用者問起要說明現在的實際流程。
- Cron（Supabase pg_cron 每分鐘檢查 `auto_close_at`）理論上已經沒作用了，因為開單時 `auto_close` 固定寫 null，不會再有場次被自動關閉。**沒有拿掉這支 pg_cron job，只是不會再觸發**，之後可以問使用者要不要順手關掉這個排程（非急迫，純粹清理）。

---

## 三、資料庫狀態

### 9 份 migration（皆已在 Supabase 跑完）
```
0001 7 張表 + 3 enum + RLS 預備
0002 RLS 政策 + 4 個 helper 函式（is_admin / is_orderer_or_admin 等）
0003 order_items 加 modified_at/by/reason
0004 vendor_kind enum + vendors/sessions 加 kind + session_status 加 cancelled
0005 supabase_realtime publication 加 daily_sessions/orders/order_items
0006 weekly_payments 表
0007 vendors.menu_image_urls text[] + Storage bucket menu-images
0008 order_items 加 note
0009 admin_users 加 expires_at（帳號到期日機制，6/1）
```

### Storage
- bucket `menu-images`（public read，admin/orderer 寫）
- 已有部分廠商上傳圖片

### 已建廠商（截至 2026-05-13）
16 家：
1. 燒肉食客（吃）07-7778588 / 文龍東路670號
2. 時憶咖哩（吃）— 37 項
3. 蓁美味小館（吃）07-7335560 / 客家粄條
4. 一番鍋燒（吃）07-703-1111
5. 美山路便當（吃）07-7353504
6. 香檳燒肉飯（吃）07-7010477
7. 寶元小吃（吃）07-7015686, 07-7031366 — 97 項
8. 老虎蒸餃（吃）07-7012262
9. 8又8麵食館（吃）07-7010070
10. 帝王炒飯（吃）07-3653561
11. 麥當勞（吃）— 估價，請對照實體
12. 佳味燒肉飯（吃）07-7351616
13. 中都排骨飯（吃）07-7351781
14. 花好月圓（喝）07-7826940
15. 藍夏 Blue Shaker（喝）07-7820226 — 114 項（中/大）
16. 樂法（喝）— 58 項
17. Hold味手作茶飲（喝）07-7881615 — 65 項

### 員工
- 已清空（user 在 2026-05-13 跑 SQL 清測試資料）
- 待使用者透過 admin UI 加真實同事

---

## 四、使用者偏好（重要）

### 溝通
- **非工程背景**，用白話、舉例子、避免技術詞彙
- 中文回應
- 簡短直接，少廢話（user 在意 token 用量）
- 大段功能改動前**先確認**

### 開發節奏
- 每 Phase 結束做 commit + push
- 重要決策更新 PROJECT_LOG.md
- 不寫多行註解，只有「為什麼」需要說明的單行
- **不要建 README.md**（USER_GUIDE.md 已是員工版手冊）

### Git 規範
- Commit message 中文
- Co-Authored-By 不要加（除非要求）
- 使用者要求才 push

### 特殊技巧
- 在 Windows + Git Bash 環境：node/npm 沒在 PATH，要用 `C:\Program Files\nodejs\npm.cmd` 完整路徑（PowerShell tool）
- 中文資料夾名稱不能當 npm package name → repo 內 package.json 名稱叫 `lunch-order-system`

### Hydration
- 所有 `Intl.DateTimeFormat('zh-TW', ...)` 全改為 `'en-US'` 避免 SSR/CSR 不一致

---

## 五、近期工作脈絡

### 2026-05-10 ～ 05-14
1. 補了「員工備註欄」功能（0008 migration + 全套 UI）
2. UX 兩次迭代：原本每品項一個 note → 改成每分類一個共用 note，位置在送出按鈕上方，購物車預設展開
3. 16 家廠商菜單批次匯入（多數透過拍照 → 我讀照片產 SQL）
4. 部署到 Vercel（過程踩雷：Hobby Plan 不允許 private repo + 多 commit author，改成 public 才通過）
5. Cron 從 Vercel 改用 Supabase pg_cron
6. 5/13 使用者**第一次真實使用系統**訂餐，結單後發現漏單，手動 SQL 補單（這個痛點後來在 7/1 變成正式的「後台補單」功能）
7. 5/14 後台手機 RWD 全面改造 + 場次詳細頁顯示廠商備註 + LIFF 備註欄可收合
   - 踩雷：Claude 把改動寫到主目錄但 dev server 跑在 worktree，卡了一個多小時才發現 → 之後 Edit 優先用相對路徑，worktree 開 dev server 記得複製 `.env.local`

### 2026-05-15 ～ 05-19
- 週結頁加「看明細」展開（每員工本週逐筆訂單）
- 叫貨單加「改價」批次功能（一鍵改整場同品項價格，可選同步更新菜單，會自動取消受影響員工的已付清標記）
- 場次未開單前可改廠商（無訂單時才允許，避免菜單對不上）
- 場次取消後可重新開單
- 輸入欄位加深加粗（手機 dark mode 看不清的 bug）+ 移除 dark mode CSS override

### 2026-06-01：後台帳號管理上線
- migration 0009 加 `admin_users.expires_at`
- `/admin/users` 完整 CRUD + 到期日快捷延期，主要是為了**臨時人員交接**（到期自動失效，不用手動記得收回權限）
- 這代表規格書 Phase 6「後台帳號 CRUD」已經完成，不用再排進待辦

### 2026-06-09
- 週結明細加「進入場次調整訂單」連結，方便訂餐員從週結頁直接跳去改價/補單

### 2026-07-01：重大流程變更 — 拿掉結單
- 使用者反饋「結單」這個狀態在實際使用上造成困擾（可能是員工錯過時間改不了單，或訂餐員忘記結單），決定**整個拿掉**
- 開單後場次永遠是 open，沒有「結單」按鈕、沒有「自動結單時間」，要結束只能用「取消整場」
- 連動放寬：LIFF 端 5 分鐘可改單的判斷改成「場次沒被取消就能改」（不再要求 status==='open'）
- 同時上了「後台補單」：admin/orderer 可以直接在場次詳細頁替員工新增訂單（呼應 5/13 那次手動補單的痛點，現在有正式 UI 了）
- **這次改動沒有同步更新 PROJECT_LOG.md / HANDOFF.md**，是這次（7/28）回補的主因

---

## 六、新對話接手時建議

### 開始前一定先讀
1. `CLAUDE.md`（專案總覽 + Schema）
2. `SKILL.md`（開發守則）
3. 這份 `HANDOFF.md`（最新狀態）
4. `PROJECT_LOG.md`（時序紀錄，最新在最上面）

### 不一定要每次都讀
- `AGENTS.md`（Next.js 16 提醒，已內化）
- `USER_GUIDE.md`（員工版手冊）
- 各 migration SQL（除非要再改 schema）

### 接下來可能會做的事
- Excel 匯出（Phase 5 剩下唯一沒做的部分；週結頁複製 LINE 訊息已經做了）
- 加更多廠商菜單（使用者透過拍照）
- 微調 UX（看實際使用後反饋）
- 處理真實營運中遇到的特殊情況（現在有補單功能可以直接處理，不用再手動下 SQL）
- 順手確認一下 Supabase pg_cron 的「auto-close-sessions」排程要不要關掉（拿掉結單功能後這支已經沒作用了）

### 工具提醒
- `WebFetch` 抓 Foodpanda/麥當勞會被 403 擋下，問使用者要截圖
- 開 dev server 用 PowerShell + `npm.cmd run dev`
- 改 schema 後要告訴使用者去 SQL Editor 跑

---

## 七、關鍵指令／網址速查

```bash
# 啟動 dev server（PowerShell）
$env:Path = "C:\Program Files\nodejs;" + $env:Path
& "C:\Program Files\nodejs\npm.cmd" run dev

# Commit + push
git add -A
git commit -m "..."
git push   # 自動觸發 Vercel 部署

# 查近期 commits
git log --oneline -10
```

| 連結 | 用途 |
|------|------|
| https://lunch-order-system-260504.vercel.app | 正式環境 |
| https://lunch-order-system-260504.vercel.app/admin | 後台 |
| https://lunch-order-system-260504.vercel.app/liff | 員工點餐 |
| https://supabase.com/dashboard/project/fgveummzsitekqnclisf | Supabase |
| https://vercel.com/ejoejo510682s-projects/lunch-order-system-260504 | Vercel |
| https://github.com/ejoejo510682/lunch-order-system-260504 | GitHub repo |

---

最後更新：2026-07-28
