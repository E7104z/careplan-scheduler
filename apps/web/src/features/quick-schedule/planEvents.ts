import {
  addDays,
  daysInMonth,
  placeEvent,
  removeEvent,
  ruleNUR02UnplacedVisits,
  type EventAuthorization,
  type EventUnit,
  type PlanEvent,
  type PlanEventKind,
  type RulePack,
  type ValidationResult,
} from "@careplan/engine";
import { monthName, niceDate } from "../../lib/format";
import { newId } from "./ids.js";
import { otherService } from "./others.js";
import type { CarePlan, PlanOther, PlanVisit } from "./types.js";

/** The reminder a placed general health evaluation gets (CP3-2). Never a visit. */
export const UPLOAD_REMINDER_NOTE = "Upload the evaluation (HCBS 08-26-01)";

/** A plan's dated events; plans saved before Coverage Phase 3 have none. */
export function planEvents(plan: CarePlan): readonly PlanEvent[] {
  return plan.events ?? [];
}

/** A general health evaluation: at a regular nurse visit it is the same visit (audit section 7, Phase 3). */
export function isEvaluation(visit: PlanVisit): boolean {
  return visit.label === "GHE" || /general health evaluation/i.test(visit.name);
}

/** "2026-11" from "2026-11-01" to "2027-01-31": every month the dates touch. */
function monthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  let [year, month] = [Number(start.slice(0, 4)), Number(start.slice(5, 7))];
  const last = end.slice(0, 7);
  for (let guard = 0; guard < 240; guard++) {
    const current = `${year}-${String(month).padStart(2, "0")}`;
    if (current > last) break;
    months.push(current);
    month += 1;
    if (month > 12) [year, month] = [year + 1, 1];
  }
  return months;
}

/** A nurse visit authorization as the engine places events against it: visits, in its own month. */
export function visitAuthorization(visit: PlanVisit): EventAuthorization | null {
  if (visit.id === undefined) return null;
  return {
    id: visit.id, scheduleClass: "APPOINTMENT", unit: "visit", start: visit.start, end: visit.end,
    months: monthsBetween(visit.start, visit.end).map((month) => ({ month, quantity: visit.units })),
  };
}

const UNIT_OF: Record<string, EventUnit> = { visit: "visit", meal: "meal", day: "day" };

/**
 * A kept authorization as the engine places events against it, in its own unit: meals, covered
 * days, visits, adult day care minutes (Fusion's 15-minute units, as minutes), and nothing for a
 * context authorization. Null for one outside Appendix 1 or without its dates: nothing is placed
 * on what the care plan didn't make clear.
 */
export function otherAuthorization(other: PlanOther): EventAuthorization | null {
  const service = otherService(other);
  if (!service || other.id === undefined || other.start === null || other.end === null) return null;
  const attendance = service.mode === "ATTENDANCE";
  const unit: EventUnit = service.scheduleClass === "CONTEXT" ? "none" : attendance ? "minute" : (UNIT_OF[service.unit] ?? "none");
  return {
    id: other.id, scheduleClass: service.scheduleClass, unit, start: other.start, end: other.end,
    months: other.monthly.map((month) => ({ month: month.start.slice(0, 7), quantity: attendance ? month.units * 15 : month.units })),
  };
}

/** Every authorization of the plan that dated events can be placed against. */
export function eventAuthorizations(plan: CarePlan): EventAuthorization[] {
  return [
    ...plan.visits.map(visitAuthorization),
    ...(plan.others ?? []).map(otherAuthorization),
  ].filter((authorization): authorization is EventAuthorization => authorization !== null);
}

function unitWord(unit: EventUnit, count: number): string {
  const words: Record<EventUnit, [string, string]> = {
    visit: ["visit", "visits"], meal: ["meal", "meals"], day: ["covered day", "covered days"],
    minute: ["minute", "minutes"], none: ["event", "events"],
  };
  return words[unit][count === 1 ? 0 : 1];
}

/** The sentence shown when a placement is refused: what the limit is and how to go on (APP-SPEC 4.3). */
export function eventRefusalText(results: ValidationResult[], authorization: EventAuthorization, event: PlanEvent): string {
  const first = results[0];
  const month = event.date.slice(0, 7);
  if (!first) return "Not placed.";
  if (first.ruleId === "EVT-01") {
    const oneMonth = authorization.start.slice(0, 7) === authorization.end.slice(0, 7);
    return oneMonth
      ? `Not placed. ${niceDate(event.date)} is outside ${monthName(authorization.start.slice(0, 7))}, the month this is authorized for. Pick a date in that month.`
      : `Not placed. ${niceDate(event.date)} is outside what the care plan authorizes (${niceDate(authorization.start)} to ${niceDate(authorization.end)}, in the months it lists). Pick a date inside it.`;
  }
  if (first.ruleId === "EVT-02") {
    if (event.kind === "SFC_DAY") return `Not placed. ${niceDate(event.date)} is already a covered day.`;
    const authorized = authorization.months.find((entry) => entry.month === month)?.quantity ?? 0;
    return `Not placed. The care plan authorizes ${authorized} ${unitWord(authorization.unit, authorized)} in ${monthName(month)}, and this would go over. Remove a date first, or enter less.`;
  }
  if (first.ruleId === "EVT-03") return "Not placed. This authorization has no caregiver time, so only a reminder can go on it.";
  if (first.ruleId === "CON-10") {
    return /within 6 months/.test(first.message)
      ? "Not placed. That would be more than 26 nurse visits in six months. Remove a visit first."
      : `Not placed. ${niceDate(event.date)} already has a nurse visit, and a participant can have one a day. Pick another date.`;
  }
  if (first.ruleId === "WS-R09") return `Not placed. Home delivered meals are limited to 2 a day. Enter 2 or fewer for ${niceDate(event.date)}.`;
  return `Not placed. ${first.message}`;
}

/** What an event action asks for. `id` names an event already placed, to move or change it. */
export interface EventRequest {
  id?: string;
  authorizationId: string;
  kind: PlanEventKind;
  date: string;
  quantity?: number;
  transportMinutes?: number;
  note?: string;
}

export interface EventChange {
  plan: CarePlan;
  refusal?: string;
}

function uploadReminder(visitEvent: PlanEvent): PlanEvent {
  const [year, month] = [Number(visitEvent.date.slice(0, 4)), Number(visitEvent.date.slice(5, 7))];
  const lastOfMonth = `${visitEvent.date.slice(0, 8)}${String(daysInMonth(year, month)).padStart(2, "0")}`;
  return {
    id: `${visitEvent.id}:upload`, authorizationId: visitEvent.authorizationId, kind: "REMINDER",
    date: addDays(lastOfMonth, 15), quantity: 0, billable: false, note: UPLOAD_REMINDER_NOTE,
  };
}

/**
 * Place a dated event on the plan through the engine's guard (APP-SPEC 5.7, rule 19a): accepted,
 * or refused with the limit shown and the plan unchanged. The app never places an event by
 * itself, with one exception that is not a visit: a placed general health evaluation gets its
 * upload reminder on the 15th of the next month, and loses it when the visit goes.
 */
export function applyEvent(plan: CarePlan, request: EventRequest, pack: RulePack): EventChange {
  const authorization = eventAuthorizations(plan).find((candidate) => candidate.id === request.authorizationId);
  if (!authorization) return { plan, refusal: "Not placed. That authorization isn't in this care plan." };
  const visit = plan.visits.find((candidate) => candidate.id === authorization.id);
  const reminder = request.kind === "REMINDER";
  const event: PlanEvent = {
    id: request.id ?? newId(), authorizationId: authorization.id, kind: request.kind, date: request.date,
    quantity: reminder ? 0 : (request.quantity ?? 1), billable: !reminder,
    ...(request.transportMinutes !== undefined ? { transportMinutes: request.transportMinutes } : {}),
    ...(request.note ? { note: request.note } : {}),
    ...(visit && isEvaluation(visit) && !reminder ? { evaluation: true } : {}),
  };
  const outcome = placeEvent({ pack, event, authorization, events: planEvents(plan) });
  if (!outcome.accepted) return { plan, refusal: eventRefusalText(outcome.results, authorization, event) };
  let events = [...outcome.events];
  if (event.evaluation) {
    const upload = uploadReminder(event);
    events = [...events.filter((other) => other.id !== upload.id), upload];
  }
  return { plan: { ...plan, events } };
}

/** Take an event off the plan, with the upload reminder that belonged to it. Never refused. */
export function dropEvent(plan: CarePlan, eventId: string): CarePlan {
  const events = removeEvent(removeEvent(planEvents(plan), eventId), `${eventId}:upload`);
  return { ...plan, events: [...events] };
}

/** An authorization's events, in date order. */
export function eventsOf(plan: CarePlan, authorizationId: string): PlanEvent[] {
  return planEvents(plan)
    .filter((event) => event.authorizationId === authorizationId)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Plan-level findings about dated events: a passed visit month with no date placed (NUR-02). */
export function planEventResults(plan: CarePlan, currentMonth: string): ValidationResult[] {
  return ruleNUR02UnplacedVisits(eventAuthorizations(plan), planEvents(plan), currentMonth);
}

/** Whether another nurse visit that isn't an evaluation shares this evaluation's date: one visit that day. */
export function sharesVisit(plan: CarePlan, event: PlanEvent): boolean {
  return (
    event.kind === "NURSE_VISIT" &&
    event.evaluation === true &&
    planEvents(plan).some((other) => other.kind === "NURSE_VISIT" && !other.evaluation && other.date === event.date)
  );
}
