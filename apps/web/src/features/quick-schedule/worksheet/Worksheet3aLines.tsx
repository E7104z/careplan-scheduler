import type { Dispatch, ReactNode } from "react";
import { dollars } from "@careplan/engine";
import type { QuickTask } from "../types";
import { CountField, DaysField } from "./WorksheetInputs";
import type { LineEntry, WorksheetChange, WorksheetLine } from "./worksheetState";

export const CHECKBOX_HINTS = {
  homemakerRcfAlf: "The manual asks for this box; DSDS's workbook has no Homemaker RCF/ALF rate, so it changes no number.",
} as const;

export interface LineBlockProps {
  line: WorksheetLine;
  title: string;
  /** The line is the care plan's own service: its minutes and days come from the care plan. */
  own: boolean;
  task: QuickTask | null;
  entry: LineEntry;
  units: number | null;
  costCents: number | null;
  costText: string | null;
  description: string;
  change: Dispatch<WorksheetChange>;
  children?: ReactNode;
}

/**
 * One of the 3a's one-row lines (respite, adult day care, chore). The care plan's own service shows
 * its minutes and days; any other line is a worksheet-only entry that never reaches the schedule.
 */
export function LineBlock({ line, title, own, task, entry, units, costCents, costText, description, change, children }: LineBlockProps) {
  const set = (patch: Partial<LineEntry>) => change({ type: "line", line, entry: patch });
  return (
    <section aria-labelledby={`ws-3a-${line}`} className="grid gap-3">
      <h3 id={`ws-3a-${line}`} className="text-[15px] font-bold text-ink">{title}</h3>
      {own ? (
        <p className="text-sm text-ink">
          From the care plan: {task?.minPerDay ?? "no"} minutes a day, {task?.daysPerWeek ?? "no"} days a week.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <CountField label={`${title}: minutes a day`} value={entry.minPerDay} max={1440} error="Enter whole minutes from 0 to 1,440." onChange={(minPerDay) => set({ minPerDay })} />
          <DaysField label={`${title}: days a week`} value={entry.daysPerWeek} onChange={(daysPerWeek) => set({ daysPerWeek })} />
        </div>
      )}
      {children}
      <p className="text-sm text-ink">
        {units === null ? "Nothing entered." : `${units.toLocaleString("en-US")} units`}
        {costCents === null ? "" : ` · ${dollars(costCents)}`}
        {costText ? <span className="block text-[13px] text-ink-2">{costText}</span> : null}
      </p>
      {units !== null ? (
        <label className="grid gap-1 text-[13px] text-ink-2">
          {`${title}: description of needs`}
          <textarea
            className="min-h-[44px] w-full resize-y rounded-sm border border-line-2 bg-surface px-2 py-1.5 text-sm text-ink focus:border-brand"
            spellCheck={false}
            autoComplete="off"
            rows={1}
            value={description}
            onChange={(event) => change({ type: "describe", key: line, text: event.target.value })}
          />
        </label>
      ) : null}
    </section>
  );
}
