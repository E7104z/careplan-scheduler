import { weekdayCounts } from "../calendar/expand.js";
import { dayUnits } from "../math/display.js";
import { daysInMonth, parseYmd } from "../math/dates.js";
import { monthTaskUnits, workbookTaskUnits } from "../math/units.js";

/**
 * DHSS 4.00 Appendix 14a/14b scheduling worksheet math (WORKBOOK-01 / audit E-12), exactly as the
 * workbooks calculate it. 14a (Agency Model) and 14b (CDS) share one formula set; the only
 * difference is a defect in 14a's Example Month sheet (`H12` is hardcoded 0 — see the golden
 * fixture's `knownStateDefects`). This module returns the correct (14b) numbers and never
 * reproduces the defect.
 *
 * Reuses the engine's F-2b (`workbookTaskUnits`), F-3 (`monthTaskUnits`), F-5 (`dayUnits`) and the
 * calendar expansion (`weekdayCounts`) — the same math `validateSchedule` uses — so this is a parity
 * surface, not a second implementation.
 *
 * D7 edge case (decided Nov 25, 2026): the sheet's D7 is COUNTA(E7:K7), so a weekday typed as 0
 * still counts as a scheduled day. `timesPerWeek` counts every weekday listed in `minutesByDay`,
 * 0 included.
 */

/** Worksheet weekday abbreviations, Sunday first (the engine's Weekday 0 = Sunday). */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type Hcbs14Weekday = (typeof WEEKDAYS)[number];
const WEEKDAY_INDEX: Record<Hcbs14Weekday, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface Hcbs14TaskInput {
  /** The worksheet row the task sits on (7, 8, …). */
  row: number;
  name: string;
  /** Minutes entered per weekday. A listed weekday counts as a scheduled day even at 0 (D7). */
  minutesByDay: Partial<Record<Hcbs14Weekday, number>>;
}

export interface Hcbs14Input {
  /** First month of the 12-month projection (D37:O37 starts here). */
  startDate: string;
  /** The month shown by the Example Month sheet. */
  exampleMonth: string;
  tasks: Hcbs14TaskInput[];
}

export interface Hcbs14TaskResult {
  row: number;
  name: string;
  /** D7 = COUNTA of the weekday cells. */
  timesPerWeek: number;
  /** L = sum of the weekday minutes. */
  weeklyMinutes: number;
  /** M = F-2b: trunc(weeklyMinutes / timesPerWeek / 15 × factor + 0.99). */
  units31d: number;
}

export interface Hcbs14Daily {
  /** E27:K27, Sunday..Saturday. */
  dailyMinutes: number[];
  /** E30:K30 = floor(minutes / 15). */
  dailyUnits: number[];
  /** E31:K31 = minutes % 15. */
  dailyRemainder: number[];
  /** L30 = floor(total weekly minutes / 15). */
  weeklyUnits: number;
  /** L31 = total weekly minutes % 15. */
  weeklyAccrual: number;
}

export interface Hcbs14ExampleMonth {
  /** D7:J7, Sunday..Saturday. */
  weekdayCounts: number[];
  /** K8:K12: each task's minutes in the month (the correct, 14b value). */
  taskMonthMinutes: number[];
  /** K28. */
  monthMinutes: number;
  /** K31 = floor(monthMinutes / 15). */
  monthUnits: number;
  /** K32 = monthMinutes % 15. */
  monthRemainder: number;
}

export interface Hcbs14Result {
  perTask: Hcbs14TaskResult[];
  daily: Hcbs14Daily;
  /** D37:O37, the 12 months from startDate. */
  monthlyUnits: Record<string, number>;
  /** P37. */
  twelveMonthTotal: number;
  /** P38 = 52 × floor(weeklyMinutes / 15). */
  baseline52wk: number;
  exampleMonth: Hcbs14ExampleMonth;
}

function timesPerWeekOf(task: Hcbs14TaskInput): number {
  return Object.keys(task.minutesByDay).length;
}

function weeklyMinutesOf(task: Hcbs14TaskInput): number {
  return Object.values(task.minutesByDay).reduce((sum, minutes) => sum + minutes, 0);
}

export function calculate14(input: Hcbs14Input): Hcbs14Result {
  const perTask: Hcbs14TaskResult[] = input.tasks.map((task) => {
    const timesPerWeek = timesPerWeekOf(task);
    const weeklyMinutes = weeklyMinutesOf(task);
    // An empty row has no days; the sheet's M formula would divide by 0, so it counts nothing.
    const units31d = timesPerWeek === 0 ? 0 : workbookTaskUnits(weeklyMinutes, timesPerWeek).units;
    return { row: task.row, name: task.name, timesPerWeek, weeklyMinutes, units31d };
  });

  const totalWeeklyMinutes = perTask.reduce((sum, task) => sum + task.weeklyMinutes, 0);

  const dailyMinutes = WEEKDAYS.map((weekday) =>
    input.tasks.reduce((sum, task) => sum + (task.minutesByDay[weekday] ?? 0), 0),
  );
  const daily = dailyMinutes.map((minutes) => dayUnits(minutes));

  // D37:O37: 12 months from startDate. 7-day tasks use the real days in the month; others F-2b.
  const start = parseYmd(input.startDate);
  const monthlyUnits: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    const year = start.year + Math.floor((start.month - 1 + i) / 12);
    const month = ((start.month - 1 + i) % 12) + 1;
    let units = 0;
    for (const task of input.tasks) {
      const timesPerWeek = timesPerWeekOf(task);
      if (timesPerWeek === 0) continue;
      units += monthTaskUnits(weeklyMinutesOf(task), timesPerWeek, daysInMonth(year, month)).units;
    }
    monthlyUnits[`${year}-${String(month).padStart(2, "0")}`] = units;
  }

  const [exampleYear, exampleMonth] = input.exampleMonth.split("-").map((n) => Number(n));
  const exampleWeekdayCounts = weekdayCounts(exampleYear!, exampleMonth!);
  const taskMonthMinutes = input.tasks.map((task) =>
    Object.entries(task.minutesByDay).reduce(
      (sum, [weekday, minutes]) =>
        sum + (exampleWeekdayCounts[WEEKDAY_INDEX[weekday as Hcbs14Weekday]!] ?? 0) * minutes,
      0,
    ),
  );
  const monthMinutes = taskMonthMinutes.reduce((sum, minutes) => sum + minutes, 0);

  return {
    perTask,
    daily: {
      dailyMinutes,
      dailyUnits: daily.map((d) => d.units),
      dailyRemainder: daily.map((d) => d.remainder),
      weeklyUnits: Math.floor(totalWeeklyMinutes / 15),
      weeklyAccrual: totalWeeklyMinutes % 15,
    },
    monthlyUnits,
    twelveMonthTotal: Object.values(monthlyUnits).reduce((sum, units) => sum + units, 0),
    baseline52wk: Math.floor(totalWeeklyMinutes / 15) * 52,
    exampleMonth: {
      weekdayCounts: exampleWeekdayCounts,
      taskMonthMinutes,
      monthMinutes,
      monthUnits: Math.floor(monthMinutes / 15),
      monthRemainder: monthMinutes % 15,
    },
  };
}
