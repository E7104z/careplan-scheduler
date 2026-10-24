import { useEffect, useState, type Dispatch } from "react";
import { MO_2026_07, type ServiceCode } from "@careplan/engine";
import { monthName } from "../../lib/format";
import { Field } from "../../ui/Field";
import { Select } from "../../ui/Select";
import { PaneSection } from "./PaneSection";
import { ServiceOptions } from "./ServiceOptions";
import type { QuickAction } from "./state";
import type { QuickState } from "./types";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthInput = "h-10 w-full rounded-sm border border-line-2 bg-surface px-3 text-ink focus:border-brand";

/** APP-SPEC 5.2 by hand: QS-01 service and QS-03 plan start (the plan ends 11 months later). */
export function ServiceSection({ state, dispatch }: { state: QuickState; dispatch: Dispatch<QuickAction> }) {
  const start = state.plan.start.slice(0, 7);
  // Browsers without a month picker show a text box; keep what's typed until it's a whole month.
  const [month, setMonth] = useState(start);
  useEffect(() => setMonth(start), [start]);

  return (
    <PaneSection title="Service">
      <Field label="Authorized service">
        <Select
          value={state.serviceCode}
          onChange={(event) => dispatch({ type: "setService", code: event.target.value as ServiceCode })}
        >
          <ServiceOptions pack={MO_2026_07} />
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Plan starts">
          <input
            type="month"
            className={monthInput}
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              if (MONTH.test(event.target.value)) dispatch({ type: "setPlanStart", month: event.target.value });
            }}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-2">Plan ends</span>
          <span className="flex h-10 items-center text-ink-2">{monthName(state.plan.end.slice(0, 7))}</span>
        </div>
      </div>
    </PaneSection>
  );
}
