import { expandChainMonth, weekdayOf, type CalendarException, type PlanEventKind, type RulePack } from "@careplan/engine";
import { serviceChain, type ServiceVersion } from "./amendments.js";
import { serviceName } from "./carePlan.js";
import { eventWhat } from "./eventText.js";
import { otherName } from "./others.js";
import { planEvents } from "./planEvents.js";
import type { CarePlan, QuickModel } from "./types.js";

export type OccurrenceKind = "TASK" | "TRANSPORT" | PlanEventKind;

/** One thing on one date of the participant's calendar. */
export interface PlanOccurrence {
  date: string;
  /** The authorization it belongs to (its global id). Two authorizations are never merged. */
  authorizationId: string;
  /** "PC - Agency", "GHE", "HDM": the service as the plan names it. */
  service: string;
  kind: OccurrenceKind;
  /** The task's name, "Essential transportation", "Nurse visit", "2 meals", "Reminder, not a visit". */
  what: string;
  /** Scheduled or attended minutes: tasks, transportation and adult day care. Null otherwise. */
  minutes: number | null;
  /** An event's quantity in its own unit; null for tasks and transportation. */
  quantity: number | null;
  /** "min", "meals", "visit", "covered day", or "" for a reminder. */
  unit: string;
  /** The care plan change in effect on this date; null for the plan as imported, and for events. */
  amendmentId: string | null;
  /** The task, for a task occurrence, so one day's change can name it. */
  taskId?: string;
  /** The person's note on an event. */
  note?: string;
}

const EVENT_UNIT: Record<PlanEventKind, [one: string, many: string]> = {
  NURSE_VISIT: ["visit", "visits"],
  ADC_DAY: ["min", "min"],
  MEAL_DELIVERY: ["meal", "meals"],
  SFC_DAY: ["covered day", "covered days"],
  REMINDER: ["", ""],
};

/** A version's own exceptions: its trims and one-day changes, on its own dates only. */
function versionExceptions(versions: ServiceVersion[], index: number): CalendarException[] {
  const version = versions[index]!;
  const nextFrom = versions[index + 1]?.effectiveFrom;
  return [...version.model.trims, ...version.model.dayExceptions].filter(
    (exception) => exception.date >= version.effectiveFrom && (nextFrom === undefined || exception.date < nextFrom),
  );
}

/** The version in effect on a date: the last one that has taken effect. */
function versionOnDate(versions: ServiceVersion[], date: string): ServiceVersion {
  return [...versions].reverse().find((version) => version.effectiveFrom <= date) ?? versions[0]!;
}

/**
 * One list of every occurrence in the plan (CP3-7): the weekly pattern of each service expanded to
 * real dates (the engine's expansion, with the trims, one-day changes and recorded care plan
 * changes applied, each occurrence on the version in effect that day), transportation on its day,
 * and every dated event. Sorted by date, then by the plan's order. **This list is the only source
 * the calendar, the list view and the whole-plan PDF read from.** `onlyMonths` limits it to those
 * months (the screen shows one month at a time); without it, the whole plan.
 */
export function normalizeEvents(
  plan: CarePlan,
  models: QuickModel[],
  pack: RulePack,
  onlyMonths?: readonly string[],
): PlanOccurrence[] {
  const wanted = (month: string) => onlyMonths === undefined || onlyMonths.includes(month);
  const occurrences: { order: number; occurrence: PlanOccurrence }[] = [];

  plan.services.forEach((state, index) => {
    const model = models[index]!;
    const { chain, versions } = serviceChain(state, model, pack);
    const exceptions = versions.flatMap((_, at) => versionExceptions(versions, at));
    const name = serviceName(state, model);
    for (const month of model.months.filter(wanted)) {
      const [year, monthNumber] = month.split("-").map(Number) as [number, number];
      for (const occurrence of expandChainMonth(chain, exceptions, year, monthNumber)) {
        const version = versionOnDate(versions, occurrence.date);
        const task = version.model.tasks.find((candidate) => candidate.id === occurrence.taskId);
        occurrences.push({
          order: index,
          occurrence: {
            date: occurrence.date, authorizationId: state.id, service: name, kind: "TASK",
            what: task?.name ?? occurrence.taskId, minutes: occurrence.minutes, quantity: null, unit: "min",
            amendmentId: occurrence.amendmentId, taskId: occurrence.taskId,
          },
        });
      }
      // Transportation: its weekly time on its day, from the version in effect that date.
      const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
      for (let day = 1; day <= days; day++) {
        const date = `${month}-${String(day).padStart(2, "0")}`;
        if (date < model.auth.start || date > model.auth.end) continue;
        const version = versionOnDate(versions, date);
        const weekly = version.model.allowance?.weeklyMinutes ?? 0;
        if (weekly > 0 && weekdayOf(year, monthNumber, day) === version.state.transport.day) {
          occurrences.push({
            order: index,
            occurrence: {
              date, authorizationId: state.id, service: name, kind: "TRANSPORT", what: "Essential transportation",
              minutes: weekly, quantity: null, unit: "min", amendmentId: version.amendment?.id ?? null,
            },
          });
        }
      }
    }
  });

  const authorizations = [
    ...plan.visits.map((visit) => ({ id: visit.id, name: visit.label ?? visit.name })),
    ...(plan.others ?? []).map((other) => ({ id: other.id, name: otherName(other) })),
  ];
  for (const event of planEvents(plan)) {
    if (!wanted(event.date.slice(0, 7))) continue;
    const at = authorizations.findIndex((authorization) => authorization.id === event.authorizationId);
    if (at < 0) continue;
    const [one, many] = EVENT_UNIT[event.kind];
    const reminder = event.kind === "REMINDER";
    occurrences.push({
      order: plan.services.length + at,
      occurrence: {
        date: event.date, authorizationId: event.authorizationId, service: authorizations[at]!.name, kind: event.kind,
        what: eventWhat(event), minutes: event.kind === "ADC_DAY" ? event.quantity : null,
        quantity: reminder ? null : event.quantity, unit: event.quantity === 1 ? one : many, amendmentId: null,
        ...(event.note ? { note: event.note } : {}),
      },
    });
  }

  return occurrences
    .sort((a, b) => (a.occurrence.date === b.occurrence.date ? a.order - b.order : a.occurrence.date < b.occurrence.date ? -1 : 1))
    .map((entry) => entry.occurrence);
}

/** The occurrences of one month. */
export function occurrencesIn(occurrences: readonly PlanOccurrence[], month: string): PlanOccurrence[] {
  return occurrences.filter((occurrence) => occurrence.date.startsWith(month));
}

/** "30 min", "2 meals", "1 visit", "" for a reminder: how much, in the occurrence's own unit. */
export function occurrenceAmount(occurrence: PlanOccurrence): string {
  if (occurrence.kind === "REMINDER") return "";
  if (occurrence.minutes !== null) return `${occurrence.minutes} min`;
  return `${occurrence.quantity ?? 0} ${occurrence.unit}`;
}
