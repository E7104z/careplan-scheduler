import { useMemo, useState, type Dispatch } from "react";
import { Info } from "lucide-react";
import { AVERAGE_PARTICIPANT_NOTE, type RulePack } from "@careplan/engine";
import { monthName } from "../../../lib/format";
import { Button } from "../../../ui/Button";
import { monthFigures } from "../model";
import { RULE_COPY } from "../ruleCopy";
import type { QuickAction } from "../state";
import type { QuickModel, QuickState } from "../types";
import { Worksheet3aBody } from "./Worksheet3aBody";
import { Worksheet3cBody } from "./Worksheet3cBody";
import { WorksheetChecks } from "./WorksheetChecks";
import { WorksheetHeader } from "./WorksheetHeader";
import { WORKSHEET_COPY, displayLabel, notOfficialBanner, reconcileLine } from "./worksheetCopy";
import type { WorksheetChange, WorksheetFields } from "./worksheetState";
import { formFor, worksheet3a, worksheet3c, worksheetUnits } from "./worksheetView";

export interface WorksheetPanelProps {
  state: QuickState;
  model: QuickModel;
  pack: RulePack;
  seq: number;
  dispatch: Dispatch<QuickAction>;
  fields: WorksheetFields;
  change: Dispatch<WorksheetChange>;
  /** Which worksheet printout is being made, if any (Prompt 6). */
  printing: "print" | "save" | null;
  onPrint: (action: "print" | "save") => void;
}

/**
 * Phase 3 Worksheet view: the care plan laid out as DSDS's HCBS-3c (CDS or ILW tab) or HCBS-3a, with
 * every number from `calculate3c`/`calculate3a` (rule 13). Min/Day and Days/Wk are the care plan's own
 * values; a change here is the same reducer action as in the care plan pane, so it goes through the guard.
 */
export function WorksheetPanel({ state, model, pack, seq, dispatch, fields, change, printing, onPrint }: WorksheetPanelProps) {
  const [showMath, setShowMath] = useState(false);
  const form = formFor(state.serviceCode);
  const sheet = useMemo(
    () => (form === "3a"
      ? { kind: "3a" as const, view: worksheet3a(state, fields, pack) }
      : { kind: "3c" as const, view: worksheet3c(state, model, fields, pack) }),
    [form, state, model, fields, pack],
  );
  const view = sheet.view;
  const edition = view.result.edition;
  const total = worksheetUnits(view);
  const month = monthFigures(model, state.viewMonth);
  const fusion = model.monthlyAuthorizations.find((authorization) => authorization.month === state.viewMonth)?.units ?? null;
  const reasons = [
    total !== null && total !== month.calculatedUnits ? `${RULE_COPY["AUTH-05/INFO"]!.whatToDo} The worksheet counts every month as 31 days.` : null,
    fusion !== null && fusion !== month.calculatedUnits ? "We schedule against Fusion's figure." : null,
  ].filter((reason): reason is string => reason !== null);
  const taskName = (taskCode: string): string =>
    state.tasks.find((task) => task.taskCode === taskCode)?.name ?? displayLabel(taskCode);
  const issues = [...new Set(view.result.issues.map((issue) => issue.message))];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 rounded-md border border-line bg-surface p-5 max-sm:p-4">
      <p role="note" className="flex items-start gap-2.5 rounded-sm bg-info-bg px-3.5 py-2.5 text-sm font-semibold text-ink">
        <Info className="mt-0.5 h-4 w-4 flex-none text-info" aria-hidden="true" />
        {notOfficialBanner(edition)}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold text-ink">{WORKSHEET_COPY.title}</h2>
          <p className="text-sm text-ink-2">
            {form === "3a" ? "In-Home Services Worksheet (HCBS-3a)" : `Consumer Directed Services Worksheet (HCBS-3c), ${form === "3c-ilw" ? "ILW" : "CDS"} tab`} · {edition}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" aria-pressed={showMath} onClick={() => setShowMath((on) => !on)}>
            {WORKSHEET_COPY.showMath}
          </Button>
          <Button variant="secondary" size="sm" busy={printing === "print"} onClick={() => onPrint("print")}>
            Print worksheet
          </Button>
          <Button variant="secondary" size="sm" busy={printing === "save"} onClick={() => onPrint("save")}>
            Save worksheet as PDF
          </Button>
        </div>
      </div>
      <p className="text-[13px] text-ink-2">{WORKSHEET_COPY.memoryOnly}</p>

      <WorksheetHeader form={form} fields={fields} change={change} planStart={state.plan.start} monthlyUnits={form === "3a" ? null : total} />

      {sheet.kind === "3c" ? (
        <Worksheet3cBody view={sheet.view} state={state} pack={pack} fields={fields} change={change} dispatch={dispatch} seq={seq} showMath={showMath} />
      ) : (
        <Worksheet3aBody view={sheet.view} state={state} fields={fields} change={change} dispatch={dispatch} seq={seq} showMath={showMath} />
      )}

      {view.notOnForm.length > 0 ? (
        <section aria-labelledby="ws-not-on-form" className="grid gap-2">
          <h3 id="ws-not-on-form" className="text-[15px] font-bold text-ink">{WORKSHEET_COPY.notOnForm}</h3>
          <p role="note" className="text-sm text-ink-2">{WORKSHEET_COPY.notOnFormNote}</p>
          <ul className="list-disc pl-5 text-sm text-ink">
            {view.notOnForm.map((task) => <li key={task.id}>{task.name}</li>)}
          </ul>
        </section>
      ) : null}

      <label className="grid gap-1.5 text-sm font-medium text-ink-2">
        {form === "3a" ? "Comments (nursing services, and the months for the General Health Evaluation)" : "Comments"}
        <textarea
          className="min-h-[88px] w-full resize-y rounded-sm border border-line-2 bg-surface px-3 py-2 font-normal text-ink focus:border-brand"
          spellCheck={false}
          autoComplete="off"
          value={fields.comments}
          onChange={(event) => change({ type: "set", patch: { comments: event.target.value } })}
        />
      </label>

      <div className="grid gap-1 text-[13px] text-ink-2">
        <p>{AVERAGE_PARTICIPANT_NOTE}</p>
        <p>{WORKSHEET_COPY.basis}</p>
        <p>{WORKSHEET_COPY.ongoing}</p>
      </div>

      {total !== null ? (
        <p className="text-sm text-ink">
          {reconcileLine(total, monthName(state.viewMonth), month.calculatedUnits, fusion)}
          {reasons.length > 0 ? <span className="block text-ink-2">{reasons.join(" ")}</span> : null}
        </p>
      ) : null}

      <WorksheetChecks results={view.checks} issues={issues} taskName={taskName} />
    </div>
  );
}
