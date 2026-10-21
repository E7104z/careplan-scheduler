import { MO_2026_07 } from "../rulepacks/mo-2026-07.js";
import { daysInMonth, weekdayOf } from "./dates.js";

export type DaysPerWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** F-1: days-per-month factor from the effective rule pack. */
export function factorFor(daysPerWeek: DaysPerWeek): number {
  return MO_2026_07.daysPerMonthFactor[daysPerWeek];
}

/** F-1: the largest sum of the k highest weekday occurrence counts in a month. */
export function maxWeekdayOccurrences(year: number, month: number, k: number): number {
  const counts: number[] = [0, 0, 0, 0, 0, 0, 0];
  const days = daysInMonth(year, month);
  for (let d = 1; d <= days; d++) {
    const idx = weekdayOf(year, month, d);
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  const sorted = [...counts].sort((a, b) => b - a);
  let sum = 0;
  for (let i = 0; i < k; i++) {
    sum += sorted[i] ?? 0;
  }
  return sum;
}
