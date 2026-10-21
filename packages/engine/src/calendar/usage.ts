import { formatYmd } from "../math/dates.js";
import { daysInMonth } from "../math/units.js";
import type { ScheduleTemplate } from "../types.js";
import { expandMonth } from "./expand.js";

export interface UsageMeasures {
  weeklyBaselineUnits: number;
  calendarMinutes: number;
  monthlyWholeUnits: number;
  monthEndRemainderMinutes: number;
}

/** F-6: usage measures, kept as separate figures. */
export function usageMeasures(template: ScheduleTemplate, months: string[]): UsageMeasures {
  const weeklyMinutes = template.entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const weeklyBaselineUnits = Math.floor(weeklyMinutes / 15) * 52;

  let calendarMinutes = 0;
  let monthlyWholeUnits = 0;
  let monthEndRemainderMinutes = 0;

  for (const month of months) {
    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const monthNum = Number(monthStr);
    const first = formatYmd(year, monthNum, 1);
    const last = formatYmd(year, monthNum, daysInMonth(year, monthNum));
    const expanded = expandMonth(template, [], year, monthNum, first, last);
    const monthMinutes = Object.values(expanded).reduce(
      (sum, day) => sum + Object.values(day).reduce((s, m) => s + m, 0),
      0,
    );
    calendarMinutes += monthMinutes;
    monthlyWholeUnits += Math.floor(monthMinutes / 15);
    monthEndRemainderMinutes += monthMinutes % 15;
  }

  return { weeklyBaselineUnits, calendarMinutes, monthlyWholeUnits, monthEndRemainderMinutes };
}
