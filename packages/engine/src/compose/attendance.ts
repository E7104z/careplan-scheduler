import { sundayWeeks } from "../calendar/weeks.js";
import type { AdcAttendance, ValidationResult } from "../types.js";

/** The adult day care caps: WS-R08's three caps plus the daily transport part (ADW-03). */
export interface AdcLimits {
  minuteStep: number;
  maxMinutesPerDay: number;
  maxDaysPerWeek: number;
  maxTransportMinutesPerDay: number;
}

/** One calendar day of adult day care attendance, summed across the day's events. */
export interface AdcDay {
  date: string;
  minutes: number;
  transportMinutes: number;
}

/**
 * Sum dated adult day care attendance into one entry per calendar day, in date order
 * (ADW-03). Attendance stays as dated records; this aggregates them for the caps, it never
 * turns them into weekly task units.
 * @rule ADW-03
 * @source HCBS Manual 4.00 Appendix 3 (rev. May 2025), Adult Day Care
 */
export function adcDayTotals(attendances: readonly AdcAttendance[]): AdcDay[] {
  const byDate = new Map<string, AdcDay>();
  for (const attendance of attendances) {
    const day = byDate.get(attendance.date) ?? { date: attendance.date, minutes: 0, transportMinutes: 0 };
    day.minutes += attendance.minutes;
    day.transportMinutes += attendance.transportMinutes;
    byDate.set(attendance.date, day);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Adult day care attendance caps (ADW-03): minutes a day in 15-minute steps at most
 * `maxMinutesPerDay`, at most `maxDaysPerWeek` days a Sunday–Saturday week, and the transport
 * part at most `maxTransportMinutesPerDay` a day. The first three caps reuse WS-R08's limits;
 * the transport cap is the ADW ADC limit from the manual. Never computed on weekly task units.
 * @rule ADW-03
 * @source HCBS Manual 4.00 Appendix 3 (rev. May 2025), Adult Day Care; 3.00 Adult Day Care (300-available-home-and-community-based-6): ≤120 minutes/day transportation
 */
export function adcAttendanceChecks(
  attendances: readonly AdcAttendance[],
  limits: AdcLimits,
): ValidationResult[] {
  const days = adcDayTotals(attendances);
  const results: ValidationResult[] = [];

  for (const day of days) {
    if (day.minutes % limits.minuteStep !== 0 || day.minutes > limits.maxMinutesPerDay) {
      results.push({
        ruleId: "WS-R08",
        severity: "BLOCK",
        message: `Enter adult day care in ${limits.minuteStep}-minute steps, at most ${limits.maxMinutesPerDay / 60} hours a day and ${limits.maxDaysPerWeek} days a week.`,
        refs: { date: day.date },
      });
    }
    if (day.transportMinutes > limits.maxTransportMinutesPerDay) {
      results.push({
        ruleId: "WS-R08",
        severity: "BLOCK",
        message: `Adult day care transportation is limited to ${limits.maxTransportMinutesPerDay} minutes a day.`,
        refs: { date: day.date },
      });
    }
  }

  // Distinct days per Sunday–Saturday week (CON-09): each day counts as 1, so sundayWeeks'
  // per-week "minutes" field is the number of attendance days.
  const daily: Record<string, number> = {};
  for (const day of days) daily[day.date] = 1;
  for (const { weekStart, minutes: dayCount } of sundayWeeks(daily)) {
    if (dayCount > limits.maxDaysPerWeek) {
      results.push({
        ruleId: "WS-R08",
        severity: "BLOCK",
        message: `Enter adult day care at most ${limits.maxDaysPerWeek} days a week.`,
        refs: { date: weekStart },
      });
    }
  }

  return results;
}
