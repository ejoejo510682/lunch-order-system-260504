import { getTodayInTaipei } from './date';

// 週結期間：本週的週一到週五（台北時區）
// 範例：今天是 2026/05/12 (週二) → { start: '2026-05-11', end: '2026-05-15' }
export function getThisWeekMonFri(): { start: string; end: string } {
  return getMonFriOfWeekContaining(getTodayInTaipei());
}

// 給任意日期（YYYY-MM-DD），回傳該日期所屬週的 Mon-Fri
export function getMonFriOfWeekContaining(ymd: string): { start: string; end: string } {
  const [y, m, d] = ymd.split('-').map(Number);
  // 用 Date.UTC 建構，全程當作 UTC 午夜處理，避免時區轉換干擾
  const date = new Date(Date.UTC(y, m - 1, d));

  // getUTCDay(): 週日=0, 週一=1, ..., 週六=6
  const dow = date.getUTCDay();
  const daysToMon = dow === 0 ? 6 : dow - 1;

  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - daysToMon);

  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);

  return {
    start: toYMD(monday),
    end:   toYMD(friday),
  };
}

// 把週起算日加減 N 週
export function shiftWeek(weekStart: string, weeks: number): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + weeks * 7);
  return toYMD(dt);
}

function toYMD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
