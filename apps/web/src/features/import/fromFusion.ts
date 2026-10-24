import type { Weekday } from "@careplan/engine";
import type { ImportResult } from "@careplan/import";
import { MONDAY_FIRST, localMonth, monthsBetween } from "../quick-schedule/model.js";
import type { QuickState } from "../quick-schedule/types.js";

/**
 * IMPORT-SPEC section 4: turn one parsed Fusion service into Quick Schedule state with locked
 * plan values. Unmatched tasks keep taskCode `FUSION:<name>` (IMP-09).
 */
export function fromFusion(parsed: ImportResult, serviceIndex: number, today: Date): QuickState {
  const service = parsed.services[serviceIndex];
  if (!service) throw new Error(`No service at index ${serviceIndex}`);
  if (!service.serviceCode) {
    throw new Error("The service code must be resolved before building a schedule.");
  }
  const plan = parsed.plan ?? (service.start && service.end
    ? { start: service.start, end: service.end }
    : null);
  if (!plan) throw new Error("Plan dates are required to build a schedule.");

  // Care days: the first d days of Monday..Sunday, where d is the largest days-per-week.
  const maxDaysPerWeek = service.tasks.reduce((max, task) => Math.max(max, task.daysPerWeek), 1);
  const activeDays: boolean[] = [false, false, false, false, false, false, false];
  for (const day of MONDAY_FIRST.slice(0, maxDaysPerWeek)) activeDays[day] = true;
  const lastActive: Weekday = MONDAY_FIRST.slice(0, maxDaysPerWeek).slice(-1)[0]!;

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
    fusion: {},
    viewMonth: months.includes(currentMonth) ? currentMonth : (months[0] ?? currentMonth),
    isExample: false,
    notes: [],
    // Rows the schedule is built from (tasks and transportation), for "Built from 10 of 14 rows".
    rowsRead: service.tasks.length + (service.transport ? 1 : 0),
  };
}
