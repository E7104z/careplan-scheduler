import {
  mergeFusionText,
  parseFusionText,
  type ImportIssue,
  type ImportIssueCode,
  type ImportResult,
  type ImportedService,
} from "@careplan/import";
import { daysInMonth, type RulePack, type ServiceCode } from "@careplan/engine";
import { niceDate } from "../../lib/format";
import { localMonth } from "../quick-schedule/model.js";
import { fromFusion } from "./fromFusion.js";
import type { Plan, QuickState } from "../quick-schedule/types.js";

/** IMPORT-SPEC 3.1: issues that stop a plan from building until the person resolves them. */
const HARD_STOPS: readonly ImportIssueCode[] = [
  "no-rows",
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
  serviceCode: ServiceCode | null;
  serviceIndex: number | null;
  plan: Plan | null;
}

export interface ImportFlow {
  pages: string[];
  choices: ImportChoices;
}

export function emptyImportFlow(): ImportFlow {
  return {
    pages: [],
    choices: { acceptPartial: false, serviceCode: null, serviceIndex: null, plan: null },
  };
}

export type ImportChoice =
  | { kind: "acceptPartial" }
  | { kind: "serviceCode"; code: ServiceCode }
  | { kind: "serviceIndex"; index: number }
  | { kind: "plan"; plan: Plan };

export function addPage(flow: ImportFlow, text: string): ImportFlow {
  return { ...flow, pages: [...flow.pages, text] };
}

export function setChoice(flow: ImportFlow, choice: ImportChoice): ImportFlow {
  const choices = { ...flow.choices };
  if (choice.kind === "acceptPartial") choices.acceptPartial = true;
  else if (choice.kind === "serviceCode") choices.serviceCode = choice.code;
  else if (choice.kind === "serviceIndex") choices.serviceIndex = choice.index;
  else choices.plan = choice.plan;
  return { ...flow, choices };
}

export type ImportOutcome =
  | { kind: "needs"; parsed: ImportResult; serviceIndex: number | null; issues: ImportIssue[] }
  | { kind: "ready"; state: QuickState };

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

/** Whether an issue is about the chosen service (issues carry the row or task, not the service). */
function concerns(issue: ImportIssue, service: ImportedService): boolean {
  if (issue.code === "unread-row") return service.unread.some((row) => row.raw === issue.raw);
  if (issue.code === "unknown-task" || issue.code === "odd-minutes") {
    return service.tasks.some((task) => task.name === issue.name);
  }
  if (issue.code === "unknown-service") return issue.label === service.label;
  return true;
}

/** Parse the pasted pages, then either report the hard stops still open or build the state. */
export function next(flow: ImportFlow, pack: RulePack, today: Date): ImportOutcome {
  const { parsed, refusedPage } = readPages(flow, pack);
  const index = resolveServiceIndex(parsed, flow.choices);
  const chosen = index === null ? undefined : parsed.services[index];
  const entered = flow.choices.plan;
  const enteredOk = entered !== null && isValidPlan(entered);

  const issues: ImportIssue[] = [...parsed.issues];
  if (refusedPage !== null) {
    issues.unshift({
      level: "error",
      code: "different-participant",
      message: `Page ${refusedPage} is for a different participant.`,
    });
  }
  if (entered !== null && !enteredOk) issues.push(BAD_DATES);
  // A schedule is for care still to come: a plan that ended before this month has nothing left.
  const plan = enteredOk ? entered : (parsed.plan ?? (chosen?.start && chosen.end ? { start: chosen.start, end: chosen.end } : null));
  const ended = plan !== null && chosen !== undefined && plan.end < `${localMonth(today)}-01`;
  if (ended) {
    issues.push({ level: "error", code: "plan-ended", message: `This care plan ended on ${niceDate(plan.end)}.` });
  }

  const pending = issues.filter((issue) => {
    if (!HARD_STOPS.includes(issue.code)) return false;
    if (issue.code === "incomplete") return !flow.choices.acceptPartial;
    // Which service a label is only matters once that service is the one being built.
    if (issue.code === "unknown-service") {
      return chosen !== undefined && chosen.serviceCode === null && flow.choices.serviceCode === null
        && concerns(issue, chosen);
    }
    // Dates the person entered that have already ended can be entered again.
    if (issue.code === "no-plan-dates" || issue.code === "bad-dates") return !enteredOk || (ended && entered !== null);
    return true;
  });
  if (pending.length > 0 || index === null || chosen === undefined) {
    return { kind: "needs", parsed, serviceIndex: index, issues: pending };
  }

  const resolved = structuredClone(parsed);
  const service = resolved.services[index]!;
  if (service.serviceCode === null) service.serviceCode = flow.choices.serviceCode;
  if (enteredOk) resolved.plan = entered;

  const state = fromFusion(resolved, index, today);
  state.notes = parsed.issues.filter(
    (issue) =>
      (!HARD_STOPS.includes(issue.code) || issue.code === "incomplete") && concerns(issue, chosen),
  );
  return { kind: "ready", state };
}

/**
 * IMP-12: combine the pages. A page for a different participant (another DCN) is refused: it is
 * left out, and reported while it is the latest page, so pasting the right page carries on.
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

function resolveServiceIndex(parsed: ImportResult, choices: ImportChoices): number | null {
  if (parsed.services.length === 1) return 0;
  const index = choices.serviceIndex;
  return index !== null && Number.isInteger(index) && index >= 0 && index < parsed.services.length
    ? index
    : null;
}
