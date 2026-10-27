import type { Dispatch } from "react";
import {
  CHORE_TASK_LABELS, NURSE_TASK_LABELS, dollars,
  type ChoreTask, type NurseTask, type Worksheet3aCostLine,
} from "@careplan/engine";
import type { QuickAction } from "../state";
import type { QuickState } from "../types";
import { CHECKBOX_HINTS, LineBlock } from "./Worksheet3aLines";
import { Checkbox, CountField } from "./WorksheetInputs";
import { WorksheetTable } from "./WorksheetTable";
import { COST_NOTE_3A, COST_NOTE_3A_INLINE, WORKSHEET_COPY, displayLabel } from "./worksheetCopy";
import type { WorksheetChange, WorksheetFields, WorksheetLine } from "./worksheetState";
import type { Worksheet3aView } from "./worksheetView";

const SECTION_COST: Record<string, { line: Worksheet3aCostLine; units: "personalCareUnits" | "homemakerUnits" | "apcUnits"; title: string }> = {
  personalCare: { line: "personalCare", units: "personalCareUnits", title: "Total Personal Care" },
  homemaker: { line: "homemaker", units: "homemakerUnits", title: "Total Homemaker" },
  apc: { line: "apc", units: "apcUnits", title: "Total Advanced Personal Care" },
};

const LINES: { line: WorksheetLine; title: string; cost: Worksheet3aCostLine }[] = [
  { line: "respiteBasic", title: "Respite care: Basic", cost: "respiteBasic" },
  { line: "respiteAdvanced", title: "Respite care: Advanced", cost: "respiteAdvanced" },
  { line: "adultDayCare", title: "Adult Day Care (ages 63 and older)", cost: "adultDayCare" },
  { line: "adultDayCareWaiver", title: "Adult Day Care Waiver (ages 18–62)", cost: "adultDayCareWaiver" },
  { line: "chore", title: "Chore services", cost: "chore" },
];

export interface Worksheet3aBodyProps {
  view: Worksheet3aView;
  state: QuickState;
  fields: WorksheetFields;
  change: Dispatch<WorksheetChange>;
  dispatch: Dispatch<QuickAction>;
  seq: number;
  showMath: boolean;
}

/** The HCBS-3a: its three task sections with subtotals and costs, then nurse visits and the one-row lines. */
export function Worksheet3aBody({ view, state, fields, change, dispatch, seq, showMath }: Worksheet3aBodyProps) {
  const { result } = view;
  const rcf: Record<string, { key: "personalCareRcfAlf" | "homemakerRcfAlf" | "apcRcfAlf"; hint?: string }> = {
    personalCare: { key: "personalCareRcfAlf" },
    homemaker: { key: "homemakerRcfAlf", hint: CHECKBOX_HINTS.homemakerRcfAlf },
    apc: { key: "apcRcfAlf" },
  };
  const ownLine = (line: WorksheetLine): boolean => view.own === line;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Checkbox
        label="This is part of an ILW request"
        checked={fields.ilwRequest}
        onChange={(ilwRequest) => change({ type: "set", patch: { ilwRequest } })}
        hint={WORKSHEET_COPY.ilwRequestNote}
      />
      {view.sections.map(({ section, name, rows }) => {
        const cost = SECTION_COST[section]!;
        const own = view.own === section || (section === "homemaker" && view.input.flags.medRelHousehold);
        const flag = rcf[section]!;
        return (
          <section key={section} aria-labelledby={`ws-3a-${section}`} className="grid grid-cols-[minmax(0,1fr)] gap-3">
            <h3 id={`ws-3a-${section}`} className="text-[15px] font-bold text-ink">{displayLabel(name)}</h3>
            <div className="flex flex-wrap gap-x-6">
              <Checkbox
                label={`RCF/ALF: the participant lives in a residential care or assisted living facility (${displayLabel(name)})`}
                checked={fields[flag.key]}
                onChange={(checked) => change({ type: "set", patch: { [flag.key]: checked } })}
                {...(flag.hint ? { hint: flag.hint } : {})}
              />
              {section === "homemaker" ? (
                <Checkbox label={WORKSHEET_COPY.medRelBox} checked={view.input.flags.medRelHousehold} disabled hint={WORKSHEET_COPY.medRelNote} />
              ) : null}
            </div>
            {own ? (
              <WorksheetTable
                caption={`${displayLabel(name)}: tasks in DSDS's order`}
                rows={rows}
                minPerWeek
                editable={state.source === "manual"}
                showMath={showMath}
                seq={seq}
                dispatch={dispatch}
                descriptions={fields.descriptions}
                onDescribe={(key, text) => change({ type: "describe", key, text })}
              />
            ) : (
              <p className="text-sm text-ink-2">{WORKSHEET_COPY.otherSection}</p>
            )}
            <p className="text-sm text-ink">
              <span className="font-semibold">{cost.title}:</span> {result.subtotals[cost.units].toLocaleString("en-US")} units
              {result.costs[cost.line] === null ? "" : ` · ${dollars(result.costs[cost.line]!)}, ${COST_NOTE_3A_INLINE}`}
              {section === "personalCare" && result.subtotals.medRelHouseholdUnits > 0
                ? ` (includes ${result.subtotals.medRelHouseholdUnits.toLocaleString("en-US")} units of Med Rel HC Tasks)`
                : ""}
              {showMath && result.costText[cost.line] ? <span className="block text-[13px] text-ink-2">{result.costText[cost.line]}</span> : null}
            </p>
          </section>
        );
      })}

      <section aria-labelledby="ws-3a-nurse" className="grid gap-3">
        <h3 id="ws-3a-nurse" className="text-[15px] font-bold text-ink">Authorized nurse visits</h3>
        <Checkbox label="RCF/ALF: the participant lives in a residential care or assisted living facility (nurse visits)" checked={fields.nurseRcfAlf} onChange={(nurseRcfAlf) => change({ type: "set", patch: { nurseRcfAlf } })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <CountField label="Visits a month" hint="Nurse visits add no units. Less than weekly: enter the visits a month." value={fields.nurseVisits} max={31} error="Enter whole visits from 0 to 31." onChange={(nurseVisits) => change({ type: "set", patch: { nurseVisits } })} />
          <CountField label="Visits in Advanced Personal Care's first month" hint="Two are required unless the plan has ongoing nurse visits." value={fields.nurseFirstMonthVisits} max={31} error="Enter whole visits from 0 to 31." onChange={(nurseFirstMonthVisits) => change({ type: "set", patch: { nurseFirstMonthVisits } })} />
        </div>
        <fieldset className="grid gap-1 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium text-ink-2">Nurse tasks (recorded; they change no number)</legend>
          {(Object.keys(NURSE_TASK_LABELS) as NurseTask[]).map((task) => (
            <Checkbox key={task} label={displayLabel(NURSE_TASK_LABELS[task])} checked={fields.nurseTasks.includes(task)} onChange={() => change({ type: "toggleNurseTask", task })} />
          ))}
        </fieldset>
        <p className="text-sm text-ink">
          {result.costs.nurseVisits === null ? "No nurse visits priced." : `${COST_NOTE_3A}: ${dollars(result.costs.nurseVisits)}`}
          {showMath && result.costText.nurseVisits ? <span className="block text-[13px] text-ink-2">{result.costText.nurseVisits}</span> : null}
        </p>
      </section>

      {LINES.map(({ line, title, cost }) => (
        <LineBlock
          key={line}
          line={line}
          title={title}
          own={ownLine(line)}
          task={ownLine(line) ? state.tasks.find((t) => t.taskCode === (line === "respiteBasic" ? "BASIC_RESPITE" : "ADVANCED_RESPITE")) ?? null : null}
          entry={fields.lines[line]}
          units={result.lineUnits[line]}
          costCents={result.costs[cost]}
          costText={showMath ? result.costText[cost] : null}
          description={fields.descriptions[line] ?? ""}
          change={change}
        >
          {line === "chore" ? (
            <fieldset className="grid gap-1 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-medium text-ink-2">Chore tasks (recorded; they change no number)</legend>
              {(Object.keys(CHORE_TASK_LABELS) as ChoreTask[]).map((task) => (
                <Checkbox key={task} label={displayLabel(CHORE_TASK_LABELS[task])} checked={fields.choreTasks.includes(task)} onChange={() => change({ type: "toggleChoreTask", task })} />
              ))}
            </fieldset>
          ) : null}
        </LineBlock>
      ))}

      <section aria-labelledby="ws-3a-meals" className="grid gap-3">
        <h3 id="ws-3a-meals" className="text-[15px] font-bold text-ink">Home delivered meals</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <CountField label="Meals a day" hint="The units a day: the one entry the 3a takes per day." value={fields.hdmUnitsPerDay} error="Enter whole meals a day, 0 or more." onChange={(hdmUnitsPerDay) => change({ type: "set", patch: { hdmUnitsPerDay } })} />
          <CountField label="Days a week" value={fields.hdmDaysPerWeek} max={7} error="Choose 1 to 7 days." onChange={(hdmDaysPerWeek) => change({ type: "set", patch: { hdmDaysPerWeek } })} />
        </div>
        <p className="text-sm text-ink">
          {result.hdm?.totalUnits === null || result.hdm === null ? "No meals entered." : `${result.hdm.totalUnits.toLocaleString("en-US")} meals a month · ${dollars(result.costs.homeDeliveredMeals ?? 0)}`}
          {showMath && result.hdm?.totalUnits !== null && result.hdm ? <span className="block text-[13px] text-ink-2">{result.costText.homeDeliveredMeals ?? result.hdm.formulaText}</span> : null}
        </p>
      </section>

      <p aria-live="polite" className="text-[17px] font-bold text-ink">
        Total cost: {dollars(result.totalCostCents)} <span className="text-sm font-normal text-ink-2">{COST_NOTE_3A}</span>
      </p>
    </div>
  );
}

