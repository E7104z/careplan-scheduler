import type { EventAuthorization, EventUnit, PlanEvent } from "../events/types.js";
import type { ValidationResult } from "../types.js";

const UNIT_WORDS: Record<EventUnit, [one: string, many: string]> = {
  visit: ["visit", "visits"],
  meal: ["meal", "meals"],
  day: ["covered day", "covered days"],
  minute: ["minute", "minutes"],
  none: ["event", "events"],
};

/** The billable quantity an authorization has placed in a month, in its own unit. */
export function placedInMonth(authorizationId: string, events: readonly PlanEvent[], month: string): number {
  return events
    .filter((event) => event.authorizationId === authorizationId && event.billable && event.date.startsWith(month))
    .reduce((total, event) => total + event.quantity, 0);
}

/**
 * A billable event is dated inside its authorization: within the authorization's own dates, in a
 * month Fusion authorized. A reminder is a note, not a service, and is not checked.
 * @rule EVT-01
 * @source The authorization's own dates and months as Fusion prints them; product decision Nov 13, 2026
 */
export function ruleEVT01EventDates(event: PlanEvent, authorization: EventAuthorization): ValidationResult[] {
  if (event.kind === "REMINDER") return [];
  const refs = { serviceAuthId: authorization.id, date: event.date, month: event.date.slice(0, 7) };
  if (event.date < authorization.start || event.date > authorization.end) {
    return [{
      ruleId: "EVT-01", severity: "BLOCK", refs,
      message: `${event.date} is outside the authorization, ${authorization.start} to ${authorization.end}`,
    }];
  }
  if (!authorization.months.some((entry) => entry.month === refs.month)) {
    return [{ ruleId: "EVT-01", severity: "BLOCK", refs, message: `Nothing is authorized for ${refs.month}` }];
  }
  return [];
}

/**
 * Billable events never exceed the quantity Fusion authorized for the month, counted in the
 * service's own unit; Fusion's count controls. A quantity is a whole number above zero, and a
 * structured family caregiver day is one day, covered once.
 * @rule EVT-02
 * @source Fusion's authorized quantity for the month; 3.00 Appendix 1 (rev. Jul 2026) units and limits
 */
export function ruleEVT02EventQuantity(
  event: PlanEvent,
  authorization: EventAuthorization,
  events: readonly PlanEvent[],
): ValidationResult[] {
  if (event.kind === "REMINDER") return [];
  const month = event.date.slice(0, 7);
  const refs = { serviceAuthId: authorization.id, date: event.date, month };
  const block = (message: string): ValidationResult[] => [{ ruleId: "EVT-02", severity: "BLOCK", refs, message }];
  if (event.kind === "SFC_DAY" && event.quantity !== 1) {
    return block(`A structured family caregiver day is one day, never ${event.quantity}`);
  }
  if (!Number.isInteger(event.quantity) || event.quantity <= 0) return block("Enter a whole number above zero");
  const others = events.filter((other) => other.id !== event.id);
  if (event.kind === "SFC_DAY" && others.some((other) => other.kind === "SFC_DAY" && other.authorizationId === authorization.id && other.date === event.date)) {
    return block(`${event.date} is already a covered day`);
  }
  const authorized = authorization.months.find((entry) => entry.month === month)?.quantity;
  if (authorized === undefined) return [];
  const total = placedInMonth(authorization.id, others, month) + event.quantity;
  if (total <= authorized) return [];
  const [one, many] = UNIT_WORDS[authorization.unit];
  return block(`${total} ${total === 1 ? one : many} would be placed in ${month}; ${authorized} ${authorized === 1 ? "is" : "are"} authorized`);
}

/**
 * An authorization of class CONTEXT never produces a caregiver shift or a billable event: only a
 * reminder may be placed on it. On any authorization, a reminder is never billable and has no
 * quantity.
 * @rule EVT-03
 * @source 3.00 Appendix 1 (rev. Jul 2026); Missouri coverage audit section 10, decision 2, and PR #10 (Oct 31, 2026)
 */
export function ruleEVT03ContextEvents(event: PlanEvent, authorization: EventAuthorization): ValidationResult[] {
  const refs = { serviceAuthId: authorization.id, date: event.date, month: event.date.slice(0, 7) };
  if (event.kind === "REMINDER") {
    if (!event.billable && event.quantity === 0) return [];
    return [{ ruleId: "EVT-03", severity: "BLOCK", refs, message: "A reminder is never billable and has no quantity" }];
  }
  if (authorization.scheduleClass !== "CONTEXT") return [];
  return [{
    ruleId: "EVT-03", severity: "BLOCK", refs,
    message: "This authorization has no caregiver time: only a reminder can be placed on it",
  }];
}
