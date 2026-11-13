import { eventBalance, type EventAuthorization, type EventUnit, type PlanEvent } from "@careplan/engine";
import { formatDuration, monthName, niceDate } from "../../lib/format";

const UNIT_WORDS: Record<EventUnit, [one: string, many: string]> = {
  visit: ["visit", "visits"],
  meal: ["meal", "meals"],
  day: ["covered day", "covered days"],
  minute: ["minute", "minutes"],
  none: ["event", "events"],
};

/** "2 meals", "1 covered day", "8 h" (adult day care stays time attended, never caregiver units). */
export function quantityText(unit: EventUnit, quantity: number): string {
  if (unit === "minute") return formatDuration(quantity);
  return `${quantity} ${UNIT_WORDS[unit][quantity === 1 ? 0 : 1]}`;
}

/** What a placed event is, in words: "Reminder, not a visit", "Nurse visit", "2 meals", "8 h · 60 min transportation". */
export function eventWhat(event: PlanEvent): string {
  switch (event.kind) {
    case "REMINDER":
      return "Reminder, not a visit";
    case "NURSE_VISIT":
      return "Nurse visit";
    case "SFC_DAY":
      return "Covered day";
    case "MEAL_DELIVERY":
      return quantityText("meal", event.quantity);
    case "ADC_DAY": {
      const transport = event.transportMinutes ?? 0;
      return transport > 0 ? `${formatDuration(event.quantity)} · ${transport} min transportation` : formatDuration(event.quantity);
    }
  }
}

/** One placed event as a line: "Nov 3, 2026 · 2 meals", with the person's note when there is one. */
export function eventLine(event: PlanEvent): string {
  return [niceDate(event.date), eventWhat(event), event.note].filter(Boolean).join(" · ");
}

/**
 * A month's balance in the service's own unit: "62 meals in November 2026, 10 placed, 52 left",
 * "2 covered days of 30 authorized in November 2026". Null when Fusion gave that month no figure.
 */
export function balanceText(authorization: EventAuthorization, events: readonly PlanEvent[], month: string): string | null {
  const balance = eventBalance(authorization, events, month);
  if (balance.authorized === null || balance.left === null || balance.unit === "none") return null;
  if (balance.unit === "day") {
    return `${quantityText("day", balance.placed)} of ${balance.authorized} authorized in ${monthName(month)}`;
  }
  return `${quantityText(balance.unit, balance.authorized)} in ${monthName(month)}, ${quantityText(balance.unit, balance.placed).replace(/ (meals?|visits?)$/, "")} placed, ${quantityText(balance.unit, balance.left).replace(/ (meals?|visits?)$/, "")} left`;
}

/** The months an authorization has something placed in, in order. */
export function placedMonths(authorizationId: string, events: readonly PlanEvent[]): string[] {
  return [
    ...new Set(
      events
        .filter((event) => event.authorizationId === authorizationId && event.billable)
        .map((event) => event.date.slice(0, 7)),
    ),
  ].sort();
}
