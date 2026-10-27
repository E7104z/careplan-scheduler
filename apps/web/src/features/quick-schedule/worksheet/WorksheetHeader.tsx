import type { Dispatch } from "react";
import { niceDate } from "../../../lib/format";
import { Field } from "../../../ui/Field";
import { TextInput } from "../../../ui/TextInput";
import { WORKSHEET_COPY } from "./worksheetCopy";
import { Checkbox } from "./WorksheetInputs";
import type { WorksheetChange, WorksheetFields } from "./worksheetState";

type TextField = "name" | "dcn" | "providerName" | "providerPhone" | "emergencyName" | "emergencyPhone" | "assessorName";

export interface WorksheetHeaderProps {
  form: "3c-cds" | "3c-ilw" | "3a";
  fields: WorksheetFields;
  change: Dispatch<WorksheetChange>;
  planStart: string;
  /** The 3c's monthly units, written after the program (WS-H12): the worksheet's own total. */
  monthlyUnits: number | null;
}

/**
 * The form's header (WS-H01 to WS-H12). Name, DCN, phones and the emergency contact are memory-only
 * (W-4): they live in the page's React state and nowhere else. Program and start date follow the
 * care plan and aren't edited here.
 */
export function WorksheetHeader({ form, fields, change, planStart, monthlyUnits }: WorksheetHeaderProps) {
  const text = (field: TextField, label: string, autoComplete = "off") => (
    <Field label={label}>
      <TextInput autoComplete={autoComplete} value={fields[field]} onChange={(event) => change({ type: "set", patch: { [field]: event.target.value } })} />
    </Field>
  );
  const is3c = form !== "3a";
  const program = form === "3c-ilw" ? "Independent Living Waiver (ILW tab)" : "State Plan (CDS tab)";
  return (
    <section aria-labelledby="ws-header" className="grid gap-3">
      <h3 id="ws-header" className="text-[15px] font-bold text-ink">Participant and provider</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {text("name", "Participant name")}
        {text("dcn", "DCN")}
        {text("providerName", "Provider agency name")}
        {text("providerPhone", "Provider agency phone")}
      </div>
      {is3c ? (
        <Checkbox
          label="IHS: the participant receives, or is being authorized for, other HCBS besides CDS"
          checked={fields.ihs}
          onChange={(ihs) => change({ type: "set", patch: { ihs } })}
        />
      ) : (
        <Checkbox
          label="CDS: the participant receives, or is being authorized for, Personal Care Assistance (Consumer-Directed) besides other HCBS"
          checked={fields.cdsBox}
          onChange={(cdsBox) => change({ type: "set", patch: { cdsBox } })}
        />
      )}
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {is3c ? (
          <div>
            <dt className="font-medium text-ink-2">Personal care assistance</dt>
            <dd className="text-ink">
              {program}
              {monthlyUnits === null ? "" : ` · ${monthlyUnits.toLocaleString("en-US")} units a month`}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="font-medium text-ink-2">{is3c ? "Start date (earliest date CDS can begin)" : "Plan starts"}</dt>
          <dd className="text-ink">{niceDate(planStart)}</dd>
        </div>
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        {text("emergencyName", "Emergency contact")}
        {text("emergencyPhone", "Emergency contact phone")}
      </div>
      {is3c ? text("assessorName", "Assessor name (optional, typed by you)") : null}
      <p className="border-b border-ink-2 pb-6 text-[13px] text-ink-2">{is3c ? WORKSHEET_COPY.signature3c : WORKSHEET_COPY.signature3a}</p>
    </section>
  );
}
