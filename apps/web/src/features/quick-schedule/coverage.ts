import type { CoverageBlock, RulePack } from "@careplan/engine";
import { niceDate } from "../../lib/format";
import { newId } from "./ids.js";
import { guardedPlanChange } from "./visits.js";
import type { CarePlan, QuickModel, QuickState } from "./types.js";

export interface CoverageChange {
  plan: CarePlan;
  refusal?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Whether a service takes coverage blocks (Basic or Advanced Respite, Policy 3.50). */
export function isCoverageShift(model: QuickModel): boolean {
  return model.svc.code === "S5150" || model.svc.code === "S5150TF";
}

/**
 * What's wrong with a coverage block entry, or null when it's a valid same-day span inside the
 * service's plan dates. A block is one day; an overnight span isn't offered here.
 */
export function coverageEntryError(state: QuickState, date: string, start: string, end: string): string | null {
  if (date === "") return "Enter the date.";
  if (!DATE.test(date)) return "Enter the date as year, month and day.";
  if (start === "" || end === "") return "Enter the start and end times as hours and minutes, like 9:00 AM.";
  if (!CLOCK.test(start) || !CLOCK.test(end)) return "Enter the start and end times as hours and minutes, like 9:00 AM.";
  if (date < state.plan.start || date > state.plan.end) return `${niceDate(date)} is outside the plan's dates.`;
  if (end <= start) return "The end time must be after the start time.";
  return null;
}

/**
 * Add a respite coverage block (Policy 3.50): a start/end span of care. The span, not any task, is
 * the duration. Added through the guard (APP-SPEC 5.7): a span a rule forbids is refused and
 * nothing changes.
 */
export function addCoverageBlock(
  plan: CarePlan,
  service: number,
  date: string,
  start: string,
  end: string,
  pack: RulePack,
  models: QuickModel[],
): CoverageChange {
  const state = plan.services[service];
  const refuse = (why: string): CoverageChange => ({ plan, refusal: `Not changed. ${why}` });
  if (!state) return refuse("That service isn't in this care plan.");
  const why = coverageEntryError(state, date, start, end);
  if (why !== null) return refuse(why);
  const block: CoverageBlock = { id: newId(), serviceAuthId: state.id, start: `${date}T${start}`, end: `${date}T${end}` };
  const next: CarePlan = {
    ...plan,
    services: plan.services.map((existing, index) =>
      index === service ? { ...state, coverage: [...(state.coverage ?? []), block] } : existing,
    ),
  };
  return guardedPlanChange(plan, next, pack, models);
}

/** Take a coverage block off a service. Removing one can't break a rule, so it isn't guarded. */
export function removeCoverageBlock(plan: CarePlan, service: number, blockId: string): CoverageChange {
  const state = plan.services[service];
  if (!state) return { plan };
  return {
    plan: {
      ...plan,
      services: plan.services.map((existing, index) =>
        index === service ? { ...existing, coverage: (existing.coverage ?? []).filter((block) => block.id !== blockId) } : existing,
      ),
    },
  };
}
