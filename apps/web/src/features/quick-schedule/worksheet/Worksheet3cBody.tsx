import type { Dispatch } from "react";
import { dollars, type RulePack, type Worksheet3cIlwExtrasInput } from "@careplan/engine";
import { cn } from "../../../lib/cn";
import { Button } from "../../../ui/Button";
import type { QuickAction } from "../state";
import type { QuickState } from "../types";
import { WorksheetTable } from "./WorksheetTable";
import { CountField } from "./WorksheetInputs";
import { WORKSHEET_COPY, costNote3c, overMaximum } from "./worksheetCopy";
import type { WorksheetChange, WorksheetFields } from "./worksheetState";
import type { Worksheet3cView } from "./worksheetView";

const EXTRAS: { field: keyof Worksheet3cIlwExtrasInput; label: string; amount: "fmsCents" | "caseManagementCents" | "smsCents" | "smeCents" | "eaaCents" }[] = [
  { field: "fmsUnits", label: "Financial Management Services, units", amount: "fmsCents" },
  { field: "caseManagementUnits", label: "Case Management (CM), units", amount: "caseManagementCents" },
  { field: "smsUnits", label: "Specialized Medical Supplies (SMS), units", amount: "smsCents" },
  { field: "smeUnits", label: "Specialized Medical Equipment (SME), units", amount: "smeCents" },
  { field: "eaaUnits", label: "Environmental Accessibility Adaptations, units", amount: "eaaCents" },
];

export interface Worksheet3cBodyProps {
  view: Worksheet3cView;
  state: QuickState;
  pack: RulePack;
  fields: WorksheetFields;
  change: Dispatch<WorksheetChange>;
  dispatch: Dispatch<QuickAction>;
  seq: number;
  showMath: boolean;
}

/** The HCBS-3c's table, transportation, total and cost, and on the ILW tab its service lines. */
export function Worksheet3cBody({ view, state, pack, fields, change, dispatch, seq, showMath }: Worksheet3cBodyProps) {
  const { result } = view;
  const rate = pack.worksheet3c!.unitRateCents;
  const ilw = view.form === "3c-ilw";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <WorksheetTable
        caption={`${ilw ? "ILW" : "CDS"} tab: tasks in DSDS's order`}
        rows={view.rows}
        minPerWeek={false}
        editable={state.source === "manual"}
        showMath={showMath}
        seq={seq}
        dispatch={dispatch}
        descriptions={fields.descriptions}
        onDescribe={(key, text) => change({ type: "describe", key, text })}
        transport={result.transport}
      />
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="font-semibold text-ink">Total units a month</dt>
        <dd aria-live="polite" className={cn("font-bold", result.overCeiling ? "text-block" : "text-ink")}>
          {result.totalUnits.toLocaleString("en-US")} units{result.overCeiling ? ` · ${overMaximum(result.ceiling)}` : ""}
        </dd>
        <dt className="font-semibold text-ink">{costNote3c(rate)}</dt>
        <dd className="text-ink">
          {dollars(result.costCents)}
          {showMath ? <span className="block text-[13px] text-ink-2">{result.costText}</span> : null}
        </dd>
      </dl>
      {result.overCeiling && !ilw ? (
        <div role="note" className="grid gap-2 rounded-sm bg-info-bg px-3.5 py-2.5 text-sm text-ink">
          <p>Needs more than the State Plan maximum. The manual says to consider the Independent Living Waiver.</p>
          {state.source === "manual" ? (
            <p>
              <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "setService", code: "T1019U6" })}>
                {WORKSHEET_COPY.considerIlw}
              </Button>
            </p>
          ) : null}
        </div>
      ) : null}
      {ilw ? (
        <section aria-labelledby="ws-ilw-services" className="grid gap-3">
          <h3 id="ws-ilw-services" className="text-[15px] font-bold text-ink">ILW services</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {EXTRAS.map(({ field, label, amount }) => {
              const cents = result.ilwExtras?.[amount] ?? null;
              return (
                <CountField
                  key={field}
                  label={label}
                  value={fields.ilwExtras[field]}
                  onChange={(units) => change({ type: "ilwExtra", field, units })}
                  error="Enter a whole number of units, 0 or more."
                  hint={cents === null ? undefined : `Estimated ${dollars(cents)}`}
                />
              );
            })}
          </div>
          <p role="note" className="rounded-sm bg-info-bg px-3.5 py-2.5 text-sm text-ink">{WORKSHEET_COPY.bfp}</p>
        </section>
      ) : null}
    </div>
  );
}
