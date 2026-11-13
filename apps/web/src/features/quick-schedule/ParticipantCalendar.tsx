import { useMemo, useRef, useState, type Dispatch, type KeyboardEvent } from "react";
import type { RulePack } from "@careplan/engine";
import { cn } from "../../lib/cn";
import { monthName, niceDate, weekdayName } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { balanceRows, calendarMonths, ilwSwitchProjection, nextVisitNeeded, respiteLine } from "./balances";
import { amendmentMarkers, calendarCells, listRows, moveDate, type CalendarCell } from "./calendarView";
import { DayChangeForm } from "./DayChangeForm";
import { localMonth } from "./model";
import { normalizeEvents, occurrencesIn } from "./normalizeEvents";
import type { CarePlan, QuickModel } from "./types";
import type { QuickFeedback, StoreAction } from "./useQuickStore";

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function wideScreen(): boolean {
  return typeof window.matchMedia !== "function" || window.matchMedia("(min-width: 860px)").matches;
}

export interface ParticipantCalendarProps {
  plan: CarePlan;
  models: QuickModel[];
  pack: RulePack;
  today: Date;
  feedback: QuickFeedback | null;
  dispatch: Dispatch<StoreAction>;
}

/**
 * APP-SPEC 5.8 "The participant calendar": the month, every service and every dated event on real
 * dates, read only from `normalizeEvents`. A grid (Sunday to Saturday, arrow keys move between
 * dates) and the same month as a list, which is the default on a narrow screen; beside them each
 * authorization's balance in its own unit. Choosing a date offers "Change this day".
 */
export function ParticipantCalendar({ plan, models, pack, today, feedback, dispatch }: ParticipantCalendarProps) {
  const months = useMemo(() => calendarMonths(plan, models), [plan, models]);
  const current = localMonth(today);
  const [chosen, setChosen] = useState<string | null>(null);
  const month = chosen !== null && months.includes(chosen) ? chosen : (months.find((candidate) => candidate >= current) ?? months[0] ?? current);
  // The month on screen only: the same list the PDF reads, one month of it.
  const occurrences = useMemo(() => normalizeEvents(plan, models, pack, [month]), [plan, models, pack, month]);
  const [view, setView] = useState<"grid" | "list">(() => (wideScreen() ? "grid" : "list"));
  const [focused, setFocused] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const planDates = {
    start: plan.services.map((state) => state.plan.start).sort()[0]!,
    end: plan.services.map((state) => state.plan.end).sort().at(-1)!,
  };
  const cells = calendarCells(occurrences, month, planDates, amendmentMarkers(plan, models));
  const rows = listRows(occurrences, month);
  const focusDate = focused !== null && focused.startsWith(month) ? focused : `${month}-01`;
  const selectedCell = selected !== null && selected.startsWith(month) ? cells.find((cell) => cell.date === selected) : undefined;
  const at = months.indexOf(month);
  const balances = balanceRows(plan, models, month);
  const notes = [nextVisitNeeded(plan, current), respiteLine(models, month), ilwSwitchProjection(models, month)].filter(
    (note): note is string => note !== null,
  );

  const go = (next: string) => {
    setChosen(next);
    setSelected(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, cell: CalendarCell) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (cell.inPlan) setSelected(cell.date);
      return;
    }
    const next = moveDate(cell.date, event.key);
    if (next === cell.date) return;
    event.preventDefault();
    setFocused(next);
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus();
  };

  // Weeks of seven, padded before the 1st and after the last day.
  const padded: (CalendarCell | null)[] = [...Array.from({ length: cells[0]?.weekday ?? 0 }, () => null), ...cells];
  while (padded.length % 7 !== 0) padded.push(null);
  const weeks = Array.from({ length: padded.length / 7 }, (_, week) => padded.slice(week * 7, week * 7 + 7));

  return (
    <Panel
      title="The participant's month"
      className="min-w-0"
      tools={
        <div className="flex items-center gap-1 print:hidden">
          <Button variant="quiet" size="sm" aria-label="Previous month on the calendar" disabled={at <= 0} onClick={() => go(months[at - 1]!)}>
            ‹
          </Button>
          <strong aria-live="polite" className="min-w-[9ch] text-center text-sm font-semibold text-ink">
            {monthName(month)}
          </strong>
          <Button variant="quiet" size="sm" aria-label="Next month on the calendar" disabled={at < 0 || at >= months.length - 1} onClick={() => go(months[at + 1]!)}>
            ›
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <Button variant={view === "grid" ? "primary" : "secondary"} size="sm" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
          Calendar
        </Button>
        <Button variant={view === "list" ? "primary" : "secondary"} size="sm" aria-pressed={view === "list"} onClick={() => setView("list")}>
          Month as a list
        </Button>
        <span className="text-[13px] text-ink-3">Arrow keys move between dates. Enter chooses a date to change.</span>
      </div>

      <div className="grid gap-5 min-[1060px]:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <div className="min-w-0">
          {view === "grid" ? (
            <div ref={gridRef} role="grid" aria-label={`${monthName(month)}, by date`} className="grid gap-1">
              <div role="row" className="grid grid-cols-7 gap-1 text-center text-[13px] font-medium text-ink-3">
                {DOW_SHORT.map((label, weekday) => (
                  <div key={label} role="columnheader" aria-label={weekdayName(weekday as 0)}>
                    {label}
                  </div>
                ))}
              </div>
              {weeks.map((week, index) => (
                <div key={index} role="row" className="grid grid-cols-7 gap-1">
                  {week.map((cell, column) =>
                    cell === null ? (
                      <div key={`pad-${column}`} role="gridcell" />
                    ) : (
                      <div
                        key={cell.date}
                        role="gridcell"
                        data-date={cell.date}
                        tabIndex={cell.date === focusDate ? 0 : -1}
                        aria-label={cell.label}
                        aria-selected={cell.date === selected}
                        onFocus={() => setFocused(cell.date)}
                        onKeyDown={(event) => onKeyDown(event, cell)}
                        onClick={() => cell.inPlan && setSelected(cell.date)}
                        className={cn(
                          "grid min-h-[76px] min-w-0 content-start gap-0.5 rounded-sm border p-1 text-left text-[12px] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus",
                          cell.items.length > 0 ? "border-line" : "border-dashed border-line text-ink-3",
                          cell.inPlan && "cursor-pointer",
                          cell.date === selected && "border-brand bg-brand-tint",
                        )}
                      >
                        <span aria-hidden="true" className="text-[13px] font-semibold text-ink-2">{cell.day}</span>
                        {cell.bands.map((band) => (
                          <span key={band.service} aria-hidden="true" className="truncate rounded-sm bg-sunk px-1 text-ink">
                            {`${band.service} ${band.minutes}`}
                          </span>
                        ))}
                        {cell.events.map((event, order) => (
                          <span key={order} aria-hidden="true" className="truncate rounded-sm border border-line-2 px-1 font-semibold text-ink">
                            {`${event.mark}: ${event.service}`}
                          </span>
                        ))}
                        {cell.markers.length > 0 ? (
                          <span aria-hidden="true" className="truncate border-l-4 border-l-info pl-1 font-semibold text-ink">Change</span>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${monthName(month)} as a list, scrollable`}>
              <table className="w-full min-w-[420px] text-sm">
                <caption className="sr-only">{`${monthName(month)} as a list`}</caption>
                <thead>
                  <tr className="border-b border-line text-left text-[13px] text-ink-2">
                    <th scope="col" className="py-1.5 pr-3 font-semibold">Date</th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">Service</th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">What</th>
                    <th scope="col" className="py-1.5 font-semibold">How much</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-2 text-ink-2">Nothing is scheduled or placed this month.</td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr key={index} className="border-b border-line">
                        <td className="py-1.5 pr-3 text-ink">
                          <button type="button" className="rounded-sm text-left underline max-sm:min-h-11" onClick={() => setSelected(row.date)}>
                            {niceDate(row.date)}
                          </button>
                        </td>
                        <td className="py-1.5 pr-3 text-ink">{row.service}</td>
                        <td className="py-1.5 pr-3 text-ink">{row.mark ? `${row.mark}: ${row.what}` : row.what}</td>
                        <td className="py-1.5 text-ink">{row.amount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[13px] text-ink-3">
            Dashed dates have no care or are outside the plan. Marks: Visit, Day care, Meals, Day (a covered day),
            Reminder (not a visit), Change (a care plan change takes effect).
          </p>
          {selectedCell ? (
            <DayChangeForm
              plan={plan}
              cell={selectedCell}
              tasks={occurrencesIn(occurrences, month).filter((occurrence) => occurrence.date === selectedCell.date && occurrence.kind === "TASK")}
              feedback={feedback}
              dispatch={dispatch}
            />
          ) : null}
        </div>

        <section aria-label="Authorization balances" className="min-w-0">
          <h3 className="mb-2 text-[15px] font-bold text-ink">Authorization balances</h3>
          {balances.length === 0 ? (
            <p className="text-sm text-ink-2">No authorization has a figure for this month.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {balances.map((row) => (
                <li key={row.authorizationId} className="rounded-sm border border-line px-3 py-2">
                  <strong className="block text-ink">{row.name}</strong>
                  <span className="text-ink-2">{`${row.authorized} in ${monthName(month)} · ${row.used} · ${row.left}`}</span>
                </li>
              ))}
            </ul>
          )}
          {notes.map((note) => (
            <p key={note} className="mt-2 text-sm text-ink">{note}</p>
          ))}
        </section>
      </div>
    </Panel>
  );
}
