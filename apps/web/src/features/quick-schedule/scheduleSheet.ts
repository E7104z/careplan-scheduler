import type { RulePack, Weekday } from "@careplan/engine";
import { formatDuration, formatUnits, niceDate, shortMonth, weekdayName } from "../../lib/format";
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
const PRINTED_SEVERITIES = { BLOCK: "Must fix", REVIEW: "Needs review", WARN: "Worth checking" } as const;

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
  /** Minutes cut at month end (SCH-17), or "". */
  cut: string;
  /** The first date cut short ("Dec 30"), or "". */
  cutFrom: string;
}

export interface SheetCheck {
  severity: keyof typeof PRINTED_SEVERITIES;
  label: string;
  title: string;
  context: string;
}

/**
 * Everything the one-page printed schedule says (APP-SPEC 5.4 Print), worked out from the same
 * model and copy as the screen. `schedulePdf.ts` only lays it out.
 */
export interface ScheduleSheet {
  /** The participant's name from Fusion, "Example care plan", or null: lines to write name and DCN on. */
  name: string | null;
  facts: SheetFact[];
  status: { title: string; detail: string; blocked: boolean };
  rows: SheetRow[];
  /** Sunday to Saturday. */
  days: SheetDay[];
  week: SheetTotals;
  summary: SheetFigure[];
  months: SheetMonth[];
  authorizedNote: string;
  cutNote: string | null;
  checks: SheetCheck[];
  /** "Oct 21, 2026", or null: a line to write the date on. */
  reviewed: string | null;
  footer: string;
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

function authorizedNote(model: QuickModel, calculated: boolean[]): string {
  if (calculated.every(Boolean)) return "Authorized is calculated from the tasks: there's no Fusion figure for these months.";
  const fusion = model.prorated
    ? "Authorized is Fusion's figure, counted for each month's days as Fusion does."
    : "Authorized is Fusion's figure for each month.";
  return calculated.some(Boolean) ? `${fusion} * Calculated from the tasks: no Fusion figure for that month.` : fusion;
}

/**
 * APP-SPEC 5.4 Print: the one-page schedule for the participant, the caregiver and the file. Who
 * and what (name, DCN, service, plan, Fusion's units, provider, PA), the week from Sunday to
 * Saturday with each visit's length, every month's units and cuts, the checks, the review with
 * the participant and when it was checked.
 */
export function buildScheduleSheet(state: QuickState, model: QuickModel, pack: RulePack, today: string): ScheduleSheet {
  const status = scheduleStatus(state, model);

  // The example is titled as the example, without its sample DCN, as in the read summary.
  const identity = state.isExample ? null : state.identity;
  const facts: SheetFact[] = [];
  if (identity) facts.push({ label: "DCN", value: identity.dcn });
  facts.push({ label: "Service", value: `${state.serviceLabel ?? model.svc.name} · ${model.svc.code}` });
  facts.push({ label: "Plan", value: `${niceDate(state.plan.start)} to ${niceDate(state.plan.end)}` });
  if (model.auth.start > state.plan.start) facts.push({ label: "Schedule starts", value: niceDate(model.auth.start) });
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
      visit: minutes > 0 ? formatDuration(minutes) : null,
      minutes: minutes > 0 ? grouped.format(minutes) : "",
      units: minutes > 0 ? unitsCell(minutes) : "",
    };
  });
  const weekMinutes = visits.reduce((sum, visit) => sum + visit.taskMinutes + visit.transportMinutes, 0);

  const careDays = WEEKDAYS.filter((weekday) => model.entries.some((entry) => entry.weekday === weekday));
  const summary: SheetFigure[] = [
    { label: "Task minutes a week", value: grouped.format(status.weekMinutes), note: formatUnits(status.weekMinutes) },
    { label: "Care days", value: `${status.careDays} a week`, note: daysList(careDays) },
  ];
  if (model.allowance) {
    summary.push({
      label: "Essential transportation",
      value: `${model.allowance.weeklyMinutes} min on ${weekdayName(state.transport.day)}`,
      note: `${model.allowance.minutesPerMonth} minutes a month (${model.allowance.units} units), set aside before tasks`,
    });
  }

  // Every month of the schedule, and where its units run out (SCH-17). When some months have
  // Fusion's figure and others don't, the calculated ones are starred.
  const calculated: boolean[] = [];
  const someFromFusion = model.monthlyAuthorizations.length > 0;
  const months: SheetMonth[] = model.months.map((month) => {
    const figures = monthFigures(model, month);
    const { scheduledMinutes, leftMinutes } = monthBalance(figures);
    const firstCut = figures.trims.map((trim) => trim.date).sort()[0];
    calculated.push(figures.source !== "fusion");
    return {
      label: shortMonth(month),
      authorized: `${figures.authorizedUnits}${figures.source !== "fusion" && someFromFusion ? "*" : ""}`,
      scheduled: unitsCell(scheduledMinutes),
      left: leftMinutes >= 0 ? unitsCell(leftMinutes) : `${-leftMinutes} min over`,
      over: leftMinutes < 0,
      cut: figures.trimmedMinutes ? `${figures.trimmedMinutes} min` : "",
      // "Dec 30, 2025" -> "Dec 30": the month is in the column's heading.
      cutFrom: figures.trimmedMinutes && firstCut ? niceDate(firstCut).replace(/, \d+$/, "") : "",
    };
  });
  const cutNote = months.some((month) => month.cut)
    ? "When a month's units run out, its last visits are shorter, starting on the date shown. If the units run out every " +
      "month, the care plan needs more than Fusion authorizes. DSDS says a consistent need to change a task should " +
      "prompt a request to the care plan change team (INFO 09-25-02)."
    : null;

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
    facts,
    status: { title: status.title, detail: status.detail, blocked: status.blocked },
    rows,
    days,
    week: { visit: formatDuration(weekMinutes), minutes: grouped.format(weekMinutes), units: unitsCell(weekMinutes) },
    summary,
    months,
    authorizedNote: authorizedNote(model, calculated),
    cutNote,
    checks,
    reviewed: state.reviewed !== null ? niceDate(state.reviewed) : null,
    footer: `Checked with CarePlan Scheduler under rule pack ${pack.id} on ${niceDate(today)}`,
  };
}
