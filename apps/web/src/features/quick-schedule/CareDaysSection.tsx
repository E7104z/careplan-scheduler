import type { Dispatch } from "react";
import type { Weekday } from "@careplan/engine";
import { DayToggle } from "../../ui/DayToggle";
import { PaneSection } from "./PaneSection";
import type { QuickAction } from "./state";
import type { QuickState } from "./types";

/** QS-08: the days the caregiver works. Every change goes through the guard. */
export function CareDaysSection({ state, dispatch }: { state: QuickState; dispatch: Dispatch<QuickAction> }) {
  return (
    <PaneSection title="Care days" hint="Days the caregiver works">
      <DayToggle
        value={state.activeDays}
        onChange={(index) => dispatch({ type: "toggleCareDay", weekday: index as Weekday })}
        className="flex-wrap"
      />
      {state.activeDays.some(Boolean) ? null : (
        <p className="text-[13px] text-block">Choose at least one care day.</p>
      )}
    </PaneSection>
  );
}
