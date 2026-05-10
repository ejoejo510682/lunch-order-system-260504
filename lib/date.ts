// 訂餐系統使用台北時區作為「今日」基準
const TIMEZONE = 'Asia/Taipei';

// 取台北時區的今日日期 (YYYY-MM-DD)
export function getTodayInTaipei(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

// 把 "10:30" 等時間字串轉成今日台北時區的 ISO timestamp（給 Postgres 用）
export function buildTodayTimestamp(hhmm: string): string {
  const date = getTodayInTaipei();
  return `${date}T${hhmm}:00+08:00`;
}
