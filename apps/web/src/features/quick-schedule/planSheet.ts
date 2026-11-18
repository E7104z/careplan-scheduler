import type { RulePack, Weekday } from "@careplan/engine";
import { formatDuration, niceDate, shortMonth, weekdayName } from "../../lib/format";
import { figureMonth, serviceName, serviceDayWarning, serviceDays, weekMinutes } from "./carePlan";
import { hasSchedule, monthFigures } from "./model";
import { eventsOf } from "./planEvents";
import { planCheckLines } from "./PlanChecks";
import { copyFor } from "./ruleCopy";
import {
  buildScheduleSheet,
  dateRange,
  pastDaysNote,
  PRINTED_SEVERITIES,
  type ScheduleSheet,
  type SheetCheck,
  type SheetDay,
  type SheetFact,
  type SheetFigure,
  type SheetNurseVisit,
} from "./scheduleSheet";
import { otherLines, planOthers } from "./others";
import { scheduleStatus } from "./status";
import type { CarePlan, PlanVisit, QuickModel, VisitTask } from "./types";
import { planVisitResults } from "./visits";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const grouped = new Intl.NumberFormat("en-US");

function unitsCell(minutes: number): string {
  const rest = minutes % 15;
  return `${Math.floor(minutes / 15)}${rest ? ` + ${rest} min` : ""}`;
}

/** "Jun to Nov 2026", "Dec 2026 to Feb 2027", or "Nov 2026": the first and last of some months. */
function monthSpan(months: string[]): string {
  const sorted = [...new Set(months)].sort();
  const first = sorted[0]!;
  const last = sorted.at(-1)!;
  if (first === last) return shortMonth(first);
  return first.slice(0, 4) === last.slice(0, 4) ? `${shortMonth(first).slice(0, 3)} to ${shortMonth(last)}` : `${shortMonth(first)} to ${shortMonth(last)}`;
}

/**
 * The plan's nurse visit authorizations, each with its months in order: one per prior
 * authorization (Fusion lists an authorization once per month, so a plan of two six-month
 * authorizations has twelve visits and two authorizations).
 */
export function visitAuthorizations(plan: CarePlan): PlanVisit[][] {
  const groups = new Map<string, PlanVisit[]>();
  for (const visit of plan.visits) {
    const key = [visit.pa ?? "", visit.label ?? "", visit.serviceCode, visit.pa === null ? visit.name : ""].join("|");
    groups.set(key, [...(groups.get(key) ?? []), visit]);
  }
  return [...groups.values()].map((visits) => [...visits].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)));
}

/** The authorization's task rows; a plan saved before Nov 17, 2026 has only the name. */
function visitTasks(visit: PlanVisit): VisitTask[] {
  return visit.tasks && visit.tasks.length > 0 ? visit.tasks : [{ name: visit.name, unitsPerMonth: null }];
}

function perMonth(task: VisitTask): string {
  return task.unitsPerMonth === null ? task.name : `${task.name} ${task.unitsPerMonth} a month`;
}

/** The figure Fusion authorizes most months, the first seen on a tie. */
function usualUnits(visits: PlanVisit[]): number {
  const counts = new Map<number, number>();
  for (const visit of visits) counts.set(visit.units, (counts.get(visit.units) ?? 0) + 1);
  return [...counts.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

/** Tasks that add up to another number of visits than Fusion authorized a month, or null. */
function visitMismatch(visits: PlanVisit[]): { total: number; authorized: number; parts: string } | null {
  const tasks = visitTasks(visits[0]!);
  if (tasks.some((task) => task.unitsPerMonth === null)) return null;
  const total = tasks.reduce((sum, task) => sum + task.unitsPerMonth!, 0);
  const authorized = usualUnits(visits);
  if (total === authorized) return null;
  return { total, authorized, parts: tasks.map((task) => `${task.name} ${task.unitsPerMonth}`).join(", ") };
}

function visitWho(visit: PlanVisit): string {
  const label = visit.label ?? visit.name;
  return visit.pa ? `${label}, PA ${visit.pa}` : label;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "Eval APC Plan 2 a month and Train APC 1 a month". */
function joinAnd(items: string[]): string {
  return items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * The printout's Nurse visits page (Nov 17, 2026 review): each authorization once, with its
 * tasks and visits a month, every month Fusion authorized with the dates placed, and tasks that
 * don't add up to the authorization flagged for the care manager.
 */
export function nurseVisitSheet(plan: CarePlan): SheetNurseVisit[] {
  return visitAuthorizations(plan).map((visits) => {
    const first = visits[0]!;
    const mismatch = visitMismatch(visits);
    return {
      title: [first.label ?? first.name, first.pa ? `PA ${first.pa}` : null].filter(Boolean).join(" · "),
      detail: [first.serviceCode, first.provider].filter(Boolean).join(" · "),
      tasks: visitTasks(first).map(perMonth).join(", "),
      months: visits.map((visit) => {
        const dates = visit.id ? eventsOf(plan, visit.id).filter((event) => event.kind === "NURSE_VISIT").map((event) => niceDate(event.date).replace(/, \d+$/, "")) : [];
        return { label: shortMonth(visit.start.slice(0, 7)), authorized: String(visit.units), placed: dates.length > 0 ? dates.join(", ") : "–" };
      }),
      review: mismatch
        ? `The tasks add up to ${plural(mismatch.total, "visit", "visits")} a month (${mismatch.parts}), but Fusion authorized ` +
          `${mismatch.authorized} a month. Ask the care manager which is right; the plan keeps Fusion's ${mismatch.authorized}.`
        : null,
    };
  });
}

/** One Needs review card per nurse visit authorization whose tasks don't add up. */
function visitChecks(plan: CarePlan): SheetCheck[] {
  return visitAuthorizations(plan).flatMap((visits) => {
    const mismatch = visitMismatch(visits);
    if (!mismatch) return [];
    return [{
      severity: "REVIEW" as const,
      label: PRINTED_SEVERITIES.REVIEW,
      title: "Nurse visit tasks don't add up to the authorization",
      context: `${visitWho(visits[0]!)}: ${plural(mismatch.total, "visit", "visits")} a month in its tasks, ${mismatch.authorized} authorized. Ask the care manager which is right.`,
    }];
  });
}

/**
 * What the week leaves out, for the printout's note: nurse visits, once per authorization with
 * their tasks, and the authorizations kept without a schedule (IMP-19), so a printout never
 * drops part of the care plan.
 */
function outsideWeekNote(plan: CarePlan): string {
  const groups = visitAuthorizations(plan);
  const visits =
    groups.length > 0
      ? ` Nurse visits are authorized by month and aren't in the week; their page is at the end: ${groups
          .map((group) => {
            const units = usualUnits(group);
            const tasks = visitTasks(group[0]!);
            // One task that is the whole authorization needs no count of its own.
            const named = tasks.length === 1 && tasks[0]!.unitsPerMonth === units ? tasks[0]!.name : joinAnd(tasks.map(perMonth));
            return `${visitWho(group[0]!)}: ${named}, ${plural(units, "visit", "visits")} a month authorized`;
          })
          .join("; ")}.`
      : "";
  const others = planOthers(plan).length > 0 ? ` Also in the care plan, not in the week: ${otherLines(plan).join(" ")}` : "";
  return visits + others;
}

/** "This care plan ends Nov 30, 2026, 13 days after…", when it ends within 30 days of today; else null. */
export function planEndNotice(end: string, today: string): string | null {
  const days = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  if (days < 0 || days > 30) return null;
  const when = days === 0 ? `today, ${niceDate(end)}` : `${niceDate(end)}, ${plural(days, "day", "days")} after this schedule was made`;
  return `This care plan ends ${when}. Care after that date needs a new care plan; check with the care manager.`;
}

/**
 * The visit rules on the whole plan (APP-SPEC 5.8 "Visit checks"), as printed cards: overlaps,
 * caregivers, waivers and programs, worded as the screen words them. A rule that can't be
 * checked for want of clock times is Needs review, never a pass.
 */
function visitRuleChecks(plan: CarePlan, models: QuickModel[], pack: RulePack): SheetCheck[] {
  return planCheckLines(planVisitResults(plan, models, pack), plan, models).flatMap((line) => {
    if (line.severity === "INFO") return [];
    const own = line.whatToDo || copyFor(line.ruleIds[0]!, line.severity)?.whatToDo || "";
    const whatToDo = line.services.length > 1 ? own.replace("of this service", "of each service") : own;
    const lowered = whatToDo ? whatToDo.charAt(0).toLowerCase() + whatToDo.slice(1) : "";
    const services = joinAnd(line.services);
    return [{
      severity: line.severity,
      label: PRINTED_SEVERITIES[line.severity],
      title: line.text,
      context: services ? `${services}${lowered ? `: ${lowered}` : "."}` : whatToDo,
    }];
  });
}

const SEVERITY_ORDER = ["BLOCK", "REVIEW", "WARN"] as const;

/** A service page's note with `outside` put before its closing note on past days (`past`, or ""). */
function withOutside(note: string, outside: string, past: string): string {
  return past && note.endsWith(past) ? note.slice(0, -past.length) + outside + past : note + outside;
}

/**
 * APP-SPEC 5.8 Print: the participant's whole week on one page, every service's tasks and
 * transportation in one grid, each row naming its service. Each service's units by month and
 * its checks are on that service's own page, which follows.
 */
export function buildPlanSheet(
  plan: CarePlan,
  models: QuickModel[],
  pack: RulePack,
  today: string,
  audience: "client" | "agency" = "client",
): ScheduleSheet {
  const sheets = plan.services.map((state, index) => buildScheduleSheet(state, models[index]!, pack, today));
  const names = plan.services.map((state, index) => serviceName(state, models[index]!));
  const first = plan.services[0]!;
  const identity = first.isExample ? null : first.identity;

  const start = plan.services.map((state) => state.plan.start).sort()[0]!;
  const end = plan.services.map((state) => state.plan.end).sort().at(-1)!;
  const scheduleStart = models.map((model) => model.auth.start).sort()[0]!;
  const scheduleEnd = models.map((model) => model.auth.end).sort().at(-1)!;
  const providers = [...new Set(plan.services.map((state) => state.provider).filter((p): p is string => p !== null))];
  const facts: SheetFact[] = [];
  if (identity) facts.push({ label: "DCN", value: identity.dcn });
  facts.push({ label: "Services", value: names.join(", ") });
  facts.push({ label: "Plan", value: `${niceDate(start)} to ${niceDate(end)}` });
  if (scheduleStart > start) facts.push({ label: "Schedule covers", value: dateRange(scheduleStart, scheduleEnd) });
  if (providers.length === 1) facts.push({ label: "Provider", value: providers[0]! });
  facts.push({ label: "Service days this week", value: `${serviceDays(plan, models)}` });
  if (plan.visits.length > 0) {
    const authorizations = visitAuthorizations(plan).length;
    facts.push({
      label: "Nurse visits",
      value: `${plural(authorizations, "authorization", "authorizations")}, ${monthSpan(plan.visits.map((visit) => visit.start.slice(0, 7)))}`,
    });
  }
  if (planOthers(plan).length > 0) facts.push({ label: "Not in the week", value: String(planOthers(plan).length) });

  // One grid: each service's rows in Fusion's order, each naming its service.
  const rows = sheets.flatMap((sheet, index) =>
    sheet.rows.map((row) => ({ ...row, detail: `${names[index]} · ${row.detail}` })),
  );

  const byDay = WEEKDAYS.map(() => 0);
  plan.services.forEach((state, index) => {
    weekMinutes(state, models[index]!).forEach((minutes, day) => (byDay[day]! += minutes));
  });
  const days: SheetDay[] = WEEKDAYS.map((weekday) => {
    const minutes = byDay[weekday]!;
    return {
      name: weekdayName(weekday),
      care: plan.services.some((state) => state.activeDays[weekday] === true),
      visit: minutes > 0 ? formatDuration(minutes) : null,
      minutes: minutes > 0 ? grouped.format(minutes) : "",
      units: minutes > 0 ? unitsCell(minutes) : "",
    };
  });
  const week = byDay.reduce((sum, minutes) => sum + minutes, 0);

  // Each service in figures: its week and its own authorization.
  const summary: SheetFigure[] = plan.services.map((state, index) => {
    const model = models[index]!;
    const month = figureMonth(plan, index, model);
    const authorized = month ? `${monthFigures(model, month).authorizedUnits} units in ${shortMonth(month).split(" ")[0]}` : "No month left";
    const minutes = weekMinutes(state, model).reduce((sum, value) => sum + value, 0);
    return {
      label: names[index]!,
      value: `${grouped.format(minutes)} min a week`,
      note: `${authorized}${state.pa ? ` · PA ${state.pa}` : ""}`,
    };
  });

  const statuses = plan.services.map((state, index) => scheduleStatus(state, models[index]!));
  const blocked = statuses.filter((status) => status.blocked).length;
  // Each service's own checks, then the visit rules on the whole plan and the nurse visits.
  const checks = [
    ...sheets.flatMap((sheet, index) => sheet.checks.map((check) => ({ ...check, context: `${names[index]}: ${check.context}` }))),
    ...visitRuleChecks(plan, models, pack),
    ...visitChecks(plan),
  ].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  const visitBlocks = checks.filter((check) => check.severity === "BLOCK").length - sheets.reduce((sum, sheet) => sum + sheet.checks.filter((check) => check.severity === "BLOCK").length, 0);
  const reviews = checks.filter((check) => check.severity === "REVIEW").length;
  const reviewed = [...new Set(plan.services.map((state) => state.reviewed))];
  const warning = [serviceDayWarning(plan, models), planEndNotice(end, today)].filter((note): note is string => note !== null).join(" ") || null;
  const toFix = blocked + visitBlocks;

  return {
    kind: "plan",
    name: first.isExample ? "Example care plan" : (identity?.name ?? null),
    copy: audience === "agency" ? "Agency copy" : "Participant copy",
    facts,
    status: {
      title:
        toFix > 0
          ? visitBlocks === 0
            ? `${blocked} ${blocked === 1 ? "service" : "services"} to fix`
            : `${toFix} ${toFix === 1 ? "thing" : "things"} to fix`
          : reviews > 0
            ? `${reviews} to review`
            : "Ready to use",
      detail:
        toFix > 0
          ? visitBlocks === 0
            ? "A service's care plan itself breaks a Missouri rule. Its page has the details."
            : "The schedule breaks a Missouri rule. Checks has the details."
          : reviews > 0
            ? `No service breaks a rule we check. ${plural(reviews, "item needs", "items need")} review: see Checks.`
            : "Each service follows every rule we check, against its own authorization.",
      blocked: toFix > 0,
      review: toFix === 0 && reviews > 0,
    },
    rows,
    days,
    week: { visit: formatDuration(week), minutes: grouped.format(week), units: unitsCell(week) },
    summary,
    months: [],
    authorizedNote:
      "Each scheduled service has its own page after this one, with its units month by month." +
      outsideWeekNote(plan) +
      pastDaysNote(scheduleStart, today),
    cutNote: null,
    warning,
    checks,
    reviewed: reviewed.length === 1 && reviewed[0] !== null ? niceDate(reviewed[0]!) : null,
    footer: sheets[0]!.footer,
    nurseVisits: plan.visits.length > 0 ? nurseVisitSheet(plan) : undefined,
  };
}

/**
 * What prints: one service as its one page (APP-SPEC 5.4); several as the whole week, then each
 * service with anything scheduled on its own page (APP-SPEC 5.8).
 */
export function planSheets(
  plan: CarePlan,
  models: QuickModel[],
  pack: RulePack,
  today: string,
  audience: "client" | "agency" = "client",
): ScheduleSheet | ScheduleSheet[] {
  if (plan.services.length === 1) {
    const sheet = buildScheduleSheet(plan.services[0]!, models[0]!, pack, today, audience);
    const added = visitChecks(plan);
    const checks = [...sheet.checks, ...added];
    const status =
      added.length > 0 && !sheet.status.blocked
        ? { ...sheet.status, detail: `Follows every rule we check. ${plural(added.length, "nurse visit item needs", "nurse visit items need")} review in Checks.`, review: true }
        : sheet.status;
    return {
      ...sheet,
      status,
      checks,
      // What the week leaves out goes before the note on past days, as on the whole plan's page.
      authorizedNote: withOutside(sheet.authorizedNote, outsideWeekNote(plan), pastDaysNote(models[0]!.auth.start, today)),
      warning: planEndNotice(plan.services[0]!.plan.end, today),
      nurseVisits: plan.visits.length > 0 ? nurseVisitSheet(plan) : undefined,
    };
  }
  const pages = plan.services
    .map((state, index) => ({ state, model: models[index]! }))
    .filter(({ model }) => hasSchedule(model))
    .map(({ state, model }) => buildScheduleSheet(state, model, pack, today, audience));
  return [buildPlanSheet(plan, models, pack, today, audience), ...pages];
}
