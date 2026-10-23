import type { Weekday } from "@careplan/engine";

const WEEKDAY_NAMES: Readonly<Record<Weekday, string>> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export function weekdayName(weekday: Weekday): string {
  return WEEKDAY_NAMES[weekday];
}

/** "2025-10" -> "October 2025", in the user's locale-independent month names. */
export function formatMonth(month: string): string {
  const parts = month.split("-");
  const year = Number(parts[0]);
  const monthNumber = Number(parts[1]);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "2026-07-01" -> "July 1, 2026". */
export function formatDate(date: string): string {
  const parts = date.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const value = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "2026-10" -> "October 2026" (locale-independent, as used by the Quick Schedule copy). */
export function monthName(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${MONTH_NAMES[(monthNumber ?? 1) - 1]} ${year}`;
}

/** "2026-10" -> "Oct 2026". */
export function shortMonth(month: string): string {
  const monthNumber = Number(month.slice(5));
  return `${MONTH_NAMES[monthNumber - 1]!.slice(0, 3)} ${month.slice(0, 4)}`;
}

/** "2025-12-31" -> "Dec 31, 2025". */
export function niceDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]!.slice(0, 3)} ${day}, ${year}`;
}

/** Whole 15-minute units plus leftover minutes: "2 units", "2 units + 5 min". */
export function formatUnits(minutes: number): string {
  const units = Math.floor(minutes / 15);
  const remainder = minutes % 15;
  return `${units} unit${units === 1 ? "" : "s"}${remainder ? ` + ${remainder} min` : ""}`;
}

