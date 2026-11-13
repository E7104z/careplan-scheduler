import { useEffect, useReducer, useRef, type Dispatch } from "react";
import { MO_2026_07 } from "@careplan/engine";
import { activeIndex, singlePlan } from "./carePlan.js";
import { loadPlan, savePlan } from "./persistence.js";
import { isPlanExtraAction, reducePlanExtra, type PlanExtraAction } from "./planExtraStore.js";
import { exampleStateA, reduce, type QuickAction } from "./state.js";
import type { CarePlan } from "./types.js";

/** APP-SPEC 5.8: changes to the plan as a whole, as opposed to one service's schedule. */
export type PlanAction =
  /** Look at the whole care plan, or one service in detail. */
  | { type: "setView"; view: "plan" | number }
  /** A care plan read from Fusion, with all its services. */
  | { type: "replacePlan"; plan: CarePlan }
  /** The plan's dated side: events on the calendar (applied by the extras chunk, through the guard). */
  | PlanExtraAction;

export type StoreAction = QuickAction | PlanAction;

/** What the last dispatch did, so the screen can show a refusal where it belongs. */
export interface QuickFeedback {
  /** Increases on every dispatch, so the same refusal twice is still news. */
  seq: number;
  action: StoreAction;
  refusal?: string;
  removed?: string[];
}

export interface QuickStore {
  plan: CarePlan;
  feedback: QuickFeedback | null;
}

/**
 * Where a refusal is shown (APP-SPEC 5.7): a task-day change in that task's hint line, a weekly
 * grid cell in the refusal box under the grid, a dated event beside its control, anything else in
 * a toast.
 */
export function refusalPlace(action: StoreAction): "task" | "cell" | "toast" | "event" {
  if (action.type === "placeEvent" || action.type === "recordAmendment") return "event";
  if (action.type === "togglePinDay" || action.type === "unpin") return "task";
  if (action.type === "setCell") return "cell";
  return "toast";
}

function validView(plan: CarePlan, view: "plan" | number): boolean {
  if (view === "plan") return plan.services.length > 1;
  return Number.isInteger(view) && view >= 0 && view < plan.services.length;
}

/**
 * The one reducer for Quick Schedule. A change to a schedule goes to the service being looked at,
 * through `reduce` and so its own guard: each authorization keeps its own rules and units. On
 * the whole care plan no service is open, so such a change does nothing.
 */
export function storeReducer(store: QuickStore, action: StoreAction): QuickStore {
  const seq = (store.feedback?.seq ?? 0) + 1;
  if (action.type === "replacePlan") return { plan: action.plan, feedback: { seq, action } };
  if (action.type === "replace") return { plan: singlePlan(action.state), feedback: { seq, action } };
  if (action.type === "setView") {
    const plan = validView(store.plan, action.view) ? { ...store.plan, view: action.view } : store.plan;
    return { plan, feedback: { seq, action } };
  }
  // Dated events belong to the plan, not to the service being looked at.
  if (isPlanExtraAction(action)) {
    const change = reducePlanExtra(store.plan, action, MO_2026_07);
    return { plan: change.plan, feedback: { seq, action, refusal: change.refusal } };
  }
  const index = activeIndex(store.plan);
  if (index === null) return { plan: store.plan, feedback: { seq, action } };
  const result = reduce(store.plan.services[index]!, action, MO_2026_07);
  const services = store.plan.services.map((state, at) => (at === index ? result.state : state));
  return {
    plan: { ...store.plan, services },
    feedback: { seq, action, refusal: result.refusal, removed: result.removed },
  };
}

/** The tab's saved plan if there is one, else the 5-day example (APP-SPEC 5.1, 5.6). */
export function initialStore(today: Date): QuickStore {
  return { plan: loadPlan() ?? singlePlan(exampleStateA(today)), feedback: null };
}

/**
 * Quick Schedule state with sessionStorage persistence: restored on mount, saved 300 ms after the
 * last change, and saved right away when the page is left (so a quick reload keeps the change).
 */
export function useQuickStore(): [QuickStore, Dispatch<StoreAction>] {
  const [store, dispatch] = useReducer(storeReducer, null, () => initialStore(new Date()));
  const latest = useRef(store.plan);
  useEffect(() => {
    latest.current = store.plan;
  }, [store.plan]);

  useEffect(() => {
    const timer = window.setTimeout(() => savePlan(store.plan), 300);
    return () => window.clearTimeout(timer);
  }, [store.plan]);

  useEffect(() => {
    const flush = () => savePlan(latest.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return [store, dispatch];
}
