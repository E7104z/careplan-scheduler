import { niceDate } from "../../lib/format";

// Agencies work in Central time (tenants.timeZone is always America/Chicago), so an instant
// such as an invite's expiry is shown as the Chicago calendar day.

const CHICAGO = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** An instant (epoch ms) as its America/Chicago date, "2026-11-03". */
export function chicagoDate(ms: number): string {
  const parts = CHICAGO.formatToParts(new Date(ms));
  const part = (type: "year" | "month" | "day") => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** An instant (epoch ms) as "Nov 3, 2026" in Central time (APP-SPEC 4.3). */
export function niceInstant(ms: number): string {
  return niceDate(chicagoDate(ms));
}
