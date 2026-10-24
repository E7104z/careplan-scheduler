import { useEffect, useReducer, useRef, type Dispatch } from "react";
import { MO_2026_07 } from "@careplan/engine";
import { loadQuickState, saveQuickState } from "./persistence.js";
import { exampleStateA, reduce, type QuickAction } from "./state.js";
import type { QuickState } from "./types.js";

/** What the last dispatch did, so the screen can show a refusal where it belongs. */
export interface QuickFeedback {
  /** Increases on every dispatch, so the same refusal twice is still news. */
  seq: number;
  action: QuickAction;
  refusal?: string;
  removed?: string[];
}

export interface QuickStore {
  state: QuickState;
  feedback: QuickFeedback | null;
}

/**
 * Where a refusal is shown (APP-SPEC 5.7): a task-day change in that task's hint line, a weekly
 * grid cell in the refusal box under the grid, anything else in a toast.
 */
export function refusalPlace(action: QuickAction): "task" | "cell" | "toast" {
  if (action.type === "togglePinDay" || action.type === "unpin") return "task";
  if (action.type === "setCell") return "cell";
  return "toast";
}

/** The one reducer for Quick Schedule: every action goes through `reduce`, and so the guard. */
export function storeReducer(store: QuickStore, action: QuickAction): QuickStore {
  const result = reduce(store.state, action, MO_2026_07);
  return {
    state: result.state,
    feedback: { seq: (store.feedback?.seq ?? 0) + 1, action, refusal: result.refusal, removed: result.removed },
  };
}

/** The tab's saved plan if there is one, else the 5-day example (APP-SPEC 5.1, 5.6). */
export function initialStore(today: Date): QuickStore {
  return { state: loadQuickState() ?? exampleStateA(today), feedback: null };
}

/**
 * Quick Schedule state with sessionStorage persistence: restored on mount, saved 300 ms after the
 * last change, and saved right away when the page is left (so a quick reload keeps the change).
 */
export function useQuickStore(): [QuickStore, Dispatch<QuickAction>] {
  const [store, dispatch] = useReducer(storeReducer, null, () => initialStore(new Date()));
  const latest = useRef(store.state);
  useEffect(() => {
    latest.current = store.state;
  }, [store.state]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveQuickState(store.state), 300);
    return () => window.clearTimeout(timer);
  }, [store.state]);

  useEffect(() => {
    const flush = () => saveQuickState(latest.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return [store, dispatch];
}
