import { useId, type Dispatch } from "react";
import type { WaiverCode } from "@careplan/engine";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { Select } from "../../ui/Select";
import { TextInput } from "../../ui/TextInput";
import { quietButtonClass } from "./NurseVisits";
import type { CarePlan, PlanWaiver } from "./types";
import type { QuickFeedback, StoreAction } from "./useQuickStore";
import { planWaivers, WAIVER_LABELS } from "./waivers";

const WAIVERS = Object.keys(WAIVER_LABELS) as WaiverCode[];

function WaiverRow({ waiver, index, dispatch }: { waiver: PlanWaiver; index: number; dispatch: Dispatch<StoreAction> }) {
  const id = useId();
  return (
    <li className="grid gap-3 rounded-sm border border-line px-3 py-3 text-sm">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
          <label htmlFor={`${id}-code`}>Waiver</label>
          <Select
            id={`${id}-code`}
            className="w-[240px]"
            value={waiver.waiver}
            onChange={(event) => dispatch({ type: "updateWaiver", index, patch: { waiver: event.target.value as WaiverCode } })}
          >
            {WAIVERS.map((code) => (
              <option key={code} value={code}>
                {WAIVER_LABELS[code]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
          <label htmlFor={`${id}-start`}>Start date</label>
          <TextInput
            id={`${id}-start`}
            type="date"
            className="w-[180px]"
            value={waiver.start}
            onChange={(event) => dispatch({ type: "updateWaiver", index, patch: { start: event.target.value } })}
          />
        </div>
        <div className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
          <label htmlFor={`${id}-end`}>End date</label>
          <TextInput
            id={`${id}-end`}
            type="date"
            className="w-[180px]"
            value={waiver.end}
            onChange={(event) => dispatch({ type: "updateWaiver", index, patch: { end: event.target.value } })}
          />
        </div>
        <button type="button" className={quietButtonClass} aria-label={`Remove waiver ${index + 1}`} onClick={() => dispatch({ type: "removeWaiver", index })}>
          Remove waiver
        </button>
      </div>
    </li>
  );
}

export interface WaiversPanelProps {
  plan: CarePlan;
  feedback: QuickFeedback | null;
  dispatch: Dispatch<StoreAction>;
}

const WAIVER_ACTIONS = new Set(["addWaiver", "updateWaiver", "removeWaiver"]);

/**
 * APP-SPEC 5.8 "Waivers" (CON-16): the waivers the participant is enrolled in, with their dates,
 * entered by the person and never inferred. Two overlapping enrollments are refused in the panel;
 * a waiver service without a covering enrollment is asked for under Visit checks (REVIEW).
 */
export function WaiversPanel({ plan, feedback, dispatch }: WaiversPanelProps) {
  const waivers = planWaivers(plan);
  const refusal = feedback && WAIVER_ACTIONS.has(feedback.action.type) ? (feedback.refusal ?? null) : null;
  return (
    <Panel title="Waivers" meta={waivers.length === 0 ? "None entered" : `${waivers.length} entered`} className="min-w-0 print:hidden">
      <p className="mb-3 text-sm text-ink-2">
        Optional. Enter each waiver this participant is enrolled in, with its dates. It is checked against the
        schedule, never guessed.
      </p>
      {waivers.length > 0 ? (
        <ul className="mb-3 grid gap-2">
          {waivers.map((waiver, index) => (
            <WaiverRow key={index} waiver={waiver} index={index} dispatch={dispatch} />
          ))}
        </ul>
      ) : null}
      <Button variant="secondary" onClick={() => dispatch({ type: "addWaiver" })}>
        Add a waiver
      </Button>
      {refusal ? (
        <p role="alert" className="mt-3 border-l-4 border-l-block pl-2 text-sm text-ink">
          {refusal}
        </p>
      ) : null}
    </Panel>
  );
}
