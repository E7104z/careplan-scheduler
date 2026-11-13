import { useId, useState, type Dispatch } from "react";
import type { AmendmentDirection, DaysPerWeek, RulePack } from "@careplan/engine";
import { niceDate } from "../../lib/format";
import { Button } from "../../ui/Button";
import { NumberField } from "../../ui/NumberField";
import { Panel } from "../../ui/Panel";
import { Select } from "../../ui/Select";
import { amendmentLines, amendmentsOf, amendmentWhen, DIRECTION_LABELS, type AmendmentDraft } from "./amendments";
import { dateInputClass, quietButtonClass } from "./NurseVisits";
import type { QuickModel, QuickState } from "./types";
import type { QuickFeedback, StoreAction } from "./useQuickStore";

const DAYS: DaysPerWeek[] = [1, 2, 3, 4, 5, 6, 7];
const DIRECTIONS: AmendmentDirection[] = ["increase", "decrease", "reduction-immediate"];

interface TaskDraft {
  minutes: string;
  days: DaysPerWeek;
}

function initialTasks(state: QuickState): Record<string, TaskDraft> {
  return Object.fromEntries(state.tasks.map((task) => [task.id, { minutes: String(task.minPerDay ?? 0), days: task.daysPerWeek }]));
}

export interface AmendmentsPanelProps {
  state: QuickState;
  model: QuickModel;
  /** The service's place in the plan. */
  service: number;
  pack: RulePack;
  feedback: QuickFeedback | null;
  dispatch: Dispatch<StoreAction>;
}

/**
 * APP-SPEC 5.8 "Care plan changes": record a change to one service (kind, the date, the new
 * minutes and days or units) and see the changes already recorded. A change adds a version from
 * its effective date on; it never edits what Fusion printed, and nothing before that date moves.
 * Recording goes through the guard and is refused with the reason.
 */
export function AmendmentsPanel({ state, model, service, feedback, dispatch }: AmendmentsPanelProps) {
  const id = useId();
  const [direction, setDirection] = useState<AmendmentDirection>("increase");
  const [date, setDate] = useState("");
  const [tasks, setTasks] = useState<Record<string, TaskDraft>>(() => initialTasks(state));
  const [units, setUnits] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorded = amendmentsOf(state);
  const refusal =
    feedback && feedback.action.type === "recordAmendment" && feedback.action.service === service ? (feedback.refusal ?? null) : null;

  const record = () => {
    const draft: AmendmentDraft = { direction, date, confirmed, tasks: {}, units: null };
    for (const task of state.tasks) {
      const entry = tasks[task.id] ?? { minutes: String(task.minPerDay ?? 0), days: task.daysPerWeek };
      if (!/^\d+$/.test(entry.minutes.trim())) return setError(`Enter ${task.name}'s minutes a day as a whole number.`);
      draft.tasks[task.id] = { minPerDay: Number(entry.minutes.trim()), daysPerWeek: entry.days };
    }
    if (units.trim() !== "") {
      if (!/^\d+$/.test(units.trim())) return setError("Enter the units a month as a whole number.");
      draft.units = Number(units.trim());
    }
    if (date === "") return setError("Enter the date the change takes effect.");
    setError(null);
    dispatch({ type: "recordAmendment", service, amendment: draft });
  };

  return (
    <Panel title="Care plan changes" meta={recorded.length > 0 ? `${recorded.length} recorded` : "None recorded"} className="min-w-0 print:hidden">
      <p className="mb-3 text-sm text-ink-2">
        If the care plan changes partway through, record the change here. The schedule follows it from the date it takes
        effect; nothing before that date moves, and Fusion's figures are kept as read.
      </p>
      {recorded.length > 0 ? (
        <ul className="mb-4 grid gap-2" aria-label="Recorded care plan changes">
          {recorded.map((amendment) => (
            <li key={amendment.id} className="grid gap-1 rounded-sm border border-l-4 border-line border-l-info px-3 py-2 text-sm">
              <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                <strong className="text-ink">{`${DIRECTION_LABELS[amendment.direction]} · ${amendmentWhen(amendment)}`}</strong>
                <button
                  type="button"
                  className={quietButtonClass}
                  aria-label={`Remove the change of ${niceDate(amendment.date)}`}
                  onClick={() => dispatch({ type: "removeAmendment", service, amendmentId: amendment.id })}
                >
                  Remove change
                </button>
              </span>
              {amendmentLines(state, amendment).map((line) => (
                <span key={line} className="text-ink-2">
                  {line}
                </span>
              ))}
              <span className="text-[13px] text-ink-2">
                {amendment.confirmed
                  ? "You said the care plan shows this date."
                  : "Needs review: check the date this change takes effect against the care plan (Manual 4.20)."}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div role="group" aria-label="Record a care plan change" className="grid gap-3 rounded-sm bg-sunk px-3 py-3">
        <p className="text-sm font-semibold text-ink">Record a care plan change</p>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <label htmlFor={`${id}-kind`} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
            Kind of change
            <Select id={`${id}-kind`} className="w-[300px] max-w-full" value={direction} onChange={(event) => setDirection(event.target.value as AmendmentDirection)}>
              {DIRECTIONS.map((value) => (
                <option key={value} value={value}>
                  {DIRECTION_LABELS[value]}
                </option>
              ))}
            </Select>
          </label>
          <label htmlFor={`${id}-date`} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
            Effective date
            <input
              id={`${id}-date`}
              type="date"
              className={dateInputClass}
              min={model.auth.start}
              max={state.plan.end}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label htmlFor={`${id}-units`} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
            New units a month (optional)
            <NumberField id={`${id}-units`} className="w-[150px]" value={units} onChange={(event) => setUnits(event.target.value)} />
          </label>
        </div>
        {direction === "decrease" ? (
          <p className="text-[13px] text-ink-2">A decrease starts on the first of a month. One dated later in a month starts the first of the next month.</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">Each task's minutes and days from the change on</caption>
            <thead>
              <tr className="text-left text-[13px] text-ink-2">
                <th scope="col" className="py-1 pr-3 font-semibold">Task</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Minutes a day</th>
                <th scope="col" className="py-1 font-semibold">Days a week</th>
              </tr>
            </thead>
            <tbody>
              {state.tasks.map((task) => {
                const entry = tasks[task.id] ?? { minutes: String(task.minPerDay ?? 0), days: task.daysPerWeek };
                return (
                  <tr key={task.id}>
                    <td className="py-1 pr-3 font-medium text-ink">{task.name}</td>
                    <td className="py-1 pr-3">
                      <NumberField
                        aria-label={`${task.name}: minutes a day from the change on`}
                        className="w-[100px]"
                        value={entry.minutes}
                        onChange={(event) => setTasks({ ...tasks, [task.id]: { ...entry, minutes: event.target.value } })}
                      />
                    </td>
                    <td className="py-1">
                      <Select
                        aria-label={`${task.name}: days a week from the change on`}
                        className="w-[90px]"
                        value={entry.days}
                        onChange={(event) => setTasks({ ...tasks, [task.id]: { ...entry, days: Number(event.target.value) as DaysPerWeek } })}
                      >
                        {DAYS.map((days) => (
                          <option key={days} value={days}>
                            {days}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-ink-2">Enter 0 minutes to take a task out of the week from the change on.</p>
        <label className="flex items-start gap-2 text-sm text-ink max-sm:min-h-11 max-sm:items-center">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          The care plan shows this date
        </label>
        <div>
          <Button variant="secondary" onClick={record}>
            Record change
          </Button>
        </div>
        {error ?? refusal ? (
          <p role="alert" className="border-l-4 border-l-block pl-2 text-sm text-ink">
            {error ?? refusal}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
