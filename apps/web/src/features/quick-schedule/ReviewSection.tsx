import { useId, type Dispatch } from "react";
import { niceDate } from "../../lib/format";
import { Field } from "../../ui/Field";
import { Panel } from "../../ui/Panel";
import type { QuickAction } from "./state";
import type { QuickState } from "./types";

function todayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

const dateInput = "h-10 w-full rounded-sm border border-line-2 bg-surface px-3 text-ink focus:border-brand max-sm:h-11";

/**
 * APP-SPEC 5.4 "Reviewed with the participant" (optional): INFO 09-25-02 calls collaborating with the
 * participant on the schedule key, and the printed schedule carries the date for an audit. Not a
 * change to the schedule, so not guarded; any later change to the schedule clears it (state.ts).
 */
export function ReviewSection({ state, dispatch }: { state: QuickState; dispatch: Dispatch<QuickAction> }) {
  const checkId = useId();
  const reviewed = state.reviewed;

  return (
    <>
      <Panel title="Review with the participant" meta="Optional" className="min-w-0 print:hidden">
        <div className="grid gap-3">
          <p className="text-sm text-ink-2">
            DSDS calls working out the schedule with the participant key (INFO 09-25-02). Record when you went over this
            one with them; it prints with the schedule. Changing the schedule clears it.
          </p>
          {/* The whole row is the target: 44 px tall on a phone (APP-SPEC 4.4). */}
          <label htmlFor={checkId} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-ink">
            <input
              id={checkId}
              type="checkbox"
              className="h-5 w-5 flex-none accent-brand"
              checked={reviewed !== null}
              onChange={(event) => dispatch({ type: "setReviewed", date: event.target.checked ? todayIso() : null })}
            />
            I went over this schedule with the participant
          </label>
          {reviewed !== null ? (
            <Field label="Date reviewed" className="max-w-[220px]">
              <input
                type="date"
                className={dateInput}
                value={reviewed}
                max={todayIso()}
                onChange={(event) => {
                  if (event.target.value) dispatch({ type: "setReviewed", date: event.target.value });
                }}
              />
            </Field>
          ) : null}
        </div>
      </Panel>
      {/* Print: the date, or a line to write it on. */}
      <p className="hidden text-sm text-ink print:block">
        {reviewed !== null
          ? `Reviewed with the participant on ${niceDate(reviewed)}.`
          : "Reviewed with the participant on ______________________"}
      </p>
    </>
  );
}
