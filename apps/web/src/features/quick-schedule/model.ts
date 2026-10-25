import {
  composeWeek,
  daysInMonth,
  derivedServiceMonthUnits,
  expandMonth,
  fitToAuthorization,
  monthTransportUnits,
  transportAllowance,
  validateSchedule,
  type AuthorizedTask,
  type CalendarException,
  type MonthlyAuthorization,
  type RulePack,
  type ScheduleTemplate,
  type ScheduleValidationResult,
  type ServiceAuthorization,
  type TemplateEntry,
  type Weekday,
} from "@careplan/engine";
import type {
  FusionTransport,
  ManualTransport,
  MonthFigures,
  QuickAllowance,
  QuickChecksum,
  QuickModel,
  QuickState,
  QuickTask,
} from "./types.js";

export const MONDAY_FIRST: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The "YYYY-MM" of a moment on the person's own calendar. Not `toISOString()`, which is UTC:
 * 10 pm on Oct 31 in Missouri is already November in UTC.
 */
export function localMonth(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** "2026-07" + n months, normalized back to "YYYY-MM". */
export function addMonths(month: string, n: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = (year ?? 0) * 12 + ((monthNumber ?? 1) - 1) + n;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** Every "YYYY-MM" from the start month through the end month, inclusive. */
export function monthsBetween(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  let current = startIso.slice(0, 7);
  const last = endIso.slice(0, 7);
  while (current <= last) {
    out.push(current);
    current = addMonths(current, 1);
  }
  return out;
}

/** The last calendar date of a "YYYY-MM" month, as "YYYY-MM-DD". */
export function lastDayIso(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${month}-${pad(daysInMonth(year ?? 0, monthNumber ?? 1))}`;
}

/** True when the month is entirely inside [start, end]. */
export function isFullMonth(month: string, start: string, end: string): boolean {
  return start <= `${month}-01` && end >= lastDayIso(month);
}

/**
 * APP-SPEC 5.3: build the Quick Schedule model from state. The schedule math and rules all come
 * from @careplan/engine; this function only assembles the inputs and wires up Fusion figures.
 */
export function buildQuickModel(state: QuickState, pack: RulePack): QuickModel {
  const svc = pack.services.find((service) => service.code === state.serviceCode);
  if (!svc) throw new Error(`Unknown service code ${state.serviceCode}`);

  // Step 1: valid tasks -> AuthorizedTask; unmatched Fusion tasks keep taskCode FUSION:<name>.
  const tasks: AuthorizedTask[] = state.tasks.filter(validTask).map((task) => ({
    id: task.id,
    serviceAuthId: "quick",
    taskCode: task.taskCode ?? `FUSION:${task.name}`,
    name: task.name,
    minPerDay: task.minPerDay,
    daysPerWeek: task.daysPerWeek,
  }));

  // Step 2: transportation, CDS and ILW only.
  const transportOn = svc.program === "CDS" || svc.program === "ILW";
  let transportMinutesPerMonth = 0;
  let weeklyTransport = 0;
  let allowance: QuickAllowance | null = null;
  if (transportOn && state.source === "fusion") {
    const minutesPerMonth = (state.transport as FusionTransport).minutesPerMonth;
    if (minutesPerMonth > 0) {
      transportMinutesPerMonth = minutesPerMonth;
      weeklyTransport = Math.floor(Math.floor(minutesPerMonth / 15) / 5) * 15;
      allowance = {
        minutesPerMonth,
        units: Math.floor(minutesPerMonth / 15),
        unallocatedMinutes: minutesPerMonth % 15,
        weeklyMinutes: weeklyTransport,
      };
    }
  } else if (transportOn && state.source === "manual") {
    const transport = state.transport as ManualTransport;
    if (transport.minPerTrip > 0) {
      const result = transportAllowance(transport.minPerTrip, transport.tripsPerWeek);
      transportMinutesPerMonth = result.minutesPerMonth;
      weeklyTransport = transport.minPerTrip * transport.tripsPerWeek;
      allowance = {
        minutesPerMonth: result.minutesPerMonth,
        units: result.units,
        unallocatedMinutes: result.unallocatedMinutes,
        weeklyMinutes: weeklyTransport,
      };
    }
  }

  // Step 3: compose the weekly pattern (overrides = pinned day sets). A task whose days were all
  // unselected stays in the plan (so SCH-02 says it is short of days) but is off the week.
  const overrides: Record<string, Weekday[]> = {};
  const offTheWeek = new Set<string>();
  for (const task of state.tasks) {
    if (task.pinned && task.pinned.length > 0) overrides[task.id] = task.pinned;
    if (task.pinned && task.pinned.length === 0) offTheWeek.add(task.id);
  }
  const composed = composeWeek({
    tasks: tasks.filter((task) => !offTheWeek.has(task.id)),
    activeDays: state.activeDays,
    overrides,
    weeklyTransportMinutes: weeklyTransport,
    transportDay: state.transport.day,
  });

  // Step 4: apply cell changes, dropping 0-minute occurrences.
  const entries: TemplateEntry[] = composed.entries
    .map((entry) => {
      const key = `${entry.taskId}:${entry.weekday}`;
      return Object.prototype.hasOwnProperty.call(state.edits, key)
        ? { taskId: entry.taskId, weekday: entry.weekday, minutes: state.edits[key] ?? 0 }
        : entry;
    })
    .filter((entry) => entry.minutes > 0);

  // Step 5: every month of the plan.
  const months = monthsBetween(state.plan.start, state.plan.end);

  // Step 6: the single authorization this page schedules.
  const auth: ServiceAuthorization = {
    id: "quick",
    participantId: "quick",
    program: svc.program,
    serviceCode: svc.code,
    start: state.plan.start,
    end: state.plan.end,
    state: "active",
    suspensions: [],
    revision: 1,
    tasks,
  };
  if (transportMinutesPerMonth > 0) auth.transportMinutesPerMonth = transportMinutesPerMonth;

  // Step 7: monthly figures: each month's own figure (QS-11 by hand, or Fusion's care plan report,
  // IMP-17), else Fusion's header units for full months (IMP-10).
  const fusionFigure = (month: string, units: number): MonthlyAuthorization => ({
    serviceAuthId: "quick", month, units, source: "fusion", revision: 1,
  });
  const headerUnits = state.headerUnits;
  const ownFigures = Object.entries(state.fusion)
    .filter(([month, units]) => months.includes(month) && Number.isInteger(units) && units >= 0)
    .map(([month, units]) => fusionFigure(month, units));
  const monthlyAuthorizations: MonthlyAuthorization[] =
    state.source === "fusion" && ownFigures.length === 0 && headerUnits !== null && Number.isInteger(headerUnits)
      ? months.filter((month) => isFullMonth(month, auth.start, auth.end)).map((month) => fusionFigure(month, headerUnits))
      : ownFigures;

  // Step 8: trims come from the pattern, never from a person's cell changes (SCH-17).
  const pattern: ScheduleTemplate = {
    id: "quick-template",
    participantId: "quick",
    start: auth.start,
    end: auth.end,
    entries: composed.entries,
    rulePackVersion: pack.id,
  };
  const template: ScheduleTemplate = { ...pattern, entries };
  const trims: CalendarException[] =
    tasks.length > 0 ? fitToAuthorization(pattern, auth, monthlyAuthorizations, months) : [];

  // Step 9: validate.
  const results: ScheduleValidationResult[] =
    tasks.length > 0
      ? validateSchedule({
          pack,
          authorizations: [auth],
          monthlyAuthorizations,
          template,
          exceptions: trims,
          visits: [],
          caregivers: [],
          enrollments: [],
          months,
          tenantWorkweekStart: 0,
        })
      : [];

  // Step 10: IMP-15 checksum against Fusion's monthly figure.
  let checksum: QuickChecksum | null = null;
  if (state.source === "fusion" && state.headerUnits !== null && Number.isInteger(state.headerUnits) && tasks.length > 0) {
    const full = months.filter((month) => isFullMonth(month, auth.start, auth.end));
    const byMonthLength: Record<string, number> = {};
    for (const month of full) {
      const [year, monthNumber] = month.split("-").map(Number);
      const length = daysInMonth(year ?? 0, monthNumber ?? 1);
      const key = String(length);
      if (!(key in byMonthLength)) {
        byMonthLength[key] = derivedServiceMonthUnits(auth, year ?? 0, monthNumber ?? 1);
      }
    }
    const values = Object.values(byMonthLength);
    checksum = {
      fusion: state.headerUnits as number,
      byMonthLength,
      matches: values.includes(state.headerUnits as number),
    };
  }

  return {
    svc,
    tasks,
    pattern: composed.entries,
    entries,
    auth,
    template,
    trims,
    allowance,
    months,
    monthlyAuthorizations,
    results,
    checksum,
  };
}

function validTask(task: QuickTask): task is QuickTask & { minPerDay: number } {
  return (
    typeof task.minPerDay === "number" &&
    Number.isInteger(task.minPerDay) &&
    task.minPerDay > 0 &&
    task.minPerDay <= 1440
  );
}

/** APP-SPEC 5.3 step 11: one month's figures, using the same test as SCH-08. */
export function monthFigures(model: QuickModel, month: string): MonthFigures {
  const [year, monthNumber] = month.split("-").map(Number);
  const y = year ?? 0;
  const m = monthNumber ?? 1;
  const expanded = expandMonth(model.template, model.trims, y, m, model.auth.start, model.auth.end);
  const imported = model.monthlyAuthorizations.find((authorization) => authorization.month === month);
  const calculatedUnits = derivedServiceMonthUnits(model.auth, y, m);
  const authorizedUnits = imported ? imported.units : calculatedUnits;
  const transportUnits = monthTransportUnits(model.auth);
  const taskBudgetMinutes = Math.max(0, authorizedUnits - transportUnits) * 15;
  let scheduledTaskMinutes = 0;
  for (const day of Object.values(expanded)) {
    for (const minutes of Object.values(day)) scheduledTaskMinutes += minutes;
  }
  const trims = model.trims.filter((trim) => trim.date.slice(0, 7) === month);
  const trimmedMinutes = trims.reduce((sum, trim) => sum - trim.minutesDelta, 0);
  return {
    expanded,
    authorizedUnits,
    source: imported ? "fusion" : "calculated",
    calculatedUnits,
    transportUnits,
    taskBudgetMinutes,
    scheduledTaskMinutes,
    over: scheduledTaskMinutes > taskBudgetMinutes,
    trims,
    trimmedMinutes,
  };
}
