import { useId, type Dispatch } from "react";
import type { PlanEvent } from "@careplan/engine";
import { cn } from "../../lib/cn";
import { monthName, niceDate } from "../../lib/format";
import { Panel } from "../../ui/Panel";
import { isUpcoming } from "./carePlan";
import { localMonth } from "./model";
import { eventsOf, planEventResults, sharesVisit } from "./planEvents";
import type { CarePlan, PlanVisit } from "./types";
import type { QuickFeedback, StoreAction } from "./useQuickStore";

export const dateInputClass =
  "h-10 rounded-sm border border-line-2 bg-surface px-3 text-ink focus:border-brand max-sm:min-h-11";
export const quietButtonClass =
  "rounded-sm font-semibold text-brand underline hover:text-brand-hover max-sm:inline-flex max-sm:min-h-11 max-sm:items-center";

/** "Past", "This month" or "Coming up", against today's month. */
function visitWhen(visit: PlanVisit, today: Date): string {
  if (!isUpcoming(visit, today)) return "Past";
  return visit.start.slice(0, 7) <= localMonth(today) ? "This month" : "Coming up";
}

/** The refusal of the last placement, when it was for this authorization (APP-SPEC 5.7). */
export function eventRefusal(feedback: QuickFeedback | null, authorizationId: string | undefined): string | null {
  if (!feedback || feedback.action.type !== "placeEvent" || feedback.refusal === undefined) return null;
  return feedback.action.event.authorizationId === authorizationId ? feedback.refusal : null;
}

interface VisitItemProps {
  plan: CarePlan;
  visit: PlanVisit;
  today: Date;
  missed: boolean;
  refusal: string | null;
  dispatch: Dispatch<StoreAction>;
}

function VisitItem({ plan, visit, today, missed, refusal, dispatch }: VisitItemProps) {
  const id = useId();
  const month = monthName(visit.start.slice(0, 7));
  const when = visitWhen(visit, today);
  const all = visit.id ? eventsOf(plan, visit.id) : [];
  const dated = all.filter((event) => event.kind === "NURSE_VISIT");
  const reminders = all.filter((event) => event.kind === "REMINDER");
  const place = (date: string, event?: PlanEvent) => {
    if (!visit.id) return;
    if (date === "") {
      if (event) dispatch({ type: "removeEvent", eventId: event.id });
      return;
    }
    dispatch({ type: "placeEvent", event: { id: event?.id, authorizationId: visit.id, kind: "NURSE_VISIT", date } });
  };
  return (
    <li className="grid gap-2 rounded-sm border border-line px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="min-w-0">
          <strong className="text-ink">{visit.name}</strong>
          <span className="text-ink-2">{` · ${month}`}</span>
          <span className="block text-[13px] text-ink-3">
            {[visit.label, visit.pa ? `PA ${visit.pa}` : null, visit.provider].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className={cn("text-[13px] font-semibold", when === "Past" ? "text-ink-3" : "text-brand")}>{when}</span>
      </div>

      {dated.length === 0 ? <p className="text-ink-2">No date yet</p> : null}
      {dated.map((event, index) => (
        <div key={event.id} className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <label htmlFor={`${id}-${event.id}`} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
            <span>
              Visit date<span className="sr-only">{` for ${visit.name}, ${month}${dated.length > 1 ? `, visit ${index + 1}` : ""}`}</span>
            </span>
            <input
              id={`${id}-${event.id}`}
              type="date"
              className={dateInputClass}
              min={visit.start}
              max={visit.end}
              value={event.date}
              onChange={(change) => place(change.target.value, event)}
            />
          </label>
          <span className="pb-2 text-ink">{niceDate(event.date)}</span>
          <button
            type="button"
            className={cn(quietButtonClass, "pb-2")}
            aria-label={`Remove the date for ${visit.name}, ${month}`}
            onClick={() => dispatch({ type: "removeEvent", eventId: event.id })}
          >
            Remove date
          </button>
          {sharesVisit(plan, event) ? (
            <span className="w-full text-[13px] text-ink-2">Done at the nurse visit that day: one visit.</span>
          ) : null}
        </div>
      ))}
      {visit.id && dated.length < visit.units ? (
        <label htmlFor={`${id}-new`} className="grid w-fit gap-0.5 text-[13px] font-semibold text-ink-2">
          <span>
            Pick a date<span className="sr-only">{` for ${visit.name}, ${month}`}</span>
          </span>
          <input
            id={`${id}-new`}
            type="date"
            className={dateInputClass}
            min={visit.start}
            max={visit.end}
            value=""
            onChange={(change) => place(change.target.value)}
          />
        </label>
      ) : null}
      {reminders.map((event) => (
        <p key={event.id} className="text-[13px] text-ink-2">
          {`Reminder, not a visit · ${niceDate(event.date)} · ${event.note ?? "Reminder"}`}
        </p>
      ))}
      {missed ? (
        <p className="border-l-4 border-l-warn pl-2 text-ink">
          No date was placed for this month's visit. Pick a date above if one was arranged.
        </p>
      ) : null}
      {refusal ? (
        <p role="alert" className="border-l-4 border-l-block pl-2 text-ink">
          {refusal}
        </p>
      ) : null}
    </li>
  );
}

export interface VisitsPanelProps {
  plan: CarePlan;
  today: Date;
  feedback: QuickFeedback | null;
  dispatch: Dispatch<StoreAction>;
}

/**
 * APP-SPEC 5.8 "Nurse visits on dates": each visit Fusion authorized, in its month, with the date
 * the person picks for it. The app never creates a visit Fusion didn't authorize and never places
 * one by itself; a date outside the month, a second visit that day or one past the count is
 * refused with the limit (rules EVT-01, EVT-02, CON-10).
 */
export function VisitsPanel({ plan, today, feedback, dispatch }: VisitsPanelProps) {
  const { visits } = plan;
  if (visits.length === 0) return null;
  const upcoming = visits.filter((visit) => isUpcoming(visit, today)).length;
  const missed = new Set(planEventResults(plan, localMonth(today)).map((result) => result.refs.serviceAuthId));
  return (
    <Panel title="Nurse visits" meta="By date, in the month authorized" className="min-w-0">
      <p className="mb-3 text-sm text-ink-2">
        {upcoming > 0
          ? "Each is authorized for one month. Pick the date the nurse will come; it has to be in that month."
          : "Each is authorized for one month, and those months have passed. None are left in this plan."}
      </p>
      <ul className="grid gap-2">
        {visits.map((visit, index) => (
          <VisitItem
            key={visit.id ?? index}
            plan={plan}
            visit={visit}
            today={today}
            missed={visit.id !== undefined && missed.has(visit.id)}
            refusal={eventRefusal(feedback, visit.id)}
            dispatch={dispatch}
          />
        ))}
      </ul>
    </Panel>
  );
}
