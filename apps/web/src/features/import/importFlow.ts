import {
  mergeFusionText,
  parseFusionText,
  type ImportIssue,
  type ImportIssueCode,
  type ImportResult,
  type ImportedService,
  type ImportedVisit,
} from "@careplan/import";
import { daysInMonth, type RulePack, type ServiceCode } from "@careplan/engine";
import { niceDate } from "../../lib/format";
import { dayLoad } from "../quick-schedule/carePlan.js";
import { newId } from "../quick-schedule/ids.js";
import { localMonth } from "../quick-schedule/model.js";
import { fromFusion, serviceDates, SPREAD_DAYS } from "./fromFusion.js";
import type { CarePlan, Plan, PlanOther, PlanVisit, QuickState } from "../quick-schedule/types.js";

/** IMPORT-SPEC 3.1: issues that stop a plan from building until the person resolves them. */
const HARD_STOPS: readonly ImportIssueCode[] = [
  "no-rows",
  "nothing-to-schedule",
  "incomplete",
  "unknown-service",
  "no-plan-dates",
  "bad-dates",
  "different-participant",
  "plan-ended",
];

const BAD_DATES: ImportIssue = {
  level: "error",
  code: "bad-dates",
  message: "The plan dates don't make sense. Check them against Fusion.",
};

export interface ImportChoices {
  acceptPartial: boolean;
  /** IMP-11: the service the person chose for a Fusion label we haven't seen, by label. */
  serviceCodes: Record<string, ServiceCode>;
  /** IMP-19: labels the person chose to keep with the plan without a schedule. */
  kept: string[];
  plan: Plan | null;
}

export interface ImportFlow {
  pages: string[];
  choices: ImportChoices;
}

export function emptyImportFlow(): ImportFlow {
  return {
    pages: [],
    choices: { acceptPartial: false, serviceCodes: {}, kept: [], plan: null },
  };
}

export type ImportChoice =
  | { kind: "acceptPartial" }
  /** The service a label stands for. */
  | { kind: "serviceCode"; label: string; code: ServiceCode }
  /** Keep the service with the plan, not scheduled (IMP-19). */
  | { kind: "keep"; label: string }
  | { kind: "plan"; plan: Plan };

export function addPage(flow: ImportFlow, text: string): ImportFlow {
  return { ...flow, pages: [...flow.pages, text] };
}

export function setChoice(flow: ImportFlow, choice: ImportChoice): ImportFlow {
  const choices = { ...flow.choices, serviceCodes: { ...flow.choices.serviceCodes }, kept: [...flow.choices.kept] };
  if (choice.kind === "acceptPartial") choices.acceptPartial = true;
  else if (choice.kind === "serviceCode") choices.serviceCodes[choice.label] = choice.code;
  else if (choice.kind === "keep") choices.kept.push(choice.label);
  else choices.plan = choice.plan;
  return { ...flow, choices };
}

export type ImportOutcome =
  | { kind: "needs"; parsed: ImportResult; issues: ImportIssue[] }
  | { kind: "ready"; plan: CarePlan };

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** IMP-13: dates the person entered are real dates, and the plan doesn't end before it starts. */
function isValidPlan(plan: Plan): boolean {
  return isRealDate(plan.start) && isRealDate(plan.end) && plan.start <= plan.end;
}

/** Notes that belong to one service (a row, a task); the others are about the plan as a whole. */
const SERVICE_NOTES: readonly ImportIssueCode[] = ["unread-row", "unknown-task", "odd-minutes"];

/** Whether a note is about this service (notes carry the row or task, not the service). */
function concerns(issue: ImportIssue, service: ImportedService): boolean {
  if (issue.code === "unread-row") return service.unread.some((row) => row.raw === issue.raw);
  if (issue.code === "unknown-task" || issue.code === "odd-minutes") {
    return service.tasks.some((task) => task.name === issue.name);
  }
  return false;
}

/** IMP-18: a visit as the schedule lists it. */
function planVisit(visit: ImportedVisit, pack: RulePack): PlanVisit {
  const name = visit.name ?? pack.services.find((service) => service.code === visit.serviceCode)?.name ?? visit.serviceCode;
  return {
    id: newId(), label: visit.label, serviceCode: visit.serviceCode, name, provider: visit.provider,
    start: visit.start, end: visit.end, units: visit.units, pa: visit.pa,
    tasks: visit.tasks.map((task) => ({ ...task })),
  };
}

/** "Bathing, 30 min a day, 7 days a week": a task of a service the person kept, as its row. */
function keptRows(service: ImportedService): string[] {
  return [
    ...service.tasks.map((task) => `${task.fusionName}, ${task.minPerDay} min a day, ${task.daysPerWeek} days a week`),
    ...(service.transport ? [`Essential Transportation, ${service.transport.unitsPerMonth} units a month`] : []),
    ...service.unread.map((row) => row.raw),
  ];
}

/**
 * Parse what the PDFs read as, then either report the hard stops still open or build the participant's
 * whole care plan (APP-SPEC 5.8): one schedule state per authorization, in Fusion's order, each
 * with its own dates, units and checks, and the visits by month. A service whose authorization
 * ended before this month is left out with a note; when all have ended, the plan has ended.
 * Authorizations the schedule doesn't place, and services the person chose to keep, go in
 * `others` with their rows (IMP-19): nothing read is dropped.
 */
export function next(flow: ImportFlow, pack: RulePack, today: Date): ImportOutcome {
  const { parsed, refusedPage } = readPages(flow, pack);
  const entered = flow.choices.plan;
  const enteredOk = entered !== null && isValidPlan(entered);
  const thisMonth = `${localMonth(today)}-01`;
  const codeFor = (service: ImportedService): ServiceCode | null =>
    service.serviceCode ?? (service.label !== null ? (flow.choices.serviceCodes[service.label] ?? null) : null);
  const keptByChoice = (service: ImportedService): boolean =>
    service.serviceCode === null && service.label !== null && flow.choices.kept.includes(service.label);

  const issues: ImportIssue[] = [...parsed.issues];
  if (refusedPage !== null) {
    issues.unshift({
      level: "error",
      code: "different-participant",
      message: `Page ${refusedPage} is for a different participant.`,
    });
  }
  if (entered !== null && !enteredOk) issues.push(BAD_DATES);

  // A schedule is for care still to come: an authorization that ended before this month has nothing left.
  const datesOf = (service: ImportedService) => (enteredOk ? entered : serviceDates(parsed, service));
  const ended = (service: ImportedService) => {
    const dates = datesOf(service);
    return dates !== null && dates.end < thisMonth;
  };
  const current = parsed.services.filter((service) => !ended(service));
  const allEnded = parsed.services.length > 0 && current.length === 0;
  if (allEnded) {
    const last = parsed.services.map((service) => datesOf(service)!.end).sort().at(-1)!;
    issues.push({ level: "error", code: "plan-ended", message: `This care plan ended on ${niceDate(last)}.` });
  }

  const pending = issues.filter((issue) => {
    if (!HARD_STOPS.includes(issue.code)) return false;
    if (issue.code === "incomplete") return !flow.choices.acceptPartial;
    // Which service a label is matters only for a service still to come, until the person says.
    if (issue.code === "unknown-service") {
      return current.some((service) => service.label === issue.label && codeFor(service) === null && !keptByChoice(service));
    }
    // Dates the person entered that have already ended can be entered again.
    if (issue.code === "no-plan-dates" || issue.code === "bad-dates") return !enteredOk || (allEnded && entered !== null);
    return true;
  });
  if (pending.length > 0 || current.length === 0) {
    return { kind: "needs", parsed, issues: pending };
  }
  // Every service still to come was kept: there's nothing to place in the week.
  if (current.every(keptByChoice)) {
    const labels = current.map((service) => service.label).join(", ");
    return {
      kind: "needs",
      parsed,
      issues: [{
        level: "error", code: "nothing-to-schedule",
        message: `None of this care plan's authorizations has tasks to place in the week: ${labels}.`,
      }],
    };
  }

  const resolved = structuredClone(parsed);
  if (enteredOk) resolved.plan = entered;
  const services: QuickState[] = [];
  const others: PlanOther[] = parsed.others.map((other) => ({ ...other, id: newId(), monthly: [...other.monthly], rows: [...other.rows] }));
  const notes: ImportIssue[] = parsed.issues.filter(
    (issue) => !SERVICE_NOTES.includes(issue.code) && (!HARD_STOPS.includes(issue.code) || issue.code === "incomplete"),
  );
  // APP-SPEC 5.8 (superseded Oct 31, 2026): the client's services combine on one shared set of
  // care days, sized to the largest days-per-week among the services being scheduled, spread
  // across the week (Nov 17, 2026 review). Each service
  // then takes its own days from that set, so none spreads onto its own days of the week.
  const scheduled = parsed.services.filter((service) => !ended(service) && !keptByChoice(service));
  const sharedSize = scheduled.reduce((max, service) => {
    const daysPerWeek = service.tasks.reduce((largest, task) => Math.max(largest, task.daysPerWeek), 1);
    return Math.max(max, daysPerWeek);
  }, 1);
  const sharedDays = [...SPREAD_DAYS[Math.min(sharedSize, 7)]!];
  parsed.services.forEach((service, index) => {
    if (ended(service)) {
      notes.push({
        level: "warn", code: "plan-ended", label: service.label ?? undefined,
        message: `${service.label ?? "A service"} ended on ${niceDate(datesOf(service)!.end)}, so it isn't scheduled.`,
      });
      return;
    }
    if (keptByChoice(service)) {
      const dates = datesOf(service);
      others.push({
        id: newId(), label: service.label, code: null, registryId: null, provider: service.provider, pa: service.pa,
        start: dates?.start ?? null, end: dates?.end ?? null, monthly: service.monthly ?? [], rows: keptRows(service),
      });
      notes.push({
        level: "warn", code: "kept", label: service.label ?? undefined,
        message: `${service.label} isn't scheduled: you chose to keep it with the plan without a schedule.`,
      });
      return;
    }
    resolved.services[index]!.serviceCode = codeFor(service);
    const state = fromFusion(resolved, index, today, services.length > 0 ? dayLoad(services, pack) : undefined, sharedDays);
    state.notes = parsed.issues.filter((issue) => SERVICE_NOTES.includes(issue.code) && concerns(issue, service));
    services.push(state);
  });

  return {
    kind: "ready",
    plan: {
      services,
      visits: parsed.visits.map((visit) => planVisit(visit, pack)),
      others,
      notes,
      view: services.length > 1 ? "plan" : 0,
    },
  };
}

/**
 * IMP-12: combine the pages. A page for a different participant (another DCN) is refused: it is
 * left out, and reported while it is the latest page, so opening the right PDF carries on.
 * A task already read is dropped, keeping the first.
 */
function readPages(flow: ImportFlow, pack: RulePack): { parsed: ImportResult; refusedPage: number | null } {
  const kept: string[] = [];
  let dcn: string | null = null;
  let refusedPage: number | null = null;
  flow.pages.forEach((page, i) => {
    const pageDcn = parseFusionText(page, pack).participant?.dcn ?? null;
    if (dcn !== null && pageDcn !== null && pageDcn !== dcn) {
      refusedPage = i + 1;
      return;
    }
    dcn ??= pageDcn;
    kept.push(page);
    refusedPage = null;
  });

  const parsed = kept.length > 1 ? mergeFusionText(kept, pack) : parseFusionText(kept[0] ?? "", pack);
  const services = parsed.services.map((service) => {
    const seen = new Set<string>();
    return {
      ...service,
      tasks: service.tasks.filter((task) => {
        const key = task.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    };
  });
  return {
    parsed: { ...parsed, services, issues: parsed.issues.filter((issue) => issue.code !== "duplicate-task") },
    refusedPage,
  };
}
