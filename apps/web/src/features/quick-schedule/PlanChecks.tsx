import { useMemo } from "react";
import type { RulePack, Severity, ValidationResult } from "@careplan/engine";
import { cn } from "../../lib/cn";
import { Panel } from "../../ui/Panel";
import { serviceName } from "./carePlan";
import { copyFor } from "./ruleCopy";
import type { CarePlan, QuickModel } from "./types";
import { planVisitResults } from "./visits";

/** One line of the panel: the same finding across rules, services and dates, said once. */
export interface PlanCheckLine {
  severity: Severity;
  /** What it says: the engine's sentence for a missing-data review, else the rule's title. */
  text: string;
  /** What to do, from the rule's copy; "" when the sentence says it all. */
  whatToDo: string;
  ruleIds: string[];
  /** The services it names, in the plan's order. */
  services: string[];
  count: number;
}

const HEADINGS: Record<Severity, string> = {
  BLOCK: "Must fix before you use this schedule",
  REVIEW: "Needs review",
  WARN: "Check",
  INFO: "Good to know",
};
const BORDER: Record<Severity, string> = { BLOCK: "border-l-block", REVIEW: "border-l-review", WARN: "border-l-warn", INFO: "border-l-info" };

/**
 * Plan-level results as lines: grouped by severity and what they say, with the rules and services
 * each names. A finding the engine words itself ("No clock times yet…") is shown in its words.
 */
export function planCheckLines(results: ValidationResult[], plan: CarePlan, models: QuickModel[]): PlanCheckLine[] {
  const names = new Map(plan.services.map((state, index) => [state.id, serviceName(state, models[index]!)]));
  const lines = new Map<string, PlanCheckLine>();
  for (const result of results) {
    const copy = copyFor(result.ruleId, result.severity, result.refs);
    const own = /^No clock times yet/.test(result.message) || /isn't entered|not entered|hasn't confirmed/.test(result.message);
    const text = own || !copy ? result.message : copy.title;
    const key = `${result.severity}|${text}`;
    const line = lines.get(key) ?? { severity: result.severity, text, whatToDo: own || !copy ? "" : copy.whatToDo, ruleIds: [], services: [], count: 0 };
    if (!line.ruleIds.includes(result.ruleId)) line.ruleIds.push(result.ruleId);
    const service = result.refs.serviceAuthId ? names.get(result.refs.serviceAuthId) : undefined;
    if (service && !line.services.includes(service)) line.services.push(service);
    line.count += 1;
    lines.set(key, line);
  }
  const order: Severity[] = ["BLOCK", "REVIEW", "WARN", "INFO"];
  return [...lines.values()].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}

export interface PlanChecksProps {
  plan: CarePlan;
  models: QuickModel[];
  pack: RulePack;
}

/**
 * APP-SPEC 5.8 "Visit checks": the rules that read visits and caregivers, run on the schedule
 * (CP4-1 on). They are about the plan as a whole, so they sit beside each service's own Checks.
 * A rule that can't be checked for want of data is "Needs review": it never counts as passing.
 */
export function PlanChecks({ plan, models, pack }: PlanChecksProps) {
  const lines = useMemo(() => planCheckLines(planVisitResults(plan, models, pack), plan, models), [plan, models, pack]);
  const blocks = lines.filter((line) => line.severity === "BLOCK").length;
  const reviews = lines.filter((line) => line.severity === "REVIEW").length;
  const meta =
    blocks > 0 ? `${blocks} to fix` : reviews > 0 ? `${reviews} ${reviews === 1 ? "needs" : "need"} review` : "Nothing to review";
  return (
    <Panel title="Visit checks" meta={meta} className="min-w-0">
      {lines.length === 0 ? (
        <p className="text-sm text-ink-2">Every visit rule we can check from this schedule's times is met.</p>
      ) : (
        <ul className="grid gap-2">
          {lines.map((line) => (
            <li key={`${line.severity}|${line.text}`} className={cn("grid gap-0.5 rounded-sm border border-l-4 border-line px-3 py-2 text-sm", BORDER[line.severity])}>
              <span className="text-[13px] font-semibold text-ink-2">{HEADINGS[line.severity]}</span>
              <strong className="text-ink">{line.text}</strong>
              {line.whatToDo ? <span className="text-ink-2">{line.whatToDo}</span> : null}
              <span className="text-[13px] text-ink-3">
                {[line.services.join(", "), line.ruleIds.join(", ")].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
