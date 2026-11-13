import { useId, type Dispatch } from "react";
import { addMinutesLocal } from "@careplan/engine";
import { clockTime, formatDuration, weekdayName } from "../../lib/format";
import { Panel } from "../../ui/Panel";
import { weekMinutes } from "./carePlan";
import { dateInputClass } from "./NurseVisits";
import type { QuickModel, QuickState } from "./types";
import type { QuickFeedback, StoreAction } from "./useQuickStore";
import { careWeekdays, startTimeOn, visitEndText } from "./visits";

export interface VisitTimesProps {
  state: QuickState;
  model: QuickModel;
  /** The service's place in the plan. */
  service: number;
  feedback: QuickFeedback | null;
  dispatch: Dispatch<StoreAction>;
}

/**
 * APP-SPEC 5.8 "Visit start times": an optional start time for each care day of a service. The
 * visit's length is the day's total already shown as its visit length; the end is the start plus
 * that length. With times set, overlaps with other services can be checked.
 */
export function VisitTimes({ state, model, service, feedback, dispatch }: VisitTimesProps) {
  const id = useId();
  const days = careWeekdays(state, model);
  if (days.length === 0) return null;
  const minutes = weekMinutes(state, model);
  const refusal =
    feedback && feedback.action.type === "setStartTime" && feedback.action.service === service ? (feedback.refusal ?? null) : null;
  const set = days.filter((weekday) => startTimeOn(state, weekday) !== null).length;
  return (
    <Panel title="Visit start times" meta={set === 0 ? "None set" : `${set} of ${days.length} set`} className="min-w-0 print:hidden">
      <p className="mb-3 text-sm text-ink-2">Optional. Add a start time to check overlaps with other services.</p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {days.map((weekday) => {
          const time = startTimeOn(state, weekday);
          // Any date gives the same end on an ordinary day; a clock-change day is handled where visits are built.
          const end = time === null ? null : addMinutesLocal(`2026-01-05T${time}`, minutes[weekday]!);
          return (
            <li key={weekday} className="grid gap-1 rounded-sm border border-line px-3 py-2 text-sm">
              <label htmlFor={`${id}-${weekday}`} className="grid gap-0.5 font-semibold text-ink">
                {`${weekdayName(weekday)} start time`}
                <input
                  id={`${id}-${weekday}`}
                  type="time"
                  className={dateInputClass}
                  value={time ?? ""}
                  onChange={(event) => dispatch({ type: "setStartTime", service, weekday, time: event.target.value === "" ? null : event.target.value })}
                />
              </label>
              <span className="text-[13px] text-ink-2">
                {`Visit length ${formatDuration(minutes[weekday]!)}`}
                {time !== null && end !== null ? `, ${visitEndText(`2026-01-05T${time}`, end, clockTime)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
      {refusal ? (
        <p role="alert" className="mt-3 border-l-4 border-l-block pl-2 text-sm text-ink">
          {refusal}
        </p>
      ) : null}
    </Panel>
  );
}
