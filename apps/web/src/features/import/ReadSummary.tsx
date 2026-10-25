import { useState, type ReactNode } from "react";
import { CircleCheck, CircleHelp } from "lucide-react";
import { daysInMonth, monthTaskUnits } from "@careplan/engine";
import type { ImportIssue } from "@careplan/import";
import { cn } from "../../lib/cn";
import { monthName, niceDate } from "../../lib/format";
import { Button } from "../../ui/Button";
import { checksumLines } from "../quick-schedule/checksumText";
import type { QuickModel, QuickState } from "../quick-schedule/types";

/** The summary's h2 id: the page focuses it after a real import. */
export const READ_SUMMARY_TITLE_ID = "qs-read-title";

export interface ReadSummaryProps {
  state: QuickState;
  model: QuickModel;
  onNewPlan: () => void;
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid">
      <dt className="text-[13px] text-ink-3">{term}</dt>
      <dd className="font-semibold text-ink">{children}</dd>
    </div>
  );
}

function noteText(note: ImportIssue): string {
  if (note.code === "incomplete") {
    return `Built from ${note.have} of the plan's ${note.total} rows. The missing tasks aren't scheduled.`;
  }
  return note.message;
}

/** "Review what we read": every row the schedule is built from, with its units in the viewed month. */
function ReadTable({ state, model }: { state: QuickState; model: QuickModel }) {
  const [year = 0, month = 1] = state.viewMonth.split("-").map(Number);
  const days = daysInMonth(year, month);
  const cell = "border-b border-line px-2.5 py-1.5";
  const number = cn(cell, "text-right");
  return (
    // On a phone the table scrolls sideways; with nothing focusable inside, the panel takes focus.
    <div role="region" aria-label="What we read from Fusion" tabIndex={0} className="relative overflow-x-auto">
      <table id="qs-read-table" className="w-full min-w-[520px] border-collapse text-left text-sm">
        <caption className="sr-only">What we read from Fusion</caption>
        <thead className="bg-sunk text-[13px] text-ink-2">
          <tr>
            <th scope="col" className={cn(cell, "font-semibold")}>Task</th>
            <th scope="col" className={cn(number, "font-semibold")}>Minutes a day</th>
            <th scope="col" className={cn(number, "font-semibold")}>Days a week</th>
            <th scope="col" className={cn(number, "font-semibold")}>Units in {monthName(state.viewMonth).split(" ")[0]}</th>
          </tr>
        </thead>
        <tbody>
          {state.tasks.map((task) => (
            <tr key={task.id}>
              <th scope="row" className={cn(cell, "font-normal")}>{task.name}</th>
              <td className={number}>{task.minPerDay ?? "—"}</td>
              <td className={number}>{task.daysPerWeek === 7 ? "Every day" : task.daysPerWeek}</td>
              <td className={number}>
                {task.minPerDay === null
                  ? "—"
                  : monthTaskUnits(task.minPerDay * task.daysPerWeek, task.daysPerWeek, days).units}
              </td>
            </tr>
          ))}
          {model.allowance ? (
            <tr>
              <th scope="row" className={cn(cell, "font-normal")}>Essential transportation</th>
              <td className={number}>—</td>
              <td className={number}>—</td>
              <td className={number}>{model.allowance.units}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/**
 * APP-SPEC 5.1 read summary: who and what was read from Fusion, whether our total matches Fusion's
 * (IMP-15), the reader's notes, and the rows themselves on request.
 */
export function ReadSummary({ state, model, onNewPlan }: ReadSummaryProps) {
  const [reviewing, setReviewing] = useState(false);
  const title = state.isExample ? "Example care plan" : (state.identity?.name ?? "Care plan from Fusion");
  const source = state.isExample
    ? "This is what a pasted Fusion plan looks like. Paste one above to make your own."
    : `Read from Fusion${state.identity ? ` · DCN ${state.identity.dcn}` : ""}`;
  const checksum = model.checksum ? checksumLines(model.checksum) : null;
  const notes = state.notes.filter((note) => note.code !== "duplicate-task");

  return (
    <section
      aria-labelledby={READ_SUMMARY_TITLE_ID}
      className="grid gap-3 rounded-md border border-line bg-surface px-5 py-4 max-sm:px-4"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <div className="min-w-0">
          <h2 id={READ_SUMMARY_TITLE_ID} tabIndex={-1} className="text-[17px] font-bold text-ink">
            {title}
          </h2>
          <p className="text-[13px] text-ink-2">{source}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={reviewing}
            aria-controls={reviewing ? "qs-read-table" : undefined}
            onClick={() => setReviewing((open) => !open)}
          >
            {reviewing ? "Hide what we read" : "Review what we read"}
          </Button>
          {state.isExample ? null : (
            <Button variant="quiet" size="sm" onClick={onNewPlan}>
              New care plan
            </Button>
          )}
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-7 gap-y-2">
        <Fact term="Service">{`${state.serviceLabel ?? model.svc.name} · ${model.svc.code}`}</Fact>
        <Fact term="Plan">{`${niceDate(state.plan.start)} to ${niceDate(state.plan.end)}`}</Fact>
        {state.headerUnits !== null ? <Fact term="Fusion units">{`${state.headerUnits} a month`}</Fact> : null}
        <Fact term="Tasks">{`${state.tasks.length}${model.allowance ? " + transportation" : ""}`}</Fact>
        {state.provider ? <Fact term="Provider">{state.provider}</Fact> : null}
        {state.pa ? <Fact term="Prior authorization">{state.pa}</Fact> : null}
      </dl>

      {checksum && model.checksum ? (
        <p className={cn("flex items-start gap-2 text-sm", model.checksum.matches ? "text-brand" : "text-review")}>
          {model.checksum.matches ? (
            <CircleCheck className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          ) : (
            <CircleHelp className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          )}
          <span className="text-ink">
            <strong>{checksum.lead}</strong> {checksum.detail}
          </span>
        </p>
      ) : null}

      {notes.length > 0 ? (
        <ul className="grid list-disc gap-0.5 pl-[18px] text-sm text-ink-2">
          {notes.map((note, index) => (
            <li key={`${note.code}-${index}`}>{noteText(note)}</li>
          ))}
        </ul>
      ) : null}

      {reviewing ? <ReadTable state={state} model={model} /> : null}
    </section>
  );
}
