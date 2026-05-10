import { getTodayInTaipei } from './date';

// 週結期間：本週的週一到週五（台北時區）
// 範例：今天是 2026/05/12 (週二) → { start: '2026-05-11', end: '2026-05-15' }
export function getThisWeekMonFri(): { start: string; end: string } {
  const todayStr = getTodayInTaipei();
  const today = new Date(todayStr + 'T00:00:00+08:00');

  // JS getDay(): 週日=0, 週一=1, ..., 週六=6
  const dayOfWeek = today.getDay();
  // 換算到「本週週一」要往前幾天
  // 週日=0 → 往前 6 天到上週一；其他 → 往前 (dayOfWeek - 1) 天
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return {
    start: formatDate(monday),
    end:   formatDate(friday),
  };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
