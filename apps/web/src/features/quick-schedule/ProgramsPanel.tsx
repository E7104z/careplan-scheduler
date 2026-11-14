import { useId, type Dispatch } from "react";
import type { OtherProgram } from "@careplan/engine";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { Select } from "../../ui/Select";
import { TextInput } from "../../ui/TextInput";
import { quietButtonClass } from "./NurseVisits";
import { planPrograms, PROGRAM_LABELS } from "./programs";
import type { CarePlan, PlanProgram } from "./types";
import type { StoreAction } from "./useQuickStore";

const PROGRAMS = Object.keys(PROGRAM_LABELS) as OtherProgram[];

function ProgramRow({ entry, index, dispatch }: { entry: PlanProgram; index: number; dispatch: Dispatch<StoreAction> }) {
  const id = useId();
  const update = (patch: Partial<PlanProgram>) => dispatch({ type: "updateProgram", index, patch });
  return (
    <li className="flex flex-wrap items-end gap-x-3 gap-y-2 rounded-sm border border-line px-3 py-3 text-sm">
      <div className="grid min-w-0 gap-0.5 text-[13px] font-semibold text-ink-2">
        <label htmlFor={`${id}-program`}>Program</label>
        <Select
          id={`${id}-program`}
          className="w-[320px] max-w-full"
          value={entry.program}
          onChange={(event) => update({ program: event.target.value as OtherProgram })}
        >
          {PROGRAMS.map((program) => (
            <option key={program} value={program}>
              {PROGRAM_LABELS[program]}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
        <label htmlFor={`${id}-start`}>Start date</label>
        <TextInput id={`${id}-start`} type="date" className="w-[180px]" value={entry.start} onChange={(event) => update({ start: event.target.value })} />
      </div>
      <div className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
        <label htmlFor={`${id}-end`}>End date</label>
        <TextInput id={`${id}-end`} type="date" className="w-[180px]" value={entry.end} onChange={(event) => update({ end: event.target.value })} />
      </div>
      <button type="button" className={quietButtonClass} aria-label={`Remove program ${index + 1}`} onClick={() => dispatch({ type: "removeProgram", index })}>
        Remove program
      </button>
    </li>
  );
}

export interface ProgramsPanelProps {
  plan: CarePlan;
  dispatch: Dispatch<StoreAction>;
}

/**
 * APP-SPEC 5.8 "Other programs" (CP4-7: PRG-01 to PRG-03): programs outside DSDS the participant
 * is in, with their dates, entered by the person and never inferred. An entry is a fact about the
 * participant, not a change to the schedule, so it is always recorded; what it rules out shows
 * under Visit checks.
 */
export function ProgramsPanel({ plan, dispatch }: ProgramsPanelProps) {
  const programs = planPrograms(plan);
  return (
    <Panel title="Other programs" meta={programs.length === 0 ? "None entered" : `${programs.length} entered`} className="min-w-0 print:hidden">
      <p className="mb-3 text-sm text-ink-2">
        Optional. Enter PACE or a Department of Mental Health program this participant is in, with its dates. It is
        checked against the care plan, never guessed.
      </p>
      {programs.length > 0 ? (
        <ul className="mb-3 grid gap-2">
          {programs.map((entry, index) => (
            <ProgramRow key={index} entry={entry} index={index} dispatch={dispatch} />
          ))}
        </ul>
      ) : null}
      <Button variant="secondary" onClick={() => dispatch({ type: "addProgram" })}>
        Add a program
      </Button>
    </Panel>
  );
}
