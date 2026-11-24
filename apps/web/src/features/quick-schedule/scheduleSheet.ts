import type { AccrualProjection, RulePack, Weekday } from "@careplan/engine";
import { clockTime, formatDuration, formatUnits, niceDate, shortMonth, weekdayName } from "../../lib/format";
import { serviceAccrual } from "./accrual";
import { fusionUnitsText } from "./checksumText";
import { dailyVisits } from "./DailyTaskList";
import { contextFor, groupResults } from "./grouping";
import { monthBalance, monthFigures } from "./model";
import { copyFor } from "./ruleCopy";
import { scheduleStatus } from "./status";
import type { QuickModel, QuickState } from "./types";
import { daysText } from "./WeeklyPanel";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** The checks the printout lists, most serious first; Good to know stays on the screen. */
export const PRINTED_SEVERITIES = { BLOCK: "Must fix", REVIEW: "Needs review", WARN: "Worth checking" } as const;

export interface SheetFact {
  label: string;
  value: string;
}

export interface SheetFigure extends SheetFact {
  note: string;
}

export interface SheetCell {
  minutes: number;
  /** QS-10: a person changed this cell. */
  changed: boolean;
  /** More than the task's minutes a day (SCH-03 allows it). */
  over: boolean;
}

export interface SheetRow {
  name: string;
  /** "45 min · 5 days a week", or "Set aside, not a task" for transportation. */
  detail: string;
  transport: boolean;
  /** Sunday to Saturday; null where the task isn't scheduled. */
  cells: (SheetCell | null)[];
  weekMinutes: number;
}

export interface SheetDay {
  name: string;
  /** A care day (QS-08); the others are shaded on the printout. */
  care: boolean;
  /** The visit length ("5 h 15 min"): tasks and transportation that day. Null: no visit. */
  visit: string | null;
  minutes: string;
  /** Whole units, with leftover minutes: "21" or "15 + 10 min". */
  units: string;
}

export interface SheetTotals {
  visit: string;
  minutes: string;
  units: string;
}

export interface SheetMonth {
  label: string;
  authorized: string;
  scheduled: string;
  left: string;
  over: boolean;
}

export interface SheetCheck {
  severity: keyof typeof PRINTED_SEVERITIES;
  label: string;
  title: string;
  context: string;
}

/** One nurse visit authorization, for the printout's Nurse visits page (Nov 17, 2026 review). */
export interface SheetNurseVisit {
  /** "RN · PA 20261520045221" */
  title: string;
  /** "T1001 · AT HOME CARE" */
  detail: string;
  /** "Eval APC Plan 2 a month, Train APC 1 a month" */
  tasks: string;
  /** Each authorized month: its visits and the dates placed ("–" for none). */
  months: { label: string; authorized: string; placed: string }[];
  /** Tasks that don't add up to the authorization, to check with the care manager; else null. */
  review: string | null;
}

/** Who a printout is for (ACC-06): the participant's copy, or the agency's with projected accruals. */
export type SheetCopy = "Participant copy" | "Agency copy";

/** One service's one month, for the agency-only accrual page (ACC-06, ACC-08). */
export interface SheetAccrual extends AccrualProjection {
  month: string;
}

/**
 * Everything the one-page printed schedule says (APP-SPEC 5.4 Print), worked out from the same
 * model and copy as the screen. `schedulePdf.ts` only lays it out.
 */
export interface ScheduleSheet {
  /**
   * "plan": the whole care plan's week (APP-SPEC 5.8). A day there can hold several services, each
   * its own visit for EVV, so the grid's last rows are the day's total, not a visit's length.
   */
  kind?: "service" | "plan";
  /** The participant's name from Fusion, "Example care plan", or null: lines to write name and DCN on. */
  name: string | null;
  /** Printed beside the title, so nobody has to guess which of the two printouts this is. */
  copy: SheetCopy;
  facts: SheetFact[];
  /** `review`: nothing must be fixed, but something needs review (the whole plan's page). */
  status: { title: string; detail: string; blocked: boolean; review?: boolean };
  rows: SheetRow[];
  /** Sunday to Saturday. */
  days: SheetDay[];
  week: SheetTotals;
  summary: SheetFigure[];
  months: SheetMonth[];
  authorizedNote: string;
  /** A non-blocking warning about the whole plan (APP-SPEC 5.8); null on a service's own page. */
  warning: string | null;
  checks: SheetCheck[];
  /** "Oct 21, 2026", or null: a line to write the date on. */
  reviewed: string | null;
  footer: string;
  /** The agency-only accrual sections (ACC-06). Absent on the client printout. */
  accruals?: SheetAccrual[];
  /** The nurse visits' own page, after this sheet (first sheet only); absent when the plan has none. */
  nurseVisits?: SheetNurseVisit[];
}

/** "Nov 1 to Nov 30, 2026", or "Dec 1, 2026 to Jan 31, 2027" across years. */
export function dateRange(start: string, end: string): string {
  return start.slice(0, 4) === end.slice(0, 4)
    ? `${niceDate(start).replace(/, \d+$/, "")} to ${niceDate(end)}`
    : `${niceDate(start)} to ${niceDate(end)}`;
}

/**
 * "Each month's figures count all of its days, including the 16 before this schedule was made on
 * Nov 17, 2026.", when the schedule's first month began before today; else "". A month's
 * authorization is for the whole month, so its figures are too.
 */
export function pastDaysNote(scheduleStart: string, today: string): string {
  if (today.slice(0, 7) !== scheduleStart.slice(0, 7) || today <= scheduleStart) return "";
  const before = Number(today.slice(8)) - Number(scheduleStart.slice(8));
  return ` Each month's figures count all of its days, including the ${before} before this schedule was made on ${niceDate(today)}.`;
}

/**
 * Why units are left in a month (Nov 17, 2026 review: "Left 12" read as under-delivery): the first
 * month with a whole unit left and nothing cut, its care days and how many care days all of its
 * units would take. "" when no month has units left.
 */
function leftNote(model: QuickModel): string {
  for (const month of model.months) {
    const figures = monthFigures(model, month);
    const { leftMinutes } = monthBalance(figures);
    if (leftMinutes < 15) continue;
    const careDays = Object.values(figures.expanded).filter((day) => Object.values(day).some((minutes) => minutes > 0)).length;
    if (careDays === 0 || figures.scheduledTaskMinutes === 0) return "";
    const taskUnits = figures.authorizedUnits - figures.transportUnits;
    const days = Math.round((taskUnits * 15) / (figures.scheduledTaskMinutes / careDays));
    return (
      ` Left is units authorized but not scheduled, not missed care: ${shortMonth(month)} has ${careDays} care ` +
      `${careDays === 1 ? "day" : "days"}, each with every task's minutes, and all ${taskUnits} units would take about ${days}.`
    );
  }
  return "";
}

const grouped = new Intl.NumberFormat("en-US");

/** Whole 15-minute units and leftover minutes, under a "Units" heading: "21", "15 + 10 min". */
function unitsCell(minutes: number): string {
  const rest = minutes % 15;
  return `${Math.floor(minutes / 15)}${rest ? ` + ${rest} min` : ""}`;
}

/** "Sunday to Saturday" for every day, otherwise the days named: "Monday, Tuesday, Wednesday". */
function daysList(days: Weekday[]): string {
  if (days.length === 7) return "Sunday to Saturday";
  return days.map(weekdayName).join(", ");
}

function authorizedNote(calculated: boolean[]): string {
  if (calculated.every(Boolean)) return "Authorized is calculated from the tasks: there's no Fusion figure for these months.";
  const fusion = "Authorized is Fusion's figure for each month.";
  return calculated.some(Boolean) ? `${fusion} * Calculated from the tasks: no Fusion figure for that month.` : fusion;
}

/**
 * APP-SPEC 5.4 Print: the one-page schedule for the participant, the caregiver and the file. Who
 * and what (name, DCN, service, plan, Fusion's units, provider, PA), the week from Sunday to
 * Saturday with each visit's length, every month's units and cuts, the checks, the review with
 * the participant and when it was checked.
 */
export function buildScheduleSheet(
  state: QuickState,
  model: QuickModel,
  pack: RulePack,
  today: string,
  audience: "client" | "agency" = "client",
): ScheduleSheet {
  const status = scheduleStatus(state, model);

  // The example is titled as the example, without its sample DCN, as in the read summary.
  const identity = state.isExample ? null : state.identity;
  const facts: SheetFact[] = [];
  if (identity) facts.push({ label: "DCN", value: identity.dcn });
  // The rule pack's code, and Fusion's when it prints another (T1019 for APC, which is T1019TF).
  const fusion = state.fusionCode && state.fusionCode !== model.svc.code ? ` (Fusion prints ${state.fusionCode})` : "";
  facts.push({ label: "Service", value: `${state.serviceLabel ?? model.svc.name} · ${model.svc.code}${fusion}` });
  facts.push({ label: "Plan", value: `${niceDate(state.plan.start)} to ${niceDate(state.plan.end)}` });
  if (model.auth.start > state.plan.start) facts.push({ label: "Schedule covers", value: dateRange(model.auth.start, model.auth.end) });
  if (state.headerUnits !== null) facts.push({ label: "Fusion units", value: fusionUnitsText(model.checksum, state.headerUnits) });
  if (state.provider) facts.push({ label: "Provider", value: state.provider });
  if (state.pa) facts.push({ label: "Prior authorization", value: state.pa });

  // The week: one row per task in care plan order, then transportation on its usual day.
  const byTask = new Map<string, (SheetCell | null)[]>();
  for (const task of model.tasks) byTask.set(task.id, WEEKDAYS.map(() => null));
  for (const entry of model.entries) {
    const task = model.tasks.find((candidate) => candidate.id === entry.taskId);
    const cells = byTask.get(entry.taskId);
    if (!task || !cells) continue;
    cells[entry.weekday] = {
      minutes: entry.minutes,
      changed: `${entry.taskId}:${entry.weekday}` in state.edits,
      over: entry.minutes > task.minPerDay,
    };
  }
  const rows: SheetRow[] = model.tasks.map((task) => {
    const cells = byTask.get(task.id)!;
    return {
      name: task.name,
      detail: `${task.minPerDay} min · ${daysText(task.daysPerWeek)}`,
      transport: false,
      cells,
      weekMinutes: cells.reduce((sum, cell) => sum + (cell?.minutes ?? 0), 0),
    };
  });
  if (model.allowance) {
    const weekly = model.allowance.weeklyMinutes;
    rows.push({
      name: "Essential transportation",
      detail: "Set aside, not a task",
      transport: true,
      cells: WEEKDAYS.map((weekday) => (weekday === state.transport.day ? { minutes: weekly, changed: false, over: false } : null)),
      weekMinutes: weekly,
    });
  }

  // Each day's visit: its tasks and transportation, as the daily task list and EVV have it.
  const visits = dailyVisits(state, model);
  const days: SheetDay[] = visits.map((visit) => {
    const minutes = visit.taskMinutes + visit.transportMinutes;
    return {
      name: weekdayName(visit.weekday),
      care: state.activeDays[visit.weekday] ?? false,
      // With a start time set (Coverage Phase 4), the visit reads "9:00 AM, 5 h 15 min".
      visit: minutes > 0 ? (visit.startTime ? `${clockTime(visit.startTime)}, ${formatDuration(minutes)}` : formatDuration(minutes)) : null,
      minutes: minutes > 0 ? grouped.format(minutes) : "",
      units: minutes > 0 ? unitsCell(minutes) : "",
    };
  });
  const weekMinutes = visits.reduce((sum, visit) => sum + visit.taskMinutes + visit.transportMinutes, 0);

  const careDays = WEEKDAYS.filter((weekday) => model.entries.some((entry) => entry.weekday === weekday));
  // A service with only transportation (CDS, APP-SPEC 5.8) has no task minutes or care days to show.
  const summary: SheetFigure[] =
    model.tasks.length > 0
      ? [
          { label: "Task minutes a week", value: grouped.format(status.weekMinutes), note: formatUnits(status.weekMinutes) },
          { label: "Care days", value: `${status.careDays} a week`, note: daysList(careDays) },
        ]
      : [];
  if (model.allowance) {
    summary.push({
      label: "Essential transportation",
      value: `${model.allowance.weeklyMinutes} min on ${weekdayName(state.transport.day)}`,
      note: `${model.allowance.minutesPerMonth} minutes a month (${model.allowance.units} units), set aside before tasks`,
    });
  }

  // Every month of the schedule, and where a month is over its authorization (a warning, not a
  // stop). When some months have Fusion's figure and others don't, the calculated ones are starred.
  const calculated: boolean[] = [];
  const someFromFusion = model.monthlyAuthorizations.length > 0;
  const months: SheetMonth[] = model.months.map((month) => {
    const figures = monthFigures(model, month);
    const { scheduledMinutes, leftMinutes } = monthBalance(figures);
    calculated.push(figures.source !== "fusion");
    return {
      label: shortMonth(month),
      authorized: `${figures.authorizedUnits}${figures.source !== "fusion" && someFromFusion ? "*" : ""}`,
      scheduled: unitsCell(scheduledMinutes),
      left: leftMinutes >= 0 ? unitsCell(leftMinutes) : `${-leftMinutes} min over`,
      over: leftMinutes < 0,
    };
  });

  const taskNames = new Map(model.tasks.map((task) => [task.id, task.name]));
  const checks: SheetCheck[] = groupResults(model.results).flatMap((group) => {
    if (group.severity === "INFO") return [];
    const copy = copyFor(group.ruleId, group.severity, group.taskId ? { taskId: group.taskId } : undefined);
    return [
      {
        severity: group.severity,
        label: PRINTED_SEVERITIES[group.severity],
        title: copy?.title ?? group.messages[0] ?? group.ruleId,
        context: contextFor(group, group.taskId ? taskNames.get(group.taskId) : undefined, model.months.length),
      },
    ];
  });

  return {
    name: state.isExample ? "Example care plan" : (identity?.name ?? null),
    copy: audience === "agency" ? "Agency copy" : "Participant copy",
    facts,
    status: { title: status.title, detail: status.detail, blocked: status.blocked },
    rows,
    days,
    week: { visit: formatDuration(weekMinutes), minutes: grouped.format(weekMinutes), units: unitsCell(weekMinutes) },
    summary,
    months,
    authorizedNote: authorizedNote(calculated) + leftNote(model) + pastDaysNote(model.auth.start, today),
    warning: null,
    checks,
    reviewed: state.reviewed !== null ? niceDate(state.reviewed) : null,
    footer: `Checked with CarePlan Scheduler under rule pack ${pack.id} on ${niceDate(today)}`,
    accruals: audience === "agency" ? model.months.map((month) => ({ month, ...serviceAccrual(model, month) })) : undefined,
  };
}
