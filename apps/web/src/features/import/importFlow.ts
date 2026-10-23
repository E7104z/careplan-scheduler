import {
  mergeFusionText,
  parseFusionText,
  type ImportIssue,
  type ImportIssueCode,
  type ImportResult,
} from "@careplan/import";
import type { RulePack, ServiceCode } from "@careplan/engine";
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
];

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

/** Parse the pasted pages, then either report the hard stops still open or build the state. */
export function next(flow: ImportFlow, pack: RulePack, today: Date): ImportOutcome {
  const parsed = readPages(flow, pack);
  const index = resolveServiceIndex(parsed, flow.choices);
  const pending = parsed.issues.filter(
    (issue) =>
      HARD_STOPS.includes(issue.code) &&
      !(issue.code === "incomplete" && flow.choices.acceptPartial) &&
      !(issue.code === "unknown-service" && flow.choices.serviceCode !== null) &&
      !(issue.code === "no-plan-dates" && flow.choices.plan !== null),
  );
  if (pending.length > 0 || index === null) {
    return { kind: "needs", parsed, serviceIndex: index, issues: pending };
  }

  const resolved = structuredClone(parsed);
  if (flow.choices.serviceCode !== null) {
    resolved.services[index!]!.serviceCode = flow.choices.serviceCode;
  }
  if (resolved.plan === null && flow.choices.plan !== null) {
    resolved.plan = flow.choices.plan;
  }

  const state = fromFusion(resolved, index!, today);
  state.notes = parsed.issues.filter(
    (issue) => !HARD_STOPS.includes(issue.code) || issue.code === "incomplete",
  );
  const service = resolved.services[index!]!;
  state.rowsRead = service.tasks.length + (service.transport ? 1 : 0);
  return { kind: "ready", state };
}

/** IMP-12: combine pages; a row already read is dropped, keeping the first. */
function readPages(flow: ImportFlow, pack: RulePack): ImportResult {
  const parsed =
    flow.pages.length > 1
      ? mergeFusionText(flow.pages, pack)
      : parseFusionText(flow.pages[0] ?? "", pack);
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
    ...parsed,
    services,
    issues: parsed.issues.filter((issue) => issue.code !== "duplicate-task"),
  };
}

function resolveServiceIndex(parsed: ImportResult, choices: ImportChoices): number | null {
  if (parsed.services.length === 1) return 0;
  return Number.isInteger(choices.serviceIndex) ? choices.serviceIndex : null;
}
