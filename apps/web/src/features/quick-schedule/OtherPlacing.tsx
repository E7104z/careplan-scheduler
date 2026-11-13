import { useId, useState, type Dispatch, type ReactNode } from "react";
import type { Appendix1Service, PlanEventKind } from "@careplan/engine";
import { Button } from "../../ui/Button";
import { NumberField } from "../../ui/NumberField";
import { TextInput } from "../../ui/TextInput";
import { balanceText, eventLine, placedMonths } from "./eventText";
import { dateInputClass, eventRefusal, quietButtonClass } from "./NurseVisits";
import { otherName, otherService } from "./others";
import { eventsOf, otherAuthorization, planEvents, type EventRequest } from "./planEvents";
import type { CarePlan, PlanOther } from "./types";
import type { QuickFeedback, StoreAction } from "./useQuickStore";

/** What a kept authorization places on dates, from its Appendix 1 class and mode. Null: nothing. */
export type PlacingKind = "adc" | "meals" | "days" | "visits" | "reminders" | "none";

export function placingKind(service: Appendix1Service): PlacingKind | null {
  // ILW financial management is authorization context only: it shows its authorization, nothing to place.
  if (service.id === "MO_ILW_FMS") return "none";
  if (service.scheduleClass === "CONTEXT") return "reminders";
  if (service.mode === "ATTENDANCE") return "adc";
  if (service.mode === "DELIVERY_COUNT") return "meals";
  if (service.mode === "DAY_COVERAGE") return "days";
  if (service.mode === "VISIT_COUNT") return "visits";
  return null;
}

const KIND_OF: Record<Exclude<PlacingKind, "none">, PlanEventKind> = {
  adc: "ADC_DAY", meals: "MEAL_DELIVERY", days: "SFC_DAY", visits: "NURSE_VISIT", reminders: "REMINDER",
};

const BUTTON: Record<Exclude<PlacingKind, "none">, string> = {
  adc: "Add day care day", meals: "Add delivery", days: "Mark covered day", visits: "Add visit", reminders: "Add reminder",
};

const HINT: Record<Exclude<PlacingKind, "none">, string> = {
  adc: "Attendance, in 15-minute steps. It is never caregiver time.",
  meals: "Counted as meals, never as time. No more than 2 a day.",
  days: "A covered day is one day, never 15-minute units.",
  visits: "One visit a day, in a month the care plan authorizes.",
  reminders: "A reminder is a note on a date. It is never a visit and is never billed.",
};

function Labeled({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <label htmlFor={id} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
      {label}
      {children}
    </label>
  );
}

export interface OtherPlacingProps {
  plan: CarePlan;
  other: PlanOther;
  feedback: QuickFeedback | null;
  dispatch: Dispatch<StoreAction>;
}

/**
 * APP-SPEC 5.8 "Services arranged by date": the control that places a kept authorization on
 * dates, in its own unit. Adult day care is minutes attended (with its transportation), meals
 * are meals, a structured family caregiver day is a day, and a context authorization takes only
 * a reminder. The authorization stays in `others`; its events point at it. Every placement goes
 * through the guard and is refused with the limit beside the control.
 */
export function OtherPlacing({ plan, other, feedback, dispatch }: OtherPlacingProps) {
  const id = useId();
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [transport, setTransport] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const service = otherService(other);
  const authorization = otherAuthorization(other);
  const kind = service ? placingKind(service) : null;
  if (!service || !authorization || kind === null) return null;
  const name = otherName(other);
  if (kind === "none") {
    return <p className="text-[13px] text-ink-2">Nothing to place: this is authorization context only.</p>;
  }

  const events = eventsOf(plan, authorization.id);
  const refusal = eventRefusal(feedback, authorization.id);
  const wholeNumber = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

  const add = () => {
    if (date === "") return setError("Pick a date first.");
    const request: EventRequest = { authorizationId: authorization.id, kind: KIND_OF[kind], date };
    if (kind === "adc" || kind === "meals") {
      const quantity = wholeNumber(amount);
      if (quantity === null) return setError(kind === "adc" ? "Enter the minutes as a whole number." : "Enter the number of meals.");
      request.quantity = quantity;
    }
    if (kind === "adc" && transport.trim() !== "") {
      const minutes = wholeNumber(transport);
      if (minutes === null) return setError("Enter the transportation minutes as a whole number.");
      request.transportMinutes = minutes;
    }
    if (kind === "reminders" && note.trim() !== "") request.note = note.trim().slice(0, 200);
    setError(null);
    dispatch({ type: "placeEvent", event: request });
  };

  return (
    <div role="group" aria-label={`Place ${name} on the calendar`} className="grid gap-2 rounded-sm bg-sunk px-3 py-2">
      <p className="text-[13px] font-semibold text-ink">Place on the calendar</p>
      <p className="text-[13px] text-ink-2">{HINT[kind]}</p>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <Labeled id={`${id}-date`} label="Date">
          <input
            id={`${id}-date`}
            type="date"
            className={dateInputClass}
            min={authorization.start}
            max={kind === "reminders" ? undefined : authorization.end}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Labeled>
        {kind === "adc" ? (
          <>
            <Labeled id={`${id}-amount`} label="Minutes attended">
              <NumberField id={`${id}-amount`} className="w-[130px]" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Labeled>
            <Labeled id={`${id}-transport`} label="Transportation minutes">
              <NumberField id={`${id}-transport`} className="w-[130px]" value={transport} onChange={(event) => setTransport(event.target.value)} />
            </Labeled>
          </>
        ) : null}
        {kind === "meals" ? (
          <Labeled id={`${id}-amount`} label="Meals">
            <NumberField id={`${id}-amount`} className="w-[90px]" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Labeled>
        ) : null}
        {kind === "reminders" ? (
          <Labeled id={`${id}-note`} label="Note (optional)">
            <TextInput id={`${id}-note`} className="w-[260px] max-w-full" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} />
          </Labeled>
        ) : null}
        <Button variant="secondary" size="sm" aria-label={`${BUTTON[kind]} for ${name}`} onClick={add}>
          {BUTTON[kind]}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="border-l-4 border-l-block pl-2 text-sm text-ink">
          {error}
        </p>
      ) : null}
      {refusal && !error ? (
        <p role="alert" className="border-l-4 border-l-block pl-2 text-sm text-ink">
          {refusal}
        </p>
      ) : null}
      {events.length > 0 ? (
        <ul className="grid gap-1 text-sm text-ink" aria-label={`${name}: placed dates`}>
          {events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline gap-x-3">
              <span>{eventLine(event)}</span>
              <button
                type="button"
                className={quietButtonClass}
                aria-label={`Remove ${name} on ${eventLine(event)}`}
                onClick={() => dispatch({ type: "removeEvent", eventId: event.id })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {placedMonths(authorization.id, planEvents(plan)).map((month) => (
        <p key={month} className="text-[13px] font-semibold text-ink-2">
          {balanceText(authorization, planEvents(plan), month)}
        </p>
      ))}
    </div>
  );
}
