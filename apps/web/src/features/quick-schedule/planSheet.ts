import type { RulePack, Weekday } from "@careplan/engine";
import { formatDuration, monthName, niceDate, shortMonth, weekdayName } from "../../lib/format";
import { serviceName, weekMinutes } from "./carePlan";
import { hasSchedule, monthFigures } from "./model";
import { buildScheduleSheet, type ScheduleSheet, type SheetDay, type SheetFact, type SheetFigure } from "./scheduleSheet";
import { scheduleStatus } from "./status";
import type { CarePlan, QuickModel } from "./types";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const grouped = new Intl.NumberFormat("en-US");

function unitsCell(minutes: number): string {
  const rest = minutes % 15;
  return `${Math.floor(minutes / 15)}${rest ? ` + ${rest} min` : ""}`;
}

/** "May 2026 and Aug 2026": the months of the visits, in order. */
function visitMonths(plan: CarePlan): string {
  const months = [...new Set(plan.visits.map((visit) => visit.start.slice(0, 7)))].sort().map(shortMonth);
  return months.length <= 2 ? months.join(" and ") : `${months.slice(0, -1).join(", ")} and ${months.at(-1)}`;
}

/** The month a service's figures are shown for: the one being viewed, else its first scheduled month. */
export function figureMonth(plan: CarePlan, index: number, model: QuickModel): string | null {
  const viewed = plan.services[index]!.viewMonth;
  return model.months.includes(viewed) ? viewed : (model.months[0] ?? null);
}

/**
 * APP-SPEC 5.8 Print: the participant's whole week on one page, every service's tasks and
 * transportation in one grid, each row naming its service. Each service's units by month and
 * its checks are on that service's own page, which follows.
 */
export function buildPlanSheet(plan: CarePlan, models: QuickModel[], pack: RulePack, today: string): ScheduleSheet {
  const sheets = plan.services.map((state, index) => buildScheduleSheet(state, models[index]!, pack, today));
  const names = plan.services.map((state, index) => serviceName(state, models[index]!));
  const first = plan.services[0]!;
  const identity = first.isExample ? null : first.identity;

  const start = plan.services.map((state) => state.plan.start).sort()[0]!;
  const end = plan.services.map((state) => state.plan.end).sort().at(-1)!;
  const scheduleStart = models.map((model) => model.auth.start).sort()[0]!;
  const providers = [...new Set(plan.services.map((state) => state.provider).filter((p): p is string => p !== null))];
  const facts: SheetFact[] = [];
  if (identity) facts.push({ label: "DCN", value: identity.dcn });
  facts.push({ label: "Services", value: names.join(", ") });
  facts.push({ label: "Plan", value: `${niceDate(start)} to ${niceDate(end)}` });
  if (scheduleStart > start) facts.push({ label: "Schedule starts", value: niceDate(scheduleStart) });
  if (providers.length === 1) facts.push({ label: "Provider", value: providers[0]! });
  if (plan.visits.length > 0) facts.push({ label: "Nurse visits", value: visitMonths(plan) });

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
  const checks = sheets.flatMap((sheet, index) =>
    sheet.checks.map((check) => ({ ...check, context: `${names[index]}: ${check.context}` })),
  );
  const reviewed = [...new Set(plan.services.map((state) => state.reviewed))];

  return {
    kind: "plan",
    name: first.isExample ? "Example care plan" : (identity?.name ?? null),
    facts,
    status: {
      title: blocked > 0 ? `${blocked} ${blocked === 1 ? "service" : "services"} to fix` : "Ready to use",
      detail:
        blocked > 0
          ? "A service's care plan itself breaks a Missouri rule. Its page has the details."
          : "Each service follows every rule we check, against its own authorization.",
      blocked: blocked > 0,
    },
    rows,
    days,
    week: { visit: formatDuration(week), minutes: grouped.format(week), units: unitsCell(week) },
    summary,
    months: [],
    authorizedNote:
      "Each service keeps its own authorized units: its page, which follows, has them month by month." +
      (plan.visits.length > 0
        ? ` Nurse visits are authorized by month and aren't in the week: ${plan.visits
            .map((visit) => `${visit.name}, ${monthName(visit.start.slice(0, 7))}`)
            .join("; ")}.`
        : ""),
    cutNote: null,
    checks,
    reviewed: reviewed.length === 1 && reviewed[0] !== null ? niceDate(reviewed[0]!) : null,
    footer: sheets[0]!.footer,
  };
}

/**
 * What prints: one service as its one page (APP-SPEC 5.4); several as the whole week, then each
 * service with anything scheduled on its own page (APP-SPEC 5.8).
 */
export function planSheets(plan: CarePlan, models: QuickModel[], pack: RulePack, today: string): ScheduleSheet | ScheduleSheet[] {
  if (plan.services.length === 1) return buildScheduleSheet(plan.services[0]!, models[0]!, pack, today);
  const pages = plan.services
    .map((state, index) => ({ state, model: models[index]! }))
    .filter(({ model }) => hasSchedule(model))
    .map(({ state, model }) => buildScheduleSheet(state, model, pack, today));
  return [buildPlanSheet(plan, models, pack, today), ...pages];
}
