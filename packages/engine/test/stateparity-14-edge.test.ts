import { describe, expect, it } from "vitest";
import { calculate14, type Hcbs14Input, type Hcbs14Result } from "../src/index.js";

/**
 * Hand-computed edge cases for the DHSS 14a/14b parity surface (`calc14.ts`). The case-01 golden
 * fixture holds the state's own numbers; these cover the remaining worksheet edges the workbook
 * analysis called out. Every expected value below is derived from the worksheet formulas, not from
 * the engine:
 *
 * - D7 (timesPerWeek) = COUNTA(E7:K7): every weekday entry counts, a 0-minute entry included.
 * - L (weeklyMinutes) = sum of the weekday minutes.
 * - M7 (units31d)     = F-2b = trunc(weeklyMinutes / timesPerWeek / 15 x F1 + 0.99), where F1 is the
 *                       days-per-month factor {1:5, 2:10, 3:15, 4:19, 5:23, 6:27, 7:31}.
 * - 12-month projection (D37:O37): 7-day tasks prorate by the real days in the month (F-3
 *                       "short-month"); every other frequency uses the constant F-2b figure.
 * - Example Month: each task's weekday minutes x the month's weekday counts, summed; then
 *                       units = floor(minutes / 15), remainder = minutes % 15.
 */

/** The 12 projection months for a constant (non-7-day) figure: one key per month from startDate. */
function constantMonths(startDate: string, units: number): Record<string, number> {
  const [y, m] = startDate.split("-").map((n) => Number(n));
  const months: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    const year = y! + Math.floor((m! - 1 + i) / 12);
    const month = ((m! - 1 + i) % 12) + 1;
    months[`${year}-${String(month).padStart(2, "0")}`] = units;
  }
  return months;
}

describe("HCBS 14a/14b parity edge cases (hand-computed)", () => {
  it("prorates a 7-day task in a 28-day February", () => {
    const input: Hcbs14Input = {
      startDate: "2026-02-01",
      exampleMonth: "2026-02",
      tasks: [{ row: 7, name: "Seven-day 30min", minutesByDay: { Sun: 30, Mon: 30, Tue: 30, Wed: 30, Thu: 30, Fri: 30, Sat: 30 } }],
    };
    // February 2026 is 28 days: each weekday occurs 4 times (7 x 4 x 30 = 840 minutes).
    // F-2b on the 31-day basis: trunc(210 x 31 / 105 + 0.99) = 62.
    // F-3 short-month for February: trunc(210 x 28 / 105 + 0.99) = 56.
    const expected: Hcbs14Result = {
      perTask: [{ row: 7, name: "Seven-day 30min", timesPerWeek: 7, weeklyMinutes: 210, units31d: 62 }],
      daily: { dailyMinutes: [30, 30, 30, 30, 30, 30, 30], dailyUnits: [2, 2, 2, 2, 2, 2, 2], dailyRemainder: [0, 0, 0, 0, 0, 0, 0], weeklyUnits: 14, weeklyAccrual: 0 },
      monthlyUnits: {
        "2026-02": 56, "2026-03": 62, "2026-04": 60, "2026-05": 62, "2026-06": 60, "2026-07": 62,
        "2026-08": 62, "2026-09": 60, "2026-10": 62, "2026-11": 60, "2026-12": 62, "2027-01": 62,
      },
      twelveMonthTotal: 730,
      baseline52wk: 728,
      exampleMonth: { weekdayCounts: [4, 4, 4, 4, 4, 4, 4], taskMonthMinutes: [840], monthMinutes: 840, monthUnits: 56, monthRemainder: 0 },
    };
    expect(calculate14(input)).toEqual(expected);
  });

  it("uses the 6-day factor (27) and keeps it constant across months", () => {
    const input: Hcbs14Input = {
      startDate: "2026-07-01",
      exampleMonth: "2026-07",
      tasks: [{ row: 7, name: "Six-day 30min", minutesByDay: { Mon: 30, Tue: 30, Wed: 30, Thu: 30, Fri: 30, Sat: 30 } }],
    };
    // F-2b: trunc(180 x 27 / 90 + 0.99) = trunc(54.99) = 54. July 2026 weekday counts [Sun..Sat] are
    // [4,4,4,5,5,5,4]; the six scheduled days sum to 27 occurrences, 27 x 30 = 810 minutes.
    const expected: Hcbs14Result = {
      perTask: [{ row: 7, name: "Six-day 30min", timesPerWeek: 6, weeklyMinutes: 180, units31d: 54 }],
      daily: { dailyMinutes: [0, 30, 30, 30, 30, 30, 30], dailyUnits: [0, 2, 2, 2, 2, 2, 2], dailyRemainder: [0, 0, 0, 0, 0, 0, 0], weeklyUnits: 12, weeklyAccrual: 0 },
      monthlyUnits: constantMonths("2026-07-01", 54),
      twelveMonthTotal: 648,
      baseline52wk: 624,
      exampleMonth: { weekdayCounts: [4, 4, 4, 5, 5, 5, 4], taskMonthMinutes: [810], monthMinutes: 810, monthUnits: 54, monthRemainder: 0 },
    };
    expect(calculate14(input)).toEqual(expected);
  });

  it("counts a 0-minute day in timesPerWeek (D7 = COUNTA)", () => {
    const input: Hcbs14Input = {
      startDate: "2026-07-01",
      exampleMonth: "2026-07",
      tasks: [{ row: 7, name: "Zero-minute Thursday", minutesByDay: { Mon: 30, Wed: 30, Thu: 0, Fri: 30 } }],
    };
    // The Thursday entry is 0 minutes but D7 still counts it: timesPerWeek = 4, not 3.
    // F-2b: trunc(90 x 19 / 60 + 0.99) = trunc(29.49) = 29 (a 3-day reading would give 30).
    // Example Month: 30x4 (Mon) + 30x5 (Wed) + 0x5 (Thu) + 30x5 (Fri) = 420 minutes.
    const expected: Hcbs14Result = {
      perTask: [{ row: 7, name: "Zero-minute Thursday", timesPerWeek: 4, weeklyMinutes: 90, units31d: 29 }],
      daily: { dailyMinutes: [0, 30, 0, 30, 0, 30, 0], dailyUnits: [0, 2, 0, 2, 0, 2, 0], dailyRemainder: [0, 0, 0, 0, 0, 0, 0], weeklyUnits: 6, weeklyAccrual: 0 },
      monthlyUnits: constantMonths("2026-07-01", 29),
      twelveMonthTotal: 348,
      baseline52wk: 312,
      exampleMonth: { weekdayCounts: [4, 4, 4, 5, 5, 5, 4], taskMonthMinutes: [420], monthMinutes: 420, monthUnits: 28, monthRemainder: 0 },
    };
    expect(calculate14(input)).toEqual(expected);
  });

  it("keeps an odd weekly remainder and truncates a fractional unit count", () => {
    const input: Hcbs14Input = {
      startDate: "2026-07-01",
      exampleMonth: "2026-07",
      tasks: [{ row: 7, name: "Odd remainder 23min", minutesByDay: { Tue: 23, Thu: 23 } }],
    };
    // weeklyMinutes 46 -> weekly units floor(46/15) = 3, accrual 46 % 15 = 1; each 23-minute day is
    // 1 unit + 8 remainder. F-2b: trunc(46 x 10 / 30 + 0.99) = trunc(16.323) = 16.
    // Example Month: 23x4 (Tue) + 23x5 (Thu) = 207 minutes -> 13 units + 12 remainder.
    const expected: Hcbs14Result = {
      perTask: [{ row: 7, name: "Odd remainder 23min", timesPerWeek: 2, weeklyMinutes: 46, units31d: 16 }],
      daily: { dailyMinutes: [0, 0, 23, 0, 23, 0, 0], dailyUnits: [0, 0, 1, 0, 1, 0, 0], dailyRemainder: [0, 0, 8, 0, 8, 0, 0], weeklyUnits: 3, weeklyAccrual: 1 },
      monthlyUnits: constantMonths("2026-07-01", 16),
      twelveMonthTotal: 192,
      baseline52wk: 156,
      exampleMonth: { weekdayCounts: [4, 4, 4, 5, 5, 5, 4], taskMonthMinutes: [207], monthMinutes: 207, monthUnits: 13, monthRemainder: 12 },
    };
    expect(calculate14(input)).toEqual(expected);
  });
});
