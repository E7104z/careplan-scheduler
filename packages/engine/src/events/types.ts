import type { ScheduleClass } from "../rulepacks/appendix1.js";

/** What a dated event is. A reminder is a note on a date: never a visit, never billable. */
export type PlanEventKind = "NURSE_VISIT" | "ADC_DAY" | "MEAL_DELIVERY" | "SFC_DAY" | "REMINDER";

/** The unit an authorization is counted in. Never converted to 15-minute units. */
export type EventUnit = "visit" | "meal" | "day" | "minute" | "none";

/**
 * A dated event on the participant's calendar (Coverage Phase 3): a nurse visit, an adult day
 * care day, a meal delivery, a structured family caregiver covered day, or a reminder. It carries
 * no name and no DCN.
 */
export interface PlanEvent {
  id: string;
  /** The authorization it is placed against (its global id, JOIN-03). */
  authorizationId: string;
  kind: PlanEventKind;
  date: string;                 // YYYY-MM-DD
  start?: string;               // local "YYYY-MM-DDTHH:mm", America/Chicago
  end?: string;
  /** Visits 1, meals a count, adult day care minutes, a covered day 1, a reminder 0. */
  quantity: number;
  /** Adult day care only: the transportation part of the day, in minutes. */
  transportMinutes?: number;
  /** Nurse visits only: a general health evaluation, which shares a date with a regular visit as one visit. */
  evaluation?: boolean;
  /** The person's own text. Never required. */
  note?: string;
  /** False for every reminder, true for the rest. */
  billable: boolean;
}

/** What placing an event needs to know about its authorization: its dates and what Fusion authorized. */
export interface EventAuthorization {
  id: string;
  /** The Appendix 1 class; null for a service outside Appendix 1. */
  scheduleClass: ScheduleClass | null;
  unit: EventUnit;
  start: string;                // YYYY-MM-DD
  end: string;
  /** Fusion's authorized quantity for each month, in the service's own unit. */
  months: { month: string; quantity: number }[];
}

/** An authorization's month: authorized, placed and left, in its own unit. Null where Fusion gave no figure. */
export interface EventBalance {
  unit: EventUnit;
  authorized: number | null;
  placed: number;
  left: number | null;
}
