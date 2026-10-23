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
