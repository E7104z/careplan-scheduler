import { Fragment, useEffect, useState, type Dispatch } from "react";
import type { DaysPerWeek, Worksheet3cTransport } from "@careplan/engine";
import { cn } from "../../../lib/cn";
import type { QuickAction } from "../state";
import type { QuickTask } from "../types";
import { WORKSHEET_COPY, displayLabel } from "./worksheetCopy";
import type { WorksheetTableRow } from "./worksheetView";

const DAYS: DaysPerWeek[] = [1, 2, 3, 4, 5, 6, 7];
export const HEAD = "px-2 py-2 text-left align-bottom text-[13px] font-semibold text-ink-2";
export const CELL = "px-2 py-1.5 align-top text-sm text-ink";
const NUMBER = "text-right tabular-nums";
const INPUT = "h-9 w-[4.5rem] rounded-sm border border-line-2 bg-surface px-2 text-right text-ink focus:border-brand max-sm:h-11";

/** Whole minutes 1–1,440 (QS-05), else null: the task is left out until it's fixed. */
function parseMinutes(text: string): number | null {
  const value = /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
  return Number.isInteger(value) && value >= 1 && value <= 1440 ? value : null;
}

/** Min/Day for a task built by hand: the care plan's own value, changed through the guard (rule 19a). */
function MinutesInput({ task, label, seq, dispatch }: { task: QuickTask; label: string; seq: number; dispatch: Dispatch<QuickAction> }) {
  const [draft, setDraft] = useState(task.minPerDay === null ? "" : String(task.minPerDay));
  useEffect(() => setDraft(task.minPerDay === null ? "" : String(task.minPerDay)), [task.minPerDay, seq]);
  const commit = () => {
    const minutes = parseMinutes(draft);
    if (minutes !== task.minPerDay) dispatch({ type: "setMinutes", taskId: task.id, minutes });
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={`${label}, minutes a day`}
      className={INPUT}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}

export interface WorksheetTableProps {
  caption: string;
  rows: WorksheetTableRow[];
  /** The 3a prints a Min/Wk column between Max Days/Mo and Units/Wk. */
  minPerWeek: boolean;
  editable: boolean;
  showMath: boolean;
  seq: number;
  dispatch: Dispatch<QuickAction>;
  descriptions: Record<string, string>;
  onDescribe: (key: string, text: string) => void;
  /** The 3c's Essential Transportation row: minutes a month in, whole units out (cell L88). */
  transport?: Worksheet3cTransport;
}

/** The 3c's transportation row: minutes a month across the entry columns, units in Total Units. */
function TransportRow({ label, time, freq, transport, minPerWeek, showMath }: { label: string; time: string; freq: string | null; transport: Worksheet3cTransport; minPerWeek: boolean; showMath: boolean }) {
  return (
    <tr className="border-t border-line">
      <th scope="row" className={cn(CELL, "text-left font-semibold")}>{label}</th>
      <td className={cn(CELL, "text-ink-2")}>{time}</td>
      <td className={cn(CELL, "text-ink-2")}>{freq ?? ""}</td>
      <td colSpan={minPerWeek ? 6 : 5} className={cn(CELL, "text-ink")}>
        {transport.minutesPerMonth.toLocaleString("en-US")} minutes a month ÷ 15, rounded down
        {transport.unallocatedMinutes > 0 ? ` (${transport.unallocatedMinutes} min left over)` : ""}
      </td>
      <td className={cn(CELL, NUMBER, "bg-sunk font-semibold")}>
        {transport.units}
        {showMath ? <span className="block text-left text-[13px] font-normal text-ink-2">{transport.formulaText}</span> : null}
      </td>
      <td className={CELL} />
    </tr>
  );
}

/**
 * DSDS's task table, in the form's columns and row order (WS-C01 to WS-C09, WS-M02): suggested time
 * and frequency, the two entries, and the computed columns as read-only text.
 */
export function WorksheetTable({ caption, rows, minPerWeek, editable, showMath, seq, dispatch, descriptions, onDescribe, transport }: WorksheetTableProps) {
  const columns = minPerWeek ? 11 : 10;
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="relative overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[760px] border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-sunk">
          <tr>
            <th scope="col" className={HEAD}>Task</th>
            <th scope="col" className={HEAD}>Suggested time</th>
            <th scope="col" className={HEAD}>Suggested frequency</th>
            <th scope="col" className={cn(HEAD, NUMBER)}>Min/Day</th>
            <th scope="col" className={cn(HEAD, NUMBER)}>Units/Day</th>
            <th scope="col" className={cn(HEAD, NUMBER)}>Days/Wk</th>
            <th scope="col" className={cn(HEAD, NUMBER)}>Max Days/Mo</th>
            {minPerWeek ? <th scope="col" className={cn(HEAD, NUMBER)}>Min/Wk</th> : null}
            <th scope="col" className={cn(HEAD, NUMBER)}>Units/Wk</th>
            <th scope="col" className={cn(HEAD, NUMBER)}>Total Units</th>
            <th scope="col" className={HEAD}><span className="sr-only">Notes</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ guidance, task, result, underPersonalCare }) => {
            const label = displayLabel(guidance.label);
            const locked = !editable || task === null || task.locked;
            if (transport && guidance.taskCode === "ESSENTIAL_TRANSPORTATION") {
              return <TransportRow key={guidance.row} label={label} time={guidance.time} freq={guidance.freq} transport={transport} minPerWeek={minPerWeek} showMath={showMath} />;
            }
            return (
              <Fragment key={guidance.row}>
                <tr className="border-t border-line">
                  <th scope="row" className={cn(CELL, "text-left font-semibold")}>{label}</th>
                  <td className={cn(CELL, "text-ink-2")}>{guidance.time}</td>
                  <td className={cn(CELL, "text-ink-2")}>{guidance.freq ?? ""}</td>
                  <td className={cn(CELL, NUMBER)}>
                    {task && !locked ? <MinutesInput task={task} label={label} seq={seq} dispatch={dispatch} /> : (task?.minPerDay ?? "")}
                  </td>
                  <td className={cn(CELL, NUMBER, "bg-sunk")}>{result?.unitsPerDayDisplay ?? ""}</td>
                  <td className={cn(CELL, NUMBER)}>
                    {task && !locked ? (
                      <select
                        aria-label={`${label}, days a week`}
                        className={cn(INPUT, "w-16 text-left")}
                        value={task.daysPerWeek}
                        onChange={(event) => dispatch({ type: "setDaysPerWeek", taskId: task.id, days: Number(event.target.value) as DaysPerWeek })}
                      >
                        {DAYS.map((days) => <option key={days} value={days}>{days}</option>)}
                      </select>
                    ) : (task?.daysPerWeek ?? "")}
                  </td>
                  <td className={cn(CELL, NUMBER, "bg-sunk")}>{result?.maxDaysPerMonth ?? ""}</td>
                  {minPerWeek ? <td className={cn(CELL, NUMBER, "bg-sunk")}>{task ? result?.minPerWeek ?? "" : ""}</td> : null}
                  <td className={cn(CELL, NUMBER, "bg-sunk")}>{task ? result?.unitsPerWeekDisplay ?? "" : ""}</td>
                  <td className={cn(CELL, NUMBER, "bg-sunk font-semibold")}>
                    {result?.totalUnits ?? ""}
                    {showMath && result?.totalUnits !== null && result ? (
                      <span className="block text-left text-[13px] font-normal text-ink-2">{result.formulaText}</span>
                    ) : null}
                  </td>
                  <td className={cn(CELL, "text-[13px] text-ink-2")}>{underPersonalCare ? WORKSHEET_COPY.underPersonalCare : ""}</td>
                </tr>
                {task ? (
                  <tr>
                    <td colSpan={columns} className="px-2 pb-2">
                      <label className="grid gap-1 text-[13px] text-ink-2">
                        {`${label}: description of needs`}
                        <textarea
                          className="min-h-[44px] w-full resize-y rounded-sm border border-line-2 bg-surface px-2 py-1.5 text-sm text-ink focus:border-brand"
                          spellCheck={false}
                          autoComplete="off"
                          rows={1}
                          value={descriptions[task.id] ?? ""}
                          onChange={(event) => onDescribe(task.id, event.target.value)}
                        />
                      </label>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
