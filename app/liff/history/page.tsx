import { HistoryClient } from './HistoryClient';

// 員工身份來自 localStorage（前端讀），server 不知道是誰，所以這頁主要是 client component。
// 實際資料在 client 用 server action 取（驗證 employeeId）。
export default function HistoryPage() {
  return <HistoryClient />;
}
