import { daysFromCivil, daysInMonth, parseYmd, weekdayOf, ymdFromDays } from "../math/dates.js";
import { rollingWindows, sundayWeeks } from "../calendar/weeks.js";
import type { ValidationResult } from "../types.js";

/** CON-09 limit groups: ILW alone; Respite Basic and Advanced combined. */
export type WeeklyHourGroup = "ILW" | "RESPITE";

const LIMIT_MINUTES = 49 * 60;

/** "52 h 30 min", "49 h". */
function hoursText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The first entry with the most minutes. */
function highest<T extends { minutes: number }>(items: T[]): T | undefined {
  return items.reduce<T | undefined>((best, item) => (best === undefined || item.minutes > best.minutes ? item : best), undefined);
}

/**
 * True when every way of reading "the week" puts some week over 49 hours: for each of the seven
 * possible first days, some seven days starting on that weekday, inside one calendar month (so
 * the open question of how a week crossing a month or year end is counted can't matter), hold
 * more than 49 hours.
 */
function overInEveryReading(dailyMinutes: Record<string, number>): boolean {
  const byDay = new Map<number, number>();
  for (const [date, minutes] of Object.entries(dailyMinutes)) {
    const { year, month, day } = parseYmd(date);
    const z = daysFromCivil(year, month, day);
    byDay.set(z, (byDay.get(z) ?? 0) + minutes);
  }
  const days = [...byDay.keys()];
  if (days.length === 0) return false;
  const first = Math.min(...days);
  const last = Math.max(...days);
  const overByWeekday = new Set<number>();
  for (let start = first - 6; start <= last; start++) {
    const { year, month, day } = ymdFromDays(start);
    if (day + 6 > daysInMonth(year, month)) continue;
    let minutes = 0;
    for (let offset = 0; offset < 7; offset++) minutes += byDay.get(start + offset) ?? 0;
    if (minutes > LIMIT_MINUTES) overByWeekday.add(weekdayOf(year, month, day));
  }
  return overByWeekday.size === 7;
}

/**
 * @rule CON-09
 * @source HCBS 06-26-01; Policy 3.50 (rev. Jul 2026); which seven days make the week is open (audit E-02)
 *
 * ILW, and Basic and Advanced Respite combined, are limited to 49 hours a week, but DHSS hasn't
 * confirmed which seven days make the week (E-02). So any scheduled time gets one REVIEW that
 * shows both diagnostics (the highest Sunday-Saturday week and the highest rolling 7-day
 * stretch); neither picks the week, and passing both never clears the REVIEW. Only a schedule
 * over 49 hours whichever day the week starts on, inside one month, is BLOCK. The BLOCK message
 * holds no figures, so a plan that is already over can still be lowered (APP-SPEC 5.7).
 */
export function ruleCON09WeeklyHours(
  dailyMinutes: Record<string, number>,
  scope?: { participantId: string; group: WeeklyHourGroup },
): ValidationResult[] {
  const scheduled = Object.fromEntries(Object.entries(dailyMinutes).filter(([, minutes]) => minutes > 0));
  const week = highest(sundayWeeks(scheduled));
  const stretch = highest(rollingWindows(scheduled));
  if (!week || !stretch) return [];
  const prefix = scope ? `${scope.participantId} ${scope.group}: ` : "";
  const refs = scope ? { participantId: scope.participantId } : {};
  const results: ValidationResult[] = [];
  if (overInEveryReading(scheduled)) {
    results.push({
      ruleId: "CON-09",
      severity: "BLOCK",
      message: `${prefix}Over 49 h in every reading of the week, whichever day it starts on`,
      refs,
    });
  }
  results.push({
    ruleId: "CON-09",
    severity: "REVIEW",
    message:
      `${prefix}Highest Sunday-Saturday week ${hoursText(week.minutes)} (week of ${week.weekStart}); ` +
      `highest 7-day stretch ${hoursText(stretch.minutes)} (${stretch.start} to ${stretch.end})`,
    refs,
  });
  return results;
}
