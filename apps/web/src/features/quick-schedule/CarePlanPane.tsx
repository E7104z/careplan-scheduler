import { useEffect, useRef, type Dispatch } from "react";
import type { RulePack } from "@careplan/engine";
import { CareDaysSection } from "./CareDaysSection";
import { FusionPlanSection } from "./FusionPlanSection";
import { ServiceSection } from "./ServiceSection";
import type { QuickAction } from "./state";
import { TaskList } from "./TaskList";
import { TransportSection } from "./TransportSection";
import type { QuickModel, QuickState } from "./types";
import type { QuickFeedback } from "./useQuickStore";

export interface CarePlanPaneProps {
  state: QuickState;
  model: QuickModel;
  pack: RulePack;
  feedback: QuickFeedback | null;
  dispatch: Dispatch<QuickAction>;
}

/**
 * APP-SPEC 5.2: the care plan pane. From Fusion the plan's values are locked; by hand they are
 * inputs. Either way, every change is a reducer action, and the reducer applies the guard.
 */
export function CarePlanPane({ state, model, pack, feedback, dispatch }: CarePlanPaneProps) {
  // Focus that has to wait for the change to render (a new task's minutes, the picker).
  const focusAfter = useRef<string | null>(null);
  useEffect(() => {
    const selector = focusAfter.current;
    if (selector === null) return;
    focusAfter.current = null;
    const target = document.querySelector<HTMLElement>(selector);
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
  });

  const seq = feedback?.seq ?? 0;
  return (
    <form
      aria-label="Care plan"
      noValidate
      onSubmit={(event) => event.preventDefault()}
      className="min-w-0 rounded-md border border-line bg-surface"
    >
      {state.source === "fusion" ? (
        <FusionPlanSection state={state} model={model} />
      ) : (
        <ServiceSection state={state} dispatch={dispatch} />
      )}
      <TaskList
        state={state}
        model={model}
        pack={pack}
        feedback={feedback}
        dispatch={dispatch}
        onFocusAfter={(selector) => {
          focusAfter.current = selector;
        }}
      />
      <CareDaysSection state={state} dispatch={dispatch} />
      <TransportSection state={state} model={model} dispatch={dispatch} seq={seq} />
    </form>
  );
}
