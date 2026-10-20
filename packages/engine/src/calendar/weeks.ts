import { daysFromCivil, parseYmd, weekdayOf, ymdFromDays } from "../math/dates.js";
import { formatYmd } from "../math/dates.js";

export interface WeekWindow {
  weekStart: string;
  minutes: number;
}

export interface RollingWindow {
  start: string;
  end: string;
  minutes: number;
}

/** F-9: Sunday–Saturday week totals (do not reset at month/year boundaries). */
export function sundayWeeks(dailyMinutes: Record<string, number>): WeekWindow[] {
  const byWeek = new Map<string, number>();
  for (const [date, minutes] of Object.entries(dailyMinutes)) {
    const { year, month, day } = parseYmd(date);
    const z = daysFromCivil(year, month, day);
    const sunday = ymdFromDays(z - weekdayOf(year, month, day));
    const key = formatYmd(sunday.year, sunday.month, sunday.day);
    byWeek.set(key, (byWeek.get(key) ?? 0) + minutes);
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, minutes]) => ({ weekStart, minutes }));
}

/** F-9: every rolling 7-day window over the observed dates. */
export function rollingWindows(dailyMinutes: Record<string, number>): RollingWindow[] {
  const entries = Object.entries(dailyMinutes).sort((a, b) => a[0].localeCompare(b[0]));
  const windows: RollingWindow[] = [];
  for (const [startDate] of entries) {
    const { year, month, day } = parseYmd(startDate);
    const startZ = daysFromCivil(year, month, day);
    const endZ = startZ + 6;
    const end = ymdFromDays(endZ);
    let minutes = 0;
    for (const [date, m] of entries) {
      const z = daysFromCivil(parseYmd(date).year, parseYmd(date).month, parseYmd(date).day);
      if (z >= startZ && z <= endZ) minutes += m;
    }
    windows.push({
      start: startDate,
      end: formatYmd(end.year, end.month, end.day),
      minutes,
    });
  }
  return windows;
}
