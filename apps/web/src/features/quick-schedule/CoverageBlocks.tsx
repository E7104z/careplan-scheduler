import { useId, useState, type Dispatch } from "react";
import { coverageBlockUnits } from "@careplan/engine";
import { clockTime, niceDate } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { isCoverageShift } from "./coverage.js";
import { dateInputClass, quietButtonClass } from "./NurseVisits.js";
import type { QuickModel, QuickState } from "./types.js";
import type { QuickFeedback, StoreAction } from "./useQuickStore.js";

export interface CoverageBlocksProps {
  state: QuickState;
  model: QuickModel;
  service: number;
  feedback: QuickFeedback | null;
  dispatch: Dispatch<StoreAction>;
}

/**
 * Respite coverage blocks (Policy 3.50): dated start/end spans of care for a COVERAGE_SHIFT
 * service (Basic or Advanced Respite). The span is the scheduled duration; activities inside it
 * are descriptions and are never added to it. Only shown for a coverage-shift service.
 */
export function CoverageBlocks({ state, model, service, feedback, dispatch }: CoverageBlocksProps) {
  const id = useId();
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  if (!isCoverageShift(model)) return null;
  const blocks = state.coverage ?? [];
  const refusal =
    feedback && feedback.action.type === "addCoverageBlock" && feedback.action.service === service ? (feedback.refusal ?? null) : null;
  return (
    <Panel
      title="Respite coverage blocks"
      meta={blocks.length === 0 ? "None yet" : String(blocks.length)}
      className="min-w-0 print:hidden"
    >
      <p className="mb-3 text-sm text-ink-2">
        A coverage block is its start and end time. What happens inside it is described, never added on top.
      </p>
      {blocks.length > 0 ? (
        <ul className="mb-4 grid gap-2 text-sm">
          {blocks.map((block) => (
            <li key={block.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-sm border border-line px-3 py-2">
              <span className="text-ink">
                {`${niceDate(block.start.slice(0, 10))} · ${clockTime(block.start.slice(11))} to ${clockTime(block.end.slice(11))} · ${coverageBlockUnits(block)} units`}
              </span>
              <button
                type="button"
                className={quietButtonClass}
                aria-label={`Remove the coverage block on ${niceDate(block.start.slice(0, 10))}`}
                onClick={() => dispatch({ type: "removeCoverageBlock", service, blockId: block.id })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="grid gap-3 sm:grid-cols-4 sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({ type: "addCoverageBlock", service, date, start, end });
        }}
      >
        <label htmlFor={`${id}-date`} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
          Date
          <input
            id={`${id}-date`}
            type="date"
            className={dateInputClass}
            min={state.plan.start}
            max={state.plan.end}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label htmlFor={`${id}-start`} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
          Start time
          <input id={`${id}-start`} type="time" className={dateInputClass} value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label htmlFor={`${id}-end`} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
          End time
          <input id={`${id}-end`} type="time" className={dateInputClass} value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
        <Button type="submit">Add coverage block</Button>
      </form>
      {refusal ? (
        <p role="alert" className="mt-3 border-l-4 border-l-block pl-2 text-sm text-ink">
          {refusal}
        </p>
      ) : null}
    </Panel>
  );
}
