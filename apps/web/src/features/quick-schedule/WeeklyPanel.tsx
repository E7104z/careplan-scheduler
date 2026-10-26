import { useEffect, useRef, useState, type Dispatch } from "react";
import type { RulePack, Weekday } from "@careplan/engine";
import { cn } from "../../lib/cn";
import { formatUnits, weekdayName } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { UnitTiles } from "../../ui/UnitTiles";
import { cellRefusal, type CellRefusal } from "./guard";
import type { QuickAction } from "./state";
import type { QuickModel, QuickState } from "./types";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function daysText(days: number): string {
  return days === 7 ? "every day" : `${days} ${days === 1 ? "day" : "days"} a week`;
}

interface WeekCellProps {
  cellKey: string;
  taskName: string;
  weekday: Weekday;
  minutes: number;
  /** QS-10: a person changed this cell (warn underline). */
  changed: boolean;
  /** QS-10: more than the task's minutes per day (warn fill; SCH-03 allows it). */
  over: boolean;
  onCommit: (key: string, value: number) => void;
}

/** One editable cell of the weekly grid. A click turns it into a number input. */
function WeekCell({ cellKey, taskName, weekday, minutes, changed, over, onCommit }: WeekCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const committed = useRef(false);
  // Enter and Escape hand focus back to the cell; on blur, focus has already gone elsewhere.
  const refocus = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.select();
    } else if (refocus.current) {
      refocus.current = false;
      buttonRef.current?.focus();
    }
  }, [editing]);

  if (!editing) {
    return (
      <td className="border-t border-line px-1 py-1.5 text-center">
        <button
          ref={buttonRef}
          type="button"
          data-cell={cellKey}
          aria-label={`${taskName}, ${weekdayName(weekday)}, ${minutes} minutes. Change minutes`}
          className={cn(
            "relative h-9 w-full min-w-[52px] max-sm:h-11 rounded-sm border border-dashed border-transparent font-semibold hover:border-line-2",
            over ? "bg-warn-bg text-warn" : "bg-brand-tint text-ink",
          )}
          onClick={() => {
            committed.current = false;
            setDraft(String(minutes));
            setEditing(true);
          }}
        >
          {minutes}
          {changed ? (
            <span
              data-mark="changed"
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-sm bg-warn"
            />
          ) : null}
        </button>
      </td>
    );
  }

  const finish = (save: boolean, keyboard: boolean) => {
    if (committed.current) return;
    committed.current = true;
    refocus.current = keyboard;
    if (save) {
      const value = Number(draft);
      if (Number.isInteger(value) && value >= 0 && value !== minutes) onCommit(cellKey, value);
    }
    setEditing(false);
  };

  return (
    <td className="border-t border-line px-1 py-1.5">
      <input
        type="number"
        min={0}
        step={5}
        ref={inputRef}
        value={draft}
        autoFocus
        aria-label={`${taskName}, ${weekdayName(weekday)}, ${minutes} minutes. Enter 0 to remove this day.`}
        className="h-9 w-full min-w-[52px] max-sm:h-11 rounded-sm border border-line-2 bg-surface px-1 text-center text-ink"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => finish(true, false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finish(true, true);
          } else if (event.key === "Escape") {
            finish(false, true);
          }
        }}
      />
    </td>
  );
}
interface WeeklyPanelProps {
  state: QuickState;
  model: QuickModel;
  pack: RulePack;
  dispatch: Dispatch<QuickAction>;
  /** Increases on every dispatch, so the refusal box clears on the next accepted change. */
  seq: number;
  highlight: string | null;
  onHighlightDone: () => void;
}

/**
 * APP-SPEC 5.4 weekly schedule: one row per task, the transportation row, a Day total footer with
 * unit tiles, and guarded cell editing (APP-SPEC 5.7). Cell refusals show the refusal box with the
 * largest value that fits.
 */
export function WeeklyPanel({ state, model, pack, dispatch, seq, highlight, onHighlightDone }: WeeklyPanelProps) {
  const [refusal, setRefusal] = useState<{ key: string; refusal: CellRefusal } | null>(null);
  useEffect(() => setRefusal(null), [seq]);

  // "Use N minutes" removes its own button, so focus goes to the cell it changed.
  const focusCell = useRef<string | null>(null);
  useEffect(() => {
    const key = focusCell.current;
    if (key === null) return;
    focusCell.current = null;
    document.querySelector<HTMLElement>(`[data-cell="${key}"]`)?.focus();
  });

  useEffect(() => {
    if (highlight === null) return;
    document.getElementById(`week-task-${highlight}`)?.scrollIntoView({ block: "center" });
    const timer = window.setTimeout(onHighlightDone, 2000);
    return () => window.clearTimeout(timer);
  }, [highlight, onHighlightDone]);

  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  const byTask: Record<string, Record<number, number>> = {};
  for (const entry of model.entries) {
    dayTotals[entry.weekday] = (dayTotals[entry.weekday] ?? 0) + entry.minutes;
    (byTask[entry.taskId] ??= {})[entry.weekday] = entry.minutes;
  }
  const weekMinutes = dayTotals.reduce((sum, minutes) => sum + minutes, 0);
  const meta = `${weekMinutes} minutes a week · ${formatUnits(weekMinutes)}`;
  const hasEdits = Object.keys(state.edits).length > 0;

  const commitCell = (key: string, value: number) => {
    const result = cellRefusal(state, key, value, pack);
    if (result === null) dispatch({ type: "setCell", key, minutes: value });
    else setRefusal({ key, refusal: result });
  };

  return (
    <Panel
      title="Weekly schedule"
      meta={meta}
      className="min-w-0"
      tools={
        hasEdits ? (
          <Button
            variant="quiet"
            size="sm"
            className="print:hidden"
            onClick={() => dispatch({ type: "undoCellChanges" })}
          >
            Undo my minute changes
          </Button>
        ) : null
      }
    >
      {model.tasks.length === 0 ? (
        <p className="text-ink-2">Add tasks to see the week.</p>
      ) : (
        <>
          <div className="relative overflow-x-auto">
            <div className="min-w-[560px]">
              <table aria-label="Weekly schedule" className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className="border-b border-line px-2 py-2 text-left font-medium text-ink-3">
                    Task
                  </th>
                  {WEEKDAYS.map((weekday) => (
                    <th
                      scope="col"
                      key={weekday}
                      className="border-b border-line px-2 py-2 text-center font-medium text-ink-3"
                    >
                      {weekdayName(weekday).slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.tasks.map((task) => (
                  <tr key={task.id} id={`week-task-${task.id}`} className={cn(highlight === task.id && "bg-brand-tint")}>
                    <th scope="row" className="border-t border-line px-2 py-1.5 text-left font-medium text-ink">
                      {task.name}
                      <span className="block text-[12px] font-normal text-ink-3">
                        {`${task.minPerDay} min · ${daysText(task.daysPerWeek)}`}
                      </span>
                    </th>
                    {WEEKDAYS.map((weekday) => {
                      const minutes = byTask[task.id]?.[weekday];
                      return minutes === undefined ? (
                        <td key={weekday} className="border-t border-line px-1 py-1.5 text-center text-ink-3">
                          <span aria-hidden="true">·</span>
                          <span className="sr-only">Not scheduled</span>
                        </td>
                      ) : (
                        <WeekCell
                          key={weekday}
                          cellKey={`${task.id}:${weekday}`}
                          taskName={task.name}
                          weekday={weekday}
                          minutes={minutes}
                          changed={`${task.id}:${weekday}` in state.edits}
                          over={minutes > task.minPerDay}
                          onCommit={commitCell}
                        />
                      );
                    })}
                  </tr>
                ))}
                {model.allowance ? (
                  <tr className="italic">
                    <th scope="row" className="border-t border-line px-2 py-1.5 text-left font-medium text-ink-2">
                      Essential transportation
                      <span className="block text-[12px] font-normal text-ink-3">Set aside, not a task</span>
                    </th>
                    {WEEKDAYS.map((weekday) => (
                      <td key={weekday} className="border-t border-line px-1 py-1.5 text-center font-semibold text-ink-2">
                        {weekday === state.transport.day ? model.allowance!.weeklyMinutes : ""}
                      </td>
                    ))}
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
          </div>
          <div className="mt-5 grid gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-ink">Day total</h3>
              <span className="text-[13px] text-ink-3">minutes and units</span>
            </div>
            <UnitTiles dayTotals={dayTotals} activeDays={state.activeDays} />
          </div>

          {refusal ? (
            <div
              role="alert"
              className="mt-4 grid gap-2.5 print:hidden rounded-md border border-block bg-block-bg px-4 py-3 text-sm text-ink"
            >
              <p>
                <strong>Not changed.</strong> {refusal.refusal.sentence} {refusal.refusal.hint}
              </p>
              {refusal.refusal.useMinutes !== null ? (
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      focusCell.current = refusal.key;
                      dispatch({ type: "setCell", key: refusal.key, minutes: refusal.refusal.useMinutes! });
                    }}
                  >
                    Use {refusal.refusal.useMinutes} minutes
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-3">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-tile" aria-hidden="true" />
              One square = one 15-minute unit
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-brand-tint" aria-hidden="true" />
              Scheduled
            </span>
            <span>Select a cell to change its minutes</span>
          </div>
        </>
      )}
    </Panel>
  );
}
