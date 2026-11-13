import type { RulePack, Weekday } from "@careplan/engine";
import type { AmendmentDraft } from "./amendments.js";
import type { EventRequest } from "./planEvents.js";
import type { CarePlan, DayChange } from "./types.js";

/**
 * Changes to the plan's dated side (Coverage Phase 3 on): events on the calendar. The code that
 * applies them is its own chunk (`extras.ts`), loaded only for a plan that has something to
 * place, so the Quick Schedule page stays inside its size budget. The store still owns the
 * change: every one of these actions goes through `reducePlanExtra`, and so through the guard.
 */
export type PlanExtraAction =
  /** Place a dated event, or move or change one already placed (`event.id`). Refused with the limit. */
  | { type: "placeEvent"; event: EventRequest }
  /** Take a dated event off the plan. */
  | { type: "removeEvent"; eventId: string }
  /** Record a care plan change on a service (its place in the plan). Refused with the reason. */
  | { type: "recordAmendment"; service: number; amendment: AmendmentDraft }
  /** Take a recorded change off a service. */
  | { type: "removeAmendment"; service: number; amendmentId: string }
  /** "Change this day": a task's minutes on one date, over the weekly pattern. Refused with the limit. */
  | { type: "changeDay"; service: number; change: DayChange }
  /** Set (or clear, with null) a service's visit start time on a weekday. Refused if it would break an overlap rule. */
  | { type: "setStartTime"; service: number; weekday: Weekday; time: string | null };

export interface PlanExtraChange {
  plan: CarePlan;
  refusal?: string;
}

export type PlanExtraReducer = (plan: CarePlan, action: PlanExtraAction, pack: RulePack) => PlanExtraChange;

const EXTRA_TYPES: ReadonlySet<string> = new Set<PlanExtraAction["type"]>([
  "placeEvent", "removeEvent", "recordAmendment", "removeAmendment", "changeDay", "setStartTime",
]);

export function isPlanExtraAction(action: { type: string }): action is PlanExtraAction {
  return EXTRA_TYPES.has(action.type);
}

let reducer: PlanExtraReducer | null = null;

/** Called once by the extras chunk when it loads. */
export function registerPlanExtras(next: PlanExtraReducer): void {
  reducer = next;
}

/**
 * Apply a dated-side change. The controls that send these actions live in the extras chunk, so
 * it has loaded by the time one arrives; if it somehow hasn't, the change is refused, never
 * applied unchecked.
 */
export function reducePlanExtra(plan: CarePlan, action: PlanExtraAction, pack: RulePack): PlanExtraChange {
  return reducer ? reducer(plan, action, pack) : { plan, refusal: "Not changed. The page is still loading; try again." };
}
