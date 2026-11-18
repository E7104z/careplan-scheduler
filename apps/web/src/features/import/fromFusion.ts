import type { Weekday } from "@careplan/engine";
import type { ImportedService, ImportResult } from "@careplan/import";
import { MONDAY_FIRST, localMonth, monthsBetween } from "../quick-schedule/model.js";
import { newId } from "../quick-schedule/ids.js";
import type { QuickState } from "../quick-schedule/types.js";

/** IMP-17: the care plan report's authorized units for each plan month (two periods in a month add up). */
function reportFigures(monthly: ImportedService["monthly"], months: string[]): Record<string, number> {
  const figures: Record<string, number> = {};
  for (const { start, units } of monthly ?? []) {
    const month = start.slice(0, 7);
    if (months.includes(month)) figures[month] = (figures[month] ?? 0) + units;
  }
  return figures;
}

/**
 * IMPORT-SPEC 4 (Nov 17, 2026 review): a client's care days for each number of days a week, spread
 * so the fewest days in a row go without care, weekdays first. Four days are Monday, Wednesday,
 * Friday and Saturday, never Monday to Thursday, which leaves three days in a row without care.
 */
export const SPREAD_DAYS: Readonly<Record<number, readonly Weekday[]>> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 3, 5, 6],
  5: [1, 2, 4, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 0],
};

/** The most days in a row without care in a week that repeats (Sunday follows Saturday). */
export function longestWithoutCare(days: readonly Weekday[]): number {
  if (days.length === 0) return 7;
  let longest = 0;
  for (let start = 0; start < 7; start++) {
    let run = 0;
    while (run < 7 && !days.includes(((start + run) % 7) as Weekday)) run++;
    longest = Math.max(longest, run);
  }
  return longest;
}

function weekOrder(days: Weekday[]): Weekday[] {
  return [...days].sort((a, b) => MONDAY_FIRST.indexOf(a) - MONDAY_FIRST.indexOf(b));
}

/**
 * `n` of the days in `from`, in week order: the fewest days in a row without care first, then the
 * fewest weekend days, then the fewest minutes the client's other services already have on them
 * (`load`), then the earliest days from Monday.
 */
export function spreadSubset(from: readonly Weekday[], n: number, load: readonly number[]): Weekday[] {
  const pool = weekOrder([...from]);
  let best: Weekday[] | null = null;
  let bestKey: number[] = [];
  const subsets = (start: number, chosen: Weekday[]): void => {
    if (chosen.length === n) {
      const key = [
        longestWithoutCare(chosen),
        chosen.filter((day) => day === 0 || day === 6).length,
        chosen.reduce<number>((sum, day) => sum + (load[day] ?? 0), 0),
        ...chosen.map((day) => MONDAY_FIRST.indexOf(day)),
      ];
      const differs = key.findIndex((value, at) => value !== bestKey[at]);
      if (best === null || (differs >= 0 && key[differs]! < bestKey[differs]!)) {
        best = [...chosen];
        bestKey = key;
      }
      return;
    }
    for (let i = start; i < pool.length; i++) subsets(i + 1, [...chosen, pool[i]!]);
  };
  subsets(0, []);
  return best ?? [];
}

/**
 * The service's own dates on Fusion's care plan report, which lists each authorization's months;
 * else the plan's dates (the care plan screen has one plan for its services).
 */
export function serviceDates(parsed: ImportResult, service: ImportedService): { start: string; end: string } | null {
  if (service.monthly && service.start && service.end) return { start: service.start, end: service.end };
  return parsed.plan ?? (service.start && service.end ? { start: service.start, end: service.end } : null);
}

/**
 * IMPORT-SPEC section 4: turn one parsed Fusion service into Quick Schedule state with locked
 * plan values. Unmatched tasks keep taskCode `FUSION:<name>` (IMP-09).
 *
 * `sharedDays` is the client's one set of care days (APP-SPEC 5.8, superseded Oct 31, 2026):
 * every service takes its own days from it — a service with the full number takes them all, one
 * with fewer days takes the most spread-out, then lightest, subset, and transportation takes one
 * weekday from it. Without it (a plan of one service), the care days are SPREAD_DAYS. `load` is
 * the minutes a day the participant's other services already have, used to pick that subset.
 */
export function fromFusion(
  parsed: ImportResult,
  serviceIndex: number,
  today: Date,
  load?: number[],
  sharedDays?: Weekday[],
): QuickState {
  const service = parsed.services[serviceIndex];
  if (!service) throw new Error(`No service at index ${serviceIndex}`);
  if (!service.serviceCode) {
    throw new Error("The service code must be resolved before building a schedule.");
  }
  const plan = serviceDates(parsed, service);
  if (!plan) throw new Error("Plan dates are required to build a schedule.");

  // Care days: d days, where d is the largest days-per-week. Transportation alone takes one weekday.
  const maxDaysPerWeek = service.tasks.reduce((max, task) => Math.max(max, task.daysPerWeek), 1);
  const transportOnly = service.tasks.length === 0 && service.transport !== null;
  // Every service shares one set of care days; a transport-only service still only uses weekdays.
  const pool = sharedDays ?? SPREAD_DAYS[Math.min(maxDaysPerWeek, 7)] ?? MONDAY_FIRST;
  const weekdays = pool.filter((day) => day !== 0 && day !== 6);
  const candidates = transportOnly && weekdays.length > 0 ? weekdays : pool;
  const careDays = spreadSubset(candidates, Math.min(maxDaysPerWeek, candidates.length), load ?? []);
  const activeDays: boolean[] = [false, false, false, false, false, false, false];
  for (const day of careDays) activeDays[day] = true;
  // Transportation's usual day: the last weekday among the care days (errands and appointments).
  const careWeekdays = careDays.filter((day) => day !== 0 && day !== 6);
  const lastActive: Weekday = (careWeekdays.length > 0 ? careWeekdays : careDays).slice(-1)[0]!;

  const currentMonth = localMonth(today);
  const months = monthsBetween(plan.start, plan.end);

  return {
    source: "fusion",
    identity: parsed.participant
      ? { name: parsed.participant.name, dcn: parsed.participant.dcn }
      : null,
    provider: service.provider,
    pa: service.pa,
    serviceLabel: service.label,
    ...(service.procedureCode && service.procedureCode !== service.serviceCode ? { fusionCode: service.procedureCode } : {}),
    serviceCode: service.serviceCode,
    plan,
    headerUnits: service.units,
    tasks: service.tasks.map((task) => ({
      id: newId(),
      taskCode: task.taskCode ?? `FUSION:${task.name}`,
      name: task.name,
      minPerDay: task.minPerDay,
      daysPerWeek: task.daysPerWeek,
      pinned: null,
      locked: true,
      raw: task.raw,
      source: task.source,
    })),
    id: newId(),
    sourceRef: service.source,
    activeDays,
    transport: {
      minutesPerMonth: service.transport ? service.transport.minutesPerMonth : 0,
      day: lastActive,
    },
    edits: {},
    fusion: reportFigures(service.monthly, months),
    fromMonth: currentMonth,
    // The schedule starts this month (or at the plan's start, if later): never a month that's over.
    viewMonth: months.includes(currentMonth) ? currentMonth : (months.find((month) => month > currentMonth) ?? currentMonth),
    reviewed: null,
    isExample: false,
    notes: [],
    // Rows the schedule is built from (tasks and transportation), for "Built from 10 of 14 rows".
    rowsRead: service.tasks.length + (service.transport ? 1 : 0),
  };
}
