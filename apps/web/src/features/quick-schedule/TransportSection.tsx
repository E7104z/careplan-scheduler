import { useEffect, useState, type Dispatch } from "react";
import type { DaysPerWeek, Weekday } from "@careplan/engine";
import { weekdayName } from "../../lib/format";
import { Field } from "../../ui/Field";
import { NumberField } from "../../ui/NumberField";
import { Select } from "../../ui/Select";
import { PaneSection } from "./PaneSection";
import type { QuickAction } from "./state";
import type { ManualTransport, QuickModel, QuickState } from "./types";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const TRIPS: DaysPerWeek[] = [1, 2, 3, 4, 5, 6, 7];

interface Props {
  state: QuickState;
  model: QuickModel;
  dispatch: Dispatch<QuickAction>;
  /** Changes on every dispatch, so a refused value goes back to what the schedule holds. */
  seq: number;
}

function UsualDay({ state, dispatch }: Pick<Props, "state" | "dispatch">) {
  return (
    <Field label="Usual day">
      <Select
        value={state.transport.day}
        onChange={(event) => dispatch({ type: "setTransportDay", day: Number(event.target.value) as Weekday })}
      >
        {WEEKDAYS.map((day) => (
          <option key={day} value={day}>
            {weekdayName(day)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** QS-09 by hand: minutes per trip (blank or 0 = none), trips per week and the usual day. */
function ManualTransportFields({ state, model, dispatch, seq }: Props) {
  const transport = state.transport as ManualTransport;
  const saved = transport.minPerTrip > 0 ? String(transport.minPerTrip) : "";
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved, seq]);
  const commit = () => {
    const value = /^\d+$/.test(draft.trim()) ? Number(draft.trim()) : 0;
    if (value !== transport.minPerTrip) dispatch({ type: "setTransportMinPerTrip", value });
    else setDraft(saved);
  };
  const allowance = model.allowance;
  return (
    <>
      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-2">
        <Field label="Minutes per trip">
          <NumberField
            min={0}
            step={5}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              }
            }}
          />
        </Field>
        <Field label="Trips per week">
          <Select
            value={transport.tripsPerWeek}
            onChange={(event) =>
              dispatch({ type: "setTransportTripsPerWeek", value: Number(event.target.value) as DaysPerWeek })
            }
          >
            {TRIPS.map((trips) => (
              <option key={trips} value={trips}>
                {trips}
              </option>
            ))}
          </Select>
        </Field>
        <UsualDay state={state} dispatch={dispatch} />
      </div>
      <p className="text-[13px] text-ink-3">
        {allowance
          ? `${allowance.minutesPerMonth} minutes a month = ${allowance.units} units${
              allowance.unallocatedMinutes > 0 ? `, ${allowance.unallocatedMinutes} minutes left over` : ""
            }. These come off the monthly units before tasks.`
          : "Leave minutes blank if the plan has no transportation."}
      </p>
    </>
  );
}

/** QS-09 / APP-SPEC 5.2: essential transportation, for CDS and ILW only. */
export function TransportSection(props: Props) {
  const { state, model, dispatch } = props;
  if (model.svc.program !== "CDS" && model.svc.program !== "ILW") return null;
  if (state.source === "manual") {
    return (
      <PaneSection title="Essential transportation" hint="Optional">
        <ManualTransportFields {...props} />
      </PaneSection>
    );
  }
  const allowance = model.allowance;
  return (
    <PaneSection title="Essential transportation">
      {allowance ? (
        <>
          <p className="text-ink">
            {`${allowance.minutesPerMonth} minutes a month from Fusion (${allowance.units} units), about ${allowance.weeklyMinutes} minutes a week. This time comes off the monthly units before tasks.`}
          </p>
          <div className="max-w-[220px]">
            <UsualDay state={state} dispatch={dispatch} />
          </div>
        </>
      ) : (
        <p className="text-[13px] text-ink-3">This care plan has no transportation.</p>
      )}
    </PaneSection>
  );
}
