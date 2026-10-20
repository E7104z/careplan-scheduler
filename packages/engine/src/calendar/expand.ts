import { daysInMonth, formatYmd, weekdayOf } from "../math/dates.js";
import type { CalendarException, ScheduleTemplate } from "../types.js";

/** number[7] of weekday counts, Sunday index 0. */
export function weekdayCounts(year: number, month: number): number[] {
  const days = daysInMonth(year, month);
  const counts: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (let d = 1; d <= days; d++) {
    const idx = weekdayOf(year, month, d);
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return counts;
}

/**
 * Expand a template and exceptions onto every date of a month inside [validFrom, validTo].
 * Returns Record<date, Record<taskId, minutes>>; exceptions apply minutesDelta, never below 0.
 */
export function expandMonth(
  template: ScheduleTemplate,
  exceptions: CalendarException[],
  year: number,
  month: number,
  validFrom: string,
  validTo: string,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  const days = daysInMonth(year, month);

  for (let d = 1; d <= days; d++) {
    const date = formatYmd(year, month, d);
    if (date < validFrom || date > validTo) continue;
    const weekday = weekdayOf(year, month, d);
    const dayMap: Record<string, number> = {};
    for (const entry of template.entries) {
      if (entry.weekday === weekday) {
        dayMap[entry.taskId] = (dayMap[entry.taskId] ?? 0) + entry.minutes;
      }
    }
    result[date] = dayMap;
  }

  for (const ex of exceptions) {
    const [y, m] = ex.date.split("-").map((n) => Number(n));
    if (y !== year || m !== month) continue;
    if (ex.date < validFrom || ex.date > validTo) continue;
    const dayMap = result[ex.date] ?? (result[ex.date] = {});
    dayMap[ex.taskId] = Math.max(0, (dayMap[ex.taskId] ?? 0) + ex.minutesDelta);
  }

  return result;
}

/** Sum expanded minutes per task id. */
export function monthTaskMinutes(expanded: Record<string, Record<string, number>>): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const day of Object.values(expanded)) {
    for (const [taskId, minutes] of Object.entries(day)) {
      totals[taskId] = (totals[taskId] ?? 0) + minutes;
    }
  }
  return totals;
}
