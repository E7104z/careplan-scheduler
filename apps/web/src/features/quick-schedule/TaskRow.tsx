import { useEffect, useId, useState, type Dispatch } from "react";
import { Lock, Trash2 } from "lucide-react";
import { daysInMonth, monthTaskUnits, type DaysPerWeek, type Weekday } from "@careplan/engine";
import { monthName } from "../../lib/format";
import { DayToggle } from "../../ui/DayToggle";
import { Field } from "../../ui/Field";
import { NumberField } from "../../ui/NumberField";
import { Select } from "../../ui/Select";
import type { QuickAction } from "./state";
import type { QuickState, QuickTask } from "./types";

const DAYS: DaysPerWeek[] = [1, 2, 3, 4, 5, 6, 7];

function daysText(days: DaysPerWeek): string {
  return days === 7 ? "every day" : `${days} ${days === 1 ? "day" : "days"} a week`;
}

/** QS-05: whole minutes from 1 to 1440, else null (the task is left out until it's fixed). */
function parseMinutes(text: string): number | null {
  const value = /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
  return Number.isInteger(value) && value >= 1 && value <= 1440 ? value : null;
}

export interface TaskRowProps {
  task: QuickTask;
  state: QuickState;
  /** The days the schedule gives this task before any cell change (the composer's or the pinned). */
  placedDays: Weekday[];
  /** A refused change to this task's days, shown in its hint line (APP-SPEC 5.7). */
  refusal: string | null;
  /** Changes on every dispatch, so a refused value goes back to what the schedule holds. */
  seq: number;
  dispatch: Dispatch<QuickAction>;
  onRemove: () => void;
}

function MinutesAndDays({ task, seq, dispatch }: Pick<TaskRowProps, "task" | "seq" | "dispatch">) {
  const [draft, setDraft] = useState(task.minPerDay === null ? "" : String(task.minPerDay));
  // An invalid entry stays visible next to its error; anything else shows what the schedule holds.
  useEffect(() => {
    if (task.minPerDay !== null) setDraft(String(task.minPerDay));
  }, [task.minPerDay, seq]);
  const commit = () => {
    const minutes = parseMinutes(draft);
    if (minutes !== task.minPerDay) dispatch({ type: "setMinutes", taskId: task.id, minutes });
  };
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Field
        label="Minutes per day"
        hint={task.minPerDay !== null && task.minPerDay % 5 !== 0 ? "Most care plans use 5-minute steps." : undefined}
        error={task.minPerDay === null ? "Enter whole minutes, like 15 or 30." : undefined}
      >
        <NumberField
          data-minutes-for={task.id}
          min={1}
          max={1440}
          step={5}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
      </Field>
      <Field label="Days per week">
        <Select
          value={task.daysPerWeek}
          onChange={(event) =>
            dispatch({ type: "setDaysPerWeek", taskId: task.id, days: Number(event.target.value) as DaysPerWeek })
          }
        >
          {DAYS.map((days) => (
            <option key={days} value={days}>
              {days === 7 ? "Every day" : `${days} ${days === 1 ? "day" : "days"}`}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

/**
 * One task in the care plan pane: its units in the viewed month, its minutes and days (locked
 * from Fusion, inputs by hand) and its days of the week (QS-07). Every change is dispatched
 * through the reducer, which applies the guard.
 */
export function TaskRow({ task, state, placedDays, refusal, seq, dispatch, onRemove }: TaskRowProps) {
  const nameId = useId();
  const [year = 0, month = 1] = state.viewMonth.split("-").map(Number);
  const units =
    task.minPerDay === null
      ? null
      : monthTaskUnits(task.minPerDay * task.daysPerWeek, task.daysPerWeek, daysInMonth(year, month)).units;
  const placed = new Set(placedDays);
  const shown = [0, 1, 2, 3, 4, 5, 6].map((day) => placed.has(day as Weekday));
  const pinned = task.pinned !== null;

  return (
    <div role="group" aria-labelledby={nameId} className="grid gap-2.5 rounded-sm border border-line bg-surface p-3">
      <div className="flex items-center gap-2">
        <span id={nameId} className="min-w-0 flex-1 font-semibold text-ink">
          {task.name}
        </span>
        {units !== null ? (
          <span className="whitespace-nowrap text-[13px] text-ink-2">
            {`${units} units in ${monthName(state.viewMonth).slice(0, 3)}`}
          </span>
        ) : null}
        {task.locked ? null : (
          <button
            type="button"
            aria-label={`Remove ${task.name}`}
            onClick={onRemove}
            className="grid h-8 w-8 flex-none place-items-center rounded-sm text-ink-3 hover:bg-sunk hover:text-block max-sm:h-11 max-sm:w-11"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {task.locked ? (
        <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
          <Lock className="h-3.5 w-3.5 flex-none text-ink-3" aria-hidden="true" />
          {`${task.minPerDay ?? 0} min a day · ${daysText(task.daysPerWeek)}`}
        </p>
      ) : (
        <MinutesAndDays task={task} seq={seq} dispatch={dispatch} />
      )}

      <DayToggle
        label={`${task.name} days`}
        value={shown}
        auto={pinned ? undefined : shown}
        disabledDays={state.activeDays.map((active) => !active)}
        onChange={(index) =>
          dispatch({ type: "togglePinDay", taskId: task.id, weekday: index as Weekday, placedDays })
        }
        className="flex-wrap"
      />
      <div className="grid gap-1 text-[13px]">
        {pinned ? (
          <p className="text-ink-3">
            Your days ·{" "}
            <button
              type="button"
              className="rounded-sm font-semibold text-brand underline hover:text-brand-hover max-sm:inline-flex max-sm:min-h-11 max-sm:items-center"
              onClick={() => dispatch({ type: "unpin", taskId: task.id })}
            >
              Let us choose
            </button>
          </p>
        ) : (
          <p className="text-ink-3">We chose the lightest days. Select a day to choose yourself.</p>
        )}
        <p role="status" className="font-medium text-warn">
          {refusal}
        </p>
      </div>
    </div>
  );
}
