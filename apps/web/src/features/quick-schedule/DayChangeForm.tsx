import { useEffect, useId, useState, type Dispatch } from "react";
import { niceDate, weekdayName } from "../../lib/format";
import { Button } from "../../ui/Button";
import { NumberField } from "../../ui/NumberField";
import type { CalendarCell } from "./calendarView";
import type { PlanOccurrence } from "./normalizeEvents";
import type { CarePlan } from "./types";
import type { QuickFeedback, StoreAction } from "./useQuickStore";

export interface DayChangeFormProps {
  plan: CarePlan;
  cell: CalendarCell;
  /** The task occurrences of the date, from the one occurrence list. */
  tasks: PlanOccurrence[];
  feedback: QuickFeedback | null;
  dispatch: Dispatch<StoreAction>;
}

/**
 * APP-SPEC 5.8 "Change this day": the minutes each task has on one date. It records a one-day
 * change over the weekly pattern, through the guard; the pattern and the authorization stay as
 * they are. A refusal is shown here with the limit.
 */
export function DayChangeForm({ plan, cell, tasks, feedback, dispatch }: DayChangeFormProps) {
  const id = useId();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDrafts({});
    setError(null);
  }, [cell.date]);
  const refusal =
    feedback && feedback.action.type === "changeDay" && feedback.action.change.date === cell.date ? (feedback.refusal ?? null) : null;
  const title = `${weekdayName(cell.weekday)}, ${niceDate(cell.date)}`;

  const save = (occurrence: PlanOccurrence) => {
    const key = `${occurrence.authorizationId}:${occurrence.taskId}`;
    const text = (drafts[key] ?? String(occurrence.minutes ?? 0)).trim();
    const service = plan.services.findIndex((state) => state.id === occurrence.authorizationId);
    if (!/^\d+$/.test(text)) return setError("Enter the minutes as a whole number.");
    if (service < 0 || occurrence.taskId === undefined) return;
    setError(null);
    dispatch({ type: "changeDay", service, change: { date: cell.date, taskId: occurrence.taskId, minutes: Number(text) } });
  };

  return (
    <div role="group" aria-label={`Change this day: ${title}`} className="mt-4 grid gap-2 rounded-sm bg-sunk px-3 py-3 print:hidden">
      <p className="text-sm font-semibold text-ink">{`Change this day: ${title}`}</p>
      {tasks.length === 0 ? (
        <p className="text-sm text-ink-2">No task is scheduled this day.</p>
      ) : (
        <>
          <p className="text-[13px] text-ink-2">
            This changes only {niceDate(cell.date)}. The weekly pattern and the authorization stay as they are. Enter 0 to
            take a task off this day.
          </p>
          <ul className="grid gap-2">
            {tasks.map((occurrence) => {
              const key = `${occurrence.authorizationId}:${occurrence.taskId}`;
              const label = `${occurrence.service}: ${occurrence.what}, minutes on ${niceDate(cell.date)}`;
              return (
                <li key={key} className="flex flex-wrap items-end gap-x-3 gap-y-1">
                  <label htmlFor={`${id}-${key}`} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
                    <span>
                      {`${occurrence.service}: ${occurrence.what}`}
                      <span className="sr-only">{`, minutes on ${niceDate(cell.date)}`}</span>
                    </span>
                    <NumberField
                      id={`${id}-${key}`}
                      className="w-[110px]"
                      value={drafts[key] ?? String(occurrence.minutes ?? 0)}
                      onChange={(event) => setDrafts({ ...drafts, [key]: event.target.value })}
                    />
                  </label>
                  <Button variant="secondary" size="sm" aria-label={`Save ${label}`} onClick={() => save(occurrence)}>
                    Save this day
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {error ?? refusal ? (
        <p role="alert" className="border-l-4 border-l-block pl-2 text-sm text-ink">
          {error ?? refusal}
        </p>
      ) : null}
    </div>
  );
}
