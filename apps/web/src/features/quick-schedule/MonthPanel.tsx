import { lazy, Suspense, useEffect, useState, type Dispatch, type ReactNode } from "react";
import { daysInMonth, weekdayOf, type Weekday } from "@careplan/engine";
import { cn } from "../../lib/cn";
import { formatUnits, monthName, weekdayName } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { NumberField } from "../../ui/NumberField";
import { Panel } from "../../ui/Panel";
import { MonthBalance } from "./MonthBalance";
import { addMonths, combinedRespiteFigure, hasSchedule, monthFigures } from "./model";
import { MonthTable } from "./MonthTable";
import type { QuickAction } from "./state";
import type { QuickModel, QuickState } from "./types";

// The accrual projection is its own chunk: it loads when the Month tab shows it (APP-SPEC 10).
const AccrualPanel = lazy(() => import("./AccrualPanel").then((module) => ({ default: module.AccrualPanel })));

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthPanelProps {
  state: QuickState;
  model: QuickModel;
  models: QuickModel[];
  dispatch: Dispatch<QuickAction>;
}

/** QS-11 by hand: enter Fusion's monthly figure; it is the one the schedule is checked against. */
function FusionUnitsField({
  state,
  month,
  dispatch,
}: {
  state: QuickState;
  month: string;
  dispatch: Dispatch<QuickAction>;
}) {
  const saved = state.fusion[month] !== undefined ? String(state.fusion[month]) : "";
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);

  const commit = () => {
    const text = draft.trim();
    const value = /^\d+$/.test(text) ? Number(text) : null;
    if (value !== (state.fusion[month] ?? null)) dispatch({ type: "setFusionUnits", month, units: value });
    else setDraft(saved);
  };

  return (
    <div className="mt-4 grid gap-1.5 print:hidden">
      <Field label="Fusion units this month" hint="Optional">
        <NumberField
          min={0}
          step={1}
          value={draft}
          placeholder="Optional"
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
      <p className="text-[13px] text-ink-3">
        If you have the authorized units from the Fusion care plan, enter them. Fusion's figure is always the one we
        check against.
      </p>
    </div>
  );
}
/**
 * APP-SPEC 5.4 month view: navigation limited to the plan's months, the unit meter, the by-hand
 * Fusion units field (QS-11), and a calendar that marks trimmed dates.
 */
export function MonthPanel({ state, model, models, dispatch }: MonthPanelProps) {
  const month = state.viewMonth;
  const [year, monthNumber] = month.split("-").map(Number);
  const figures = monthFigures(model, month);
  const combinedRespite = combinedRespiteFigure(models, month);

  const firstMonth = model.months[0] ?? month;
  const lastMonth = model.months[model.months.length - 1] ?? month;

  const trimByDate: Record<string, number> = {};
  for (const trim of figures.trims) trimByDate[trim.date] = (trimByDate[trim.date] ?? 0) - trim.minutesDelta;

  const first = weekdayOf(year ?? 0, monthNumber ?? 1, 1);
  const days = daysInMonth(year ?? 0, monthNumber ?? 1);
  const cells: ReactNode[] = [];
  for (let i = 0; i < first; i++) {
    cells.push(<div key={`pad-${i}`} aria-hidden="true" />);
  }
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const weekday = (first + d - 1) % 7;
    const inPlan = date >= state.plan.start && date <= state.plan.end;
    const minutes = Object.values(figures.expanded[date] ?? {}).reduce((sum, value) => sum + value, 0);
    const trim = trimByDate[date];
    const label = `${weekdayName(weekday as Weekday)} ${d}`;
    // A generic div's aria-label isn't read, so each date says what it holds in screen-reader text.
    if (!inPlan) {
      cells.push(
        <div
          key={date}
          className="flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-sm border border-dashed border-line p-1.5 text-ink-3"
        >
          <span className="sr-only">{`${label}: outside the plan`}</span>
          <span aria-hidden="true" className="text-[13px] font-medium">
            {d}
          </span>
        </div>,
      );
    } else if (minutes || trim) {
      cells.push(
        <div
          key={date}
          className={cn(
            "flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-sm border p-1.5",
            trim ? "border-warn" : "border-line",
          )}
        >
          <span className="sr-only">
            {`${label}: ${minutes} minutes${trim ? `, ${trim} minutes trimmed because the month's units run out` : ""}`}
          </span>
          <span aria-hidden="true" className="text-[13px] font-medium text-ink-2">
            {d}
          </span>
          <span aria-hidden="true" className="font-semibold text-ink">
            {minutes}
          </span>
          <span aria-hidden="true" className={cn("text-[12px]", trim ? "font-medium text-warn" : "text-ink-3")}>
            {trim ? `−${trim} min` : formatUnits(minutes)}
          </span>
        </div>,
      );
    } else {
      cells.push(
        <div
          key={date}
          className="flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-sm border border-dashed border-line p-1.5 text-ink-3"
        >
          <span className="sr-only">{`${label}: no care`}</span>
          <span aria-hidden="true" className="text-[13px] font-medium">
            {d}
          </span>
        </div>,
      );
    }
  }
  return (
    <Panel
      title="Month"
      className="min-w-0"
      tools={
        <div className="flex items-center gap-1">
          <Button
            variant="quiet"
            size="sm"
            aria-label="Previous month"
            className="print:hidden"
            disabled={month === firstMonth}
            onClick={() => dispatch({ type: "setViewMonth", month: addMonths(month, -1) })}
          >
            ‹
          </Button>
          <strong aria-live="polite" className="min-w-[9ch] text-center text-sm font-semibold text-ink">
            {monthName(month)}
          </strong>
          <Button
            variant="quiet"
            size="sm"
            aria-label="Next month"
            className="print:hidden"
            disabled={month === lastMonth}
            onClick={() => dispatch({ type: "setViewMonth", month: addMonths(month, 1) })}
          >
            ›
          </Button>
        </div>
      }
    >
      {!hasSchedule(model) ? (
        <p className="text-ink-2">Add tasks to see this month's units.</p>
      ) : (
        <>
          <MonthBalance model={model} month={month} figures={figures} combinedRespite={combinedRespite} />

          {state.source === "manual" ? <FusionUnitsField state={state} month={month} dispatch={dispatch} /> : null}

          <div role="group" aria-label="Month calendar" className="mt-4">
            <div className="grid grid-cols-7 gap-1 text-center text-[13px] font-medium text-ink-3">
              {DOW_SHORT.map((label) => (
                <div key={label} aria-hidden="true">
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">{cells}</div>
          </div>
          <MonthTable model={model} />
          <Suspense fallback={null}>
            <AccrualPanel state={state} model={model} />
          </Suspense>
        </>
      )}
    </Panel>
  );
}


