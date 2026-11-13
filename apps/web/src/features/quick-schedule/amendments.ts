import {
  amendmentEffectiveDate,
  applyAmendment,
  chainOf,
  ruleAMEND01EffectiveDates,
  type AmendmentDirection,
  type AuthorizationChain,
  type DaysPerWeek,
  type RulePack,
  type ValidationResult,
} from "@careplan/engine";
import { niceDate } from "../../lib/format";
import { refusalText } from "./guard.js";
import { newId } from "./ids.js";
import { buildQuickModel, isFullMonth, monthsBetween } from "./model.js";
import type { CarePlan, PlanAmendment, QuickModel, QuickState } from "./types.js";

export const DIRECTION_LABELS: Record<AmendmentDirection, string> = {
  increase: "Increase",
  decrease: "Decrease",
  "reduction-immediate": "Reduction asked for by the participant",
};

/**
 * A service's recorded care plan changes, in the order they were recorded. The guard only accepts
 * a change that takes effect after the last one, so this is also oldest first; they are never
 * re-sorted, because a change slipped in before a later one would rewrite what that one left.
 */
export function amendmentsOf(state: QuickState): PlanAmendment[] {
  return state.amendments ?? [];
}

/**
 * The service as the care plan has it from a change's effective date on: the task minutes and days
 * the change gives, the plan starting that day, and Fusion's units only if the change states them.
 * The imported state is never edited: this is a copy, and the copy carries no cell changes (they
 * belonged to the pattern before the change).
 */
export function amendedState(state: QuickState, amendment: PlanAmendment, effectiveFrom: string): QuickState {
  const next = structuredClone(state);
  next.amendments = undefined;
  next.plan = { start: effectiveFrom, end: state.plan.end };
  next.fromMonth = effectiveFrom.slice(0, 7) > state.fromMonth ? effectiveFrom.slice(0, 7) : state.fromMonth;
  next.viewMonth = next.fromMonth;
  next.edits = {};
  next.tasks = next.tasks.map((task) => {
    const change = amendment.tasks[task.id];
    if (!change) return task;
    // 0 minutes takes the task out of the week from the change on.
    return { ...task, minPerDay: change.minPerDay === 0 ? null : change.minPerDay, daysPerWeek: change.daysPerWeek, pinned: null };
  });
  next.headerUnits = null;
  next.fusion = {};
  if (amendment.units !== null) {
    for (const month of monthsBetween(effectiveFrom, state.plan.end)) {
      if (isFullMonth(month, effectiveFrom, state.plan.end)) next.fusion[month] = amendment.units;
    }
  }
  return next;
}

export interface ServiceVersion {
  /** Null for the plan as imported or built. */
  amendment: PlanAmendment | null;
  effectiveFrom: string;
  state: QuickState;
  model: QuickModel;
}

export interface ServiceChain {
  chain: AuthorizationChain;
  versions: ServiceVersion[];
}

/**
 * A service with its recorded changes as the engine's chain of versions: the Manual 4.20
 * behavior sets each change's effective date, and occurrences are recalculated from that date
 * forward only. Throws what the engine throws for a change that would rewrite history.
 */
export function serviceChain(state: QuickState, model: QuickModel, pack: RulePack): ServiceChain {
  let chain = chainOf(model.auth, model.template);
  const versions: ServiceVersion[] = [{ amendment: null, effectiveFrom: model.auth.start, state, model }];
  for (const amendment of amendmentsOf(state)) {
    const effectiveFrom = amendmentEffectiveDate(amendment.direction, amendment.date);
    const variant = amendedState(state, amendment, effectiveFrom);
    const variantModel = buildQuickModel(variant, pack);
    chain = applyAmendment(chain, {
      amendmentId: amendment.id,
      direction: amendment.direction,
      date: amendment.date,
      dateConfirmed: amendment.confirmed,
      authorization: { ...variantModel.auth, start: model.auth.start },
      template: { ...variantModel.template, start: model.auth.start },
    });
    versions.push({ amendment, effectiveFrom, state: variant, model: variantModel });
  }
  return { chain, versions };
}

/** AMEND-01 for a service: one REVIEW for each change whose date isn't confirmed from the care plan. */
export function amendmentResults(state: QuickState, model: QuickModel, pack: RulePack): ValidationResult[] {
  if (amendmentsOf(state).length === 0) return [];
  return ruleAMEND01EffectiveDates(serviceChain(state, model, pack).chain);
}

/** What the person enters to record a change. */
export interface AmendmentDraft {
  direction: AmendmentDirection;
  date: string;
  confirmed: boolean;
  tasks: Record<string, { minPerDay: number; daysPerWeek: DaysPerWeek }>;
  units: number | null;
}

export interface AmendmentChange {
  plan: CarePlan;
  refusal?: string;
}

function refuse(plan: CarePlan, why: string): AmendmentChange {
  return { plan, refusal: `Not recorded. ${why}` };
}

/**
 * Record a care plan change on a service, through the guard (APP-SPEC 5.7). Refused, with the
 * reason and the plan unchanged, when the change names nothing, would take effect outside the
 * schedule or before a change already recorded, or would itself break a Must-fix rule. An
 * accepted change adds a version; the imported Fusion figures are never edited.
 */
export function recordAmendment(plan: CarePlan, service: number, draft: AmendmentDraft, pack: RulePack): AmendmentChange {
  const state = plan.services[service];
  if (!state) return refuse(plan, "That service isn't in this care plan.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return refuse(plan, "Enter the date the change takes effect.");
  const changed = Object.entries(draft.tasks).filter(([taskId, change]) => {
    const task = state.tasks.find((candidate) => candidate.id === taskId);
    return task !== undefined && (task.minPerDay !== (change.minPerDay === 0 ? null : change.minPerDay) || task.daysPerWeek !== change.daysPerWeek);
  });
  if (changed.length === 0 && draft.units === null) {
    return refuse(plan, "Change a task's minutes or days, or enter the new units a month.");
  }
  const model = buildQuickModel({ ...state, amendments: undefined }, pack);
  const amendment: PlanAmendment = {
    id: newId(), direction: draft.direction, date: draft.date, confirmed: draft.confirmed,
    tasks: Object.fromEntries(changed), units: draft.units,
  };
  const next: QuickState = { ...state, amendments: [...(state.amendments ?? []), amendment], reviewed: null };
  const effectiveFrom = amendmentEffectiveDate(draft.direction, draft.date);
  let built: ServiceChain;
  try {
    built = serviceChain(next, model, pack);
  } catch {
    const last = amendmentsOf(state).at(-1);
    const after = last ? amendmentEffectiveDate(last.direction, last.date) : model.auth.start;
    return refuse(
      plan,
      `A change takes effect after ${niceDate(after)} and no later than ${niceDate(state.plan.end)}; this one would take effect on ${niceDate(effectiveFrom)}.`,
    );
  }
  const version = built.versions.find((candidate) => candidate.amendment?.id === amendment.id);
  const blocks = version?.model.results.filter((result) => result.severity === "BLOCK") ?? [];
  if (version && blocks.length > 0) return refuse(plan, refusalText(blocks, version.state, version.model));
  const services = plan.services.map((existing, index) => (index === service ? next : existing));
  return { plan: { ...plan, services } };
}

/** Take a recorded change off a service. The versions after it stay as recorded. */
export function removeAmendment(plan: CarePlan, service: number, amendmentId: string): CarePlan {
  const services = plan.services.map((state, index) =>
    index === service ? { ...state, amendments: (state.amendments ?? []).filter((amendment) => amendment.id !== amendmentId), reviewed: null } : state,
  );
  return { ...plan, services };
}

/** "Bathing: 30 min a day, 7 days a week → 15 min a day, 5 days a week". */
export function amendmentLines(state: QuickState, amendment: PlanAmendment): string[] {
  const lines = Object.entries(amendment.tasks).flatMap(([taskId, change]) => {
    const task = state.tasks.find((candidate) => candidate.id === taskId);
    if (!task) return [];
    const before = `${task.minPerDay ?? 0} min a day, ${task.daysPerWeek} ${task.daysPerWeek === 1 ? "day" : "days"} a week`;
    const after = change.minPerDay === 0 ? "not in the week" : `${change.minPerDay} min a day, ${change.daysPerWeek} ${change.daysPerWeek === 1 ? "day" : "days"} a week`;
    return [`${task.name}: ${before} → ${after}`];
  });
  if (amendment.units !== null) lines.push(`${amendment.units} units a month from the change on`);
  return lines;
}

/** "Takes effect Jan 1, 2027", with why when a decrease was moved to a month's first day. */
export function amendmentWhen(amendment: PlanAmendment): string {
  const effectiveFrom = amendmentEffectiveDate(amendment.direction, amendment.date);
  return effectiveFrom === amendment.date
    ? `Takes effect ${niceDate(effectiveFrom)}`
    : `Takes effect ${niceDate(effectiveFrom)} (entered ${niceDate(amendment.date)}; a decrease starts on the first of a month)`;
}
