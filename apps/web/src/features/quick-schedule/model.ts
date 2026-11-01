import {
  combinedRespiteUnits,
  composeWeek,
  daysInMonth,
  derivedServiceMonthUnits,
  expandMonth,
  fitToAuthorization,
  monthTransportUnits,
  transportAllowance,
  validatePlan,
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
    serviceAuthId: state.id,
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

  // Step 5: the months this schedule covers. A schedule is for care still to come, so it starts at
  // the month it was built (fromMonth), or at the plan's start if that is later. The plan's own
  // dates stay as Fusion has them; months already over aren't scheduled or checked.
  const fromDate = `${state.fromMonth}-01`;
  const scheduleStart = state.plan.start > fromDate ? state.plan.start : fromDate;
  const months = scheduleStart <= state.plan.end ? monthsBetween(scheduleStart, state.plan.end) : [];

  // Step 6: the single authorization this page schedules: the part of the plan still to come.
  const auth: ServiceAuthorization = {
    id: state.id,
    participantId: state.id,
    program: svc.program,
    serviceCode: svc.code,
    start: scheduleStart,
    end: state.plan.end,
    state: "active",
    suspensions: [],
    revision: 1,
    tasks,
  };
  if (transportMinutesPerMonth > 0) auth.transportMinutesPerMonth = transportMinutesPerMonth;

  // IMP-15 checksum against Fusion's monthly figure, over the full months of Fusion's plan.
  // A service with only transportation (CDS) is checked too: its units are the transportation.
  const scheduled = tasks.length > 0 || transportMinutesPerMonth > 0;
  const checksum = state.source === "fusion" && scheduled ? checksumFor(state, auth) : null;

  // Step 7: monthly figures. Each month's own figure (QS-11 by hand, or Fusion's care plan
  // report, IMP-17); else the care plan screen's one figure, prorated to each full month (IMP-10).
  const fusionFigure = (month: string, units: number): MonthlyAuthorization => ({
    serviceAuthId: state.id, month, units, source: "fusion", revision: 1,
  });
  const ownFigures = Object.entries(state.fusion)
    .filter(([month, units]) => months.includes(month) && Number.isInteger(units) && units >= 0)
    .map(([month, units]) => fusionFigure(month, units));
  const prorated =
    state.source === "fusion" && ownFigures.length === 0 && state.headerUnits !== null && Number.isInteger(state.headerUnits);
  const monthlyAuthorizations: MonthlyAuthorization[] = prorated
      ? months
          .filter((month) => isFullMonth(month, auth.start, auth.end))
          .map((month) => fusionFigure(month, proratedUnits(state.headerUnits as number, checksum, auth, month)))
      : ownFigures;

  // Step 8: trims come from the pattern, never from a person's cell changes (SCH-17).
  const pattern: ScheduleTemplate = {
    id: `${state.id}-template`,
    participantId: state.id,
    start: auth.start,
    end: auth.end,
    entries: composed.entries,
    rulePackVersion: pack.id,
  };
  const template: ScheduleTemplate = { ...pattern, entries };
  const trims: CalendarException[] =
    scheduled ? fitToAuthorization(pattern, auth, monthlyAuthorizations, months) : [];

  // Step 9: validate. Quick Schedule has no visits, so the plan rules run, with CON-09 on the
  // expanded template (ENGINE-SPEC Amendment B): CON-13 would otherwise ask for a referral date
  // it has no first visit to check.
  const results: ScheduleValidationResult[] =
    scheduled
      ? validatePlan({ pack, authorizations: [auth], monthlyAuthorizations, template, exceptions: trims, months })
      : [];

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
    prorated,
    results,
    checksum,
  };
}

/**
 * IMP-15: our total from the tasks for each month length among the full months of Fusion's plan,
 * and whether one of them is Fusion's figure (IMPORT-SPEC 1.2: the care plan screen shows the
 * figure for a 30-day month).
 */
function checksumFor(state: QuickState, auth: ServiceAuthorization): QuickChecksum | null {
  const fusion = state.headerUnits;
  if (fusion === null || !Number.isInteger(fusion)) return null;
  const byMonthLength: Record<string, number> = {};
  for (const month of monthsBetween(state.plan.start, state.plan.end)) {
    if (!isFullMonth(month, state.plan.start, state.plan.end)) continue;
    const [year, monthNumber] = month.split("-").map(Number);
    const key = String(daysInMonth(year ?? 0, monthNumber ?? 1));
    if (!(key in byMonthLength)) byMonthLength[key] = derivedServiceMonthUnits(auth, year ?? 0, monthNumber ?? 1);
  }
  return { fusion, byMonthLength, matches: Object.values(byMonthLength).includes(fusion) };
}

/**
 * IMP-10: the care plan screen's one figure, prorated to a month as Fusion does (Fusion FAQ, Jun
 * 4, 2025): tasks done every day count that month's days, other tasks a set number of days. When
 * our total from the tasks matches Fusion's figure, the month's figure is our total for that
 * month: Fusion's own method on the same tasks. When it doesn't, rows may be missing, so the
 * figure is never raised: Fusion's figure, lowered in a shorter month by what the daily tasks
 * read lose there.
 */
function proratedUnits(fusion: number, checksum: QuickChecksum | null, auth: ServiceAuthorization, month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  const derived = derivedServiceMonthUnits(auth, year ?? 0, monthNumber ?? 1);
  if (checksum?.matches) return derived;
  const thirtyDay = checksum?.byMonthLength["30"];
  return thirtyDay === undefined ? fusion : Math.min(fusion, fusion + derived - thirtyDay);
}

function validTask(task: QuickTask): task is QuickTask & { minPerDay: number } {
  return (
    typeof task.minPerDay === "number" &&
    Number.isInteger(task.minPerDay) &&
    task.minPerDay > 0 &&
    task.minPerDay <= 1440
  );
}

/** Whether there is anything in the week: tasks, or transportation (a CDS service may have only that). */
export function hasSchedule(model: QuickModel): boolean {
  return model.tasks.length > 0 || model.allowance !== null;
}

/**
 * APP-SPEC 5.4 month balance: the month's scheduled minutes (transportation and tasks) and the
 * minutes left of its authorization (negative when over).
 */
export function monthBalance(figures: MonthFigures): { scheduledMinutes: number; leftMinutes: number } {
  const scheduledMinutes = figures.transportUnits * 15 + figures.scheduledTaskMinutes;
  return { scheduledMinutes, leftMinutes: figures.authorizedUnits * 15 - scheduledMinutes };
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
    proratedDays: imported && model.prorated ? daysInMonth(y, m) : null,
    calculatedUnits,
    transportUnits,
    taskBudgetMinutes,
    scheduledTaskMinutes,
    over: scheduledTaskMinutes > taskBudgetMinutes,
    trims,
    trimmedMinutes,
  };
}

/**
 * APP-SPEC 5.8: the combined Basic + Advanced respite figure for a month, or null when the plan
 * doesn't hold both. The figure (and its 868 ceiling) come from the engine's AUTH-09 math, never
 * re-added here, so the number shown matches the BLOCK the engine emits.
 */
export function combinedRespiteFigure(
  models: QuickModel[],
  month: string,
): { units: number; ceiling: number } | null {
  const respites = models.filter((model) => model.svc.combinedCeilingGroup === "RESPITE");
  const hasBasic = respites.some((model) => model.svc.code === "S5150");
  const hasAdvanced = respites.some((model) => model.svc.code === "S5150TF");
  if (!hasBasic || !hasAdvanced) return null;
  const authorizations = respites.map((model) => model.auth);
  const monthly = respites.flatMap((model) => model.monthlyAuthorizations);
  const ceiling = respites[0]!.svc.monthlyCeiling ?? 0;
  return { units: combinedRespiteUnits(authorizations, monthly, month), ceiling };
}
