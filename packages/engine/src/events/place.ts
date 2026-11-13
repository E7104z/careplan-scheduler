import { adcAttendanceChecks } from "../compose/attendance.js";
import { hdmMealChecks } from "../compose/meals.js";
import { ruleCON10NurseVisits } from "../rules/conflicts.js";
import { placedInMonth, ruleEVT01EventDates, ruleEVT02EventQuantity, ruleEVT03ContextEvents } from "../rules/evt.js";
import type { RulePack } from "../rulepacks/types.js";
import type { AdcAttendance, HdmDelivery, ValidationResult, Visit } from "../types.js";
import type { EventAuthorization, EventBalance, PlanEvent } from "./types.js";

export interface PlaceEventInput {
  pack: RulePack;
  /** The event to place. One with the id of an event already placed replaces it (a move). */
  event: PlanEvent;
  authorization: EventAuthorization;
  /** Every event already placed in the plan, for every authorization. */
  events: readonly PlanEvent[];
}

export interface PlaceEventOutcome {
  accepted: boolean;
  /** Why it was refused: each with its limit. Empty when accepted. */
  results: ValidationResult[];
  /** The plan's events with this one placed; the list passed in, untouched, when refused. */
  events: readonly PlanEvent[];
}

/**
 * Nurse visits as CON-10 reads them: one `Visit` per visit on a date. A general health
 * evaluation done at a regular nurse visit is one visit, so a date counts the larger of its
 * evaluations and its other visits.
 */
function nurseVisits(events: readonly PlanEvent[]): Visit[] {
  const byDate = new Map<string, { evaluations: number; others: number }>();
  for (const event of events) {
    if (event.kind !== "NURSE_VISIT") continue;
    const day = byDate.get(event.date) ?? { evaluations: 0, others: 0 };
    if (event.evaluation) day.evaluations += 1;
    else day.others += 1;
    byDate.set(event.date, day);
  }
  return [...byDate].flatMap(([date, day]) =>
    Array.from({ length: Math.max(day.evaluations, day.others) }, (_, index): Visit => ({
      id: `${date}#${index}`, participantId: "", caregiverId: "", serviceCode: "T1001",
      start: `${date}T00:00`, end: `${date}T00:00`, taskIds: [],
    })),
  );
}

/** The caps of the event's kind, from the rules that already hold them. Never a new constant. */
function capResults(pack: RulePack, event: PlanEvent, events: readonly PlanEvent[]): ValidationResult[] {
  const sameKind = events.filter((other) => other.kind === event.kind);
  if (event.kind === "NURSE_VISIT") return ruleCON10NurseVisits(nurseVisits(sameKind));
  const limits = pack.stateParity3a;
  if (!limits) return [];
  if (event.kind === "ADC_DAY") {
    const attendances: AdcAttendance[] = sameKind.map((other) => ({
      id: other.id, serviceAuthId: other.authorizationId, date: other.date,
      minutes: other.quantity, transportMinutes: other.transportMinutes ?? 0,
    }));
    return adcAttendanceChecks(attendances, limits.adultDayCare);
  }
  if (event.kind === "MEAL_DELIVERY") {
    const deliveries: HdmDelivery[] = sameKind.map((other) => ({
      id: other.id, serviceAuthId: other.authorizationId, date: other.date, meals: other.quantity,
    }));
    return hdmMealChecks(deliveries, limits.hdmMaxUnitsPerDayNote);
  }
  return [];
}

function key(result: ValidationResult): string {
  return `${result.ruleId}|${result.severity}|${result.message}|${result.refs.date ?? ""}`;
}

/**
 * Place a dated event, or refuse it with the limit it would break. Refused when its date is
 * outside its authorization (EVT-01), when it would go over the month's authorized quantity
 * (EVT-02), when it would put a shift or a billable event on a context authorization (EVT-03), or
 * when it would break a cap an existing rule holds: nurse visits one a day and 26 in six months
 * (CON-10), adult day care minutes, days a week and transportation (WS-R08), meals a day (WS-R09).
 * A cap finding keeps its rule's own severity; any new finding refuses the placement. The engine
 * never places an event by itself.
 */
export function placeEvent({ pack, event, authorization, events }: PlaceEventInput): PlaceEventOutcome {
  const refuse = (results: ValidationResult[]): PlaceEventOutcome => ({ accepted: false, results, events });
  if (event.authorizationId !== authorization.id) {
    return refuse([{
      ruleId: "EVT-01", severity: "BLOCK", message: "The event belongs to a different authorization",
      refs: { serviceAuthId: authorization.id, date: event.date },
    }]);
  }
  // What can go on this authorization at all comes first: a refusal there is the whole answer.
  const context = ruleEVT03ContextEvents(event, authorization);
  if (context.length > 0) return refuse(context);
  const own = [...ruleEVT01EventDates(event, authorization), ...ruleEVT02EventQuantity(event, authorization, events)];
  if (own.length > 0) return refuse(own);

  const without = events.filter((other) => other.id !== event.id);
  const next = [...without, event];
  // Only what this placement adds refuses it: a finding the plan already had is not its doing.
  const before = new Set(capResults(pack, event, without).map(key));
  const added = capResults(pack, event, next).filter((result) => !before.has(key(result)));
  if (added.length > 0) return refuse(added);
  return { accepted: true, results: [], events: next };
}

/** The plan's events without one. Removing is never refused: it only lowers what is placed. */
export function removeEvent(events: readonly PlanEvent[], eventId: string): readonly PlanEvent[] {
  return events.filter((event) => event.id !== eventId);
}

/**
 * An authorization's month in its own unit: what Fusion authorized, what is placed, what is left.
 * Reminders count toward nothing. Never converted to 15-minute units.
 */
export function eventBalance(authorization: EventAuthorization, events: readonly PlanEvent[], month: string): EventBalance {
  const authorized = authorization.months.find((entry) => entry.month === month)?.quantity ?? null;
  const placed = placedInMonth(authorization.id, events, month);
  return { unit: authorization.unit, authorized, placed, left: authorized === null ? null : authorized - placed };
}
