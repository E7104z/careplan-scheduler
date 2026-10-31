import type { Weekday } from "@careplan/engine";
import type { ImportedService, ImportResult } from "@careplan/import";
import { MONDAY_FIRST, localMonth, monthsBetween } from "../quick-schedule/model.js";
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

const WEEKDAYS_MON_FRI: Weekday[] = [1, 2, 3, 4, 5];

/** The n days with the fewest minutes already scheduled, ties in Monday-first order, in week order. */
function quietestDays(load: number[], n: number, from: Weekday[] = MONDAY_FIRST): Weekday[] {
  return [...from]
    .sort((a, b) => (load[a] ?? 0) - (load[b] ?? 0) || from.indexOf(a) - from.indexOf(b))
    .slice(0, n)
    .sort((a, b) => MONDAY_FIRST.indexOf(a) - MONDAY_FIRST.indexOf(b));
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
 * `load` is the minutes a day the participant's other services already have (APP-SPEC 5.8): a
 * service built after them takes its care days from the quietest days, so the week is spread
 * out rather than stacked. Without it, the care days are the first days from Monday.
 */
export function fromFusion(parsed: ImportResult, serviceIndex: number, today: Date, load?: number[]): QuickState {
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
  const careDays = load
    ? quietestDays(load, maxDaysPerWeek, transportOnly ? WEEKDAYS_MON_FRI : MONDAY_FIRST)
    : MONDAY_FIRST.slice(0, maxDaysPerWeek);
  const activeDays: boolean[] = [false, false, false, false, false, false, false];
  for (const day of careDays) activeDays[day] = true;
  const lastActive: Weekday = careDays.slice(-1)[0]!;

  const currentMonth = localMonth(today);
  const months = monthsBetween(plan.start, plan.end);
  let n = 0;

  return {
    source: "fusion",
    identity: parsed.participant
      ? { name: parsed.participant.name, dcn: parsed.participant.dcn }
      : null,
    provider: service.provider,
    pa: service.pa,
    serviceLabel: service.label,
    serviceCode: service.serviceCode,
    plan,
    headerUnits: service.units,
    tasks: service.tasks.map((task) => {
      n += 1;
      return {
        id: `qt-${n}`,
        taskCode: task.taskCode ?? `FUSION:${task.name}`,
        name: task.name,
        minPerDay: task.minPerDay,
        daysPerWeek: task.daysPerWeek,
        pinned: null,
        locked: true,
      };
    }),
    nextId: n + 1,
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
