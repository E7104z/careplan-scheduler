import { amendmentEffectiveDate, daysInMonth, weekdayOf, type Weekday } from "@careplan/engine";
import { niceDate, weekdayName } from "../../lib/format";
import { amendmentsOf, DIRECTION_LABELS } from "./amendments.js";
import { serviceName } from "./carePlan.js";
import { occurrenceAmount, occurrencesIn, type PlanOccurrence } from "./normalizeEvents.js";
import type { CarePlan, QuickModel } from "./types.js";

/** One line inside a calendar cell, or one row of the list: the same thing, read from one occurrence list. */
export interface CalendarItem {
  date: string;
  service: string;
  /** The task or event: "Bathing", "Nurse visit", "2 meals". */
  what: string;
  /** "30 min", "2 meals", "" for a reminder. */
  amount: string;
  /** A short text mark so kinds differ without color: "" for care, then "Visit", "Day care", "Meals", "Day", "Reminder". */
  mark: string;
  kind: PlanOccurrence["kind"];
}

const MARKS: Record<PlanOccurrence["kind"], string> = {
  TASK: "", TRANSPORT: "", NURSE_VISIT: "Visit", ADC_DAY: "Day care", MEAL_DELIVERY: "Meals", SFC_DAY: "Day", REMINDER: "Reminder",
};

function toItem(occurrence: PlanOccurrence): CalendarItem {
  const what = occurrence.note && occurrence.kind === "REMINDER" ? `${occurrence.what}: ${occurrence.note}` : occurrence.what;
  return {
    date: occurrence.date, service: occurrence.service, what, amount: occurrenceAmount(occurrence),
    mark: MARKS[occurrence.kind], kind: occurrence.kind,
  };
}

/**
 * Occurrences as the calendar shows them: a service's tasks on a date are one item (their names,
 * and their minutes added up), because a day of fifteen tasks is one visit to read, not fifteen
 * rows. Transportation and every event stay their own item. Order is the occurrence list's.
 */
export function itemsOf(occurrences: readonly PlanOccurrence[]): CalendarItem[] {
  const items: CalendarItem[] = [];
  const taskItems = new Map<string, { item: CalendarItem; names: string[]; minutes: number }>();
  for (const occurrence of occurrences) {
    if (occurrence.kind !== "TASK") {
      items.push(toItem(occurrence));
      continue;
    }
    const key = `${occurrence.date}|${occurrence.authorizationId}`;
    let entry = taskItems.get(key);
    if (!entry) {
      entry = { item: { date: occurrence.date, service: occurrence.service, what: "", amount: "", mark: "", kind: "TASK" }, names: [], minutes: 0 };
      taskItems.set(key, entry);
      items.push(entry.item);
    }
    entry.names.push(occurrence.what);
    entry.minutes += occurrence.minutes ?? 0;
    entry.item.what = entry.names.join(", ");
    entry.item.amount = `${entry.minutes} min`;
  }
  return items;
}

/** The list view's rows for a month: the same items the grid's cells hold, in date order. */
export function listRows(occurrences: readonly PlanOccurrence[], month: string): CalendarItem[] {
  return itemsOf(occurrencesIn(occurrences, month));
}

/** A service's minutes on a date, as one labeled band of the cell. */
export interface CellBand {
  service: string;
  minutes: number;
}

export interface CalendarCell {
  date: string;
  day: number;
  weekday: Weekday;
  /** Inside the plan's dates. */
  inPlan: boolean;
  /** Every item on the date: the same items the list shows. */
  items: CalendarItem[];
  /** Scheduled minutes by service (tasks and transportation), in the plan's order. */
  bands: CellBand[];
  /** The events on the date (not tasks): visits, day care, meals, covered days, reminders. */
  events: CalendarItem[];
  /** "Decrease takes effect": a care plan change's effective date. */
  markers: string[];
  /** The whole cell in words, for its accessible name. */
  label: string;
}

/** The dates on which a recorded care plan change takes effect, with what it is. */
export function amendmentMarkers(plan: CarePlan, models: QuickModel[]): Record<string, string[]> {
  const markers: Record<string, string[]> = {};
  plan.services.forEach((state, index) => {
    for (const amendment of amendmentsOf(state)) {
      const date = amendmentEffectiveDate(amendment.direction, amendment.date);
      (markers[date] ??= []).push(`${DIRECTION_LABELS[amendment.direction]} takes effect: ${serviceName(state, models[index]!)}`);
    }
  });
  return markers;
}

/**
 * The month as calendar cells, one per date, each holding exactly the occurrences of that date:
 * the grid and the list are two views of one list.
 */
export function calendarCells(
  occurrences: readonly PlanOccurrence[],
  month: string,
  plan: { start: string; end: string },
  markers: Record<string, string[]> = {},
): CalendarCell[] {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const inMonth = occurrencesIn(occurrences, month);
  return Array.from({ length: daysInMonth(year, monthNumber) }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const weekday = weekdayOf(year, monthNumber, day) as Weekday;
    const onDate = inMonth.filter((occurrence) => occurrence.date === date);
    const items = itemsOf(onDate);
    const bands: CellBand[] = [];
    for (const occurrence of onDate) {
      if (occurrence.kind !== "TASK" && occurrence.kind !== "TRANSPORT") continue;
      const band = bands.find((candidate) => candidate.service === occurrence.service);
      if (band) band.minutes += occurrence.minutes ?? 0;
      else bands.push({ service: occurrence.service, minutes: occurrence.minutes ?? 0 });
    }
    const events = items.filter((item) => item.kind !== "TASK" && item.kind !== "TRANSPORT");
    const inPlan = date >= plan.start && date <= plan.end;
    const dayMarkers = markers[date] ?? [];
    const parts = [
      ...bands.map((band) => `${band.service} ${band.minutes} minutes`),
      ...events.map((event) => [event.service, event.what, event.amount].filter(Boolean).join(", ")),
      ...dayMarkers,
    ];
    const contents = !inPlan ? "outside the plan" : parts.length > 0 ? parts.join("; ") : "no care";
    return {
      date, day, weekday, inPlan, items, bands, events, markers: dayMarkers,
      label: `${weekdayName(weekday)}, ${niceDate(date)}: ${contents}`,
    };
  });
}

/** Where an arrow, Home or End key moves the focus in the month grid; the same date when it would leave the month. */
export function moveDate(date: string, key: string): string {
  const [year, monthNumber, day] = date.split("-").map(Number) as [number, number, number];
  const days = daysInMonth(year, monthNumber);
  const weekday = weekdayOf(year, monthNumber, day);
  const steps: Record<string, number> = {
    ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday,
  };
  const step = steps[key];
  if (step === undefined) return date;
  const next = Math.min(days, Math.max(1, day + step));
  // Up and down stay in their column: at the month's edge the focus doesn't move.
  if ((key === "ArrowUp" || key === "ArrowDown") && next !== day + step) return date;
  return `${date.slice(0, 8)}${String(next).padStart(2, "0")}`;
}
