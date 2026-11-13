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

/** Today on the person's own calendar, as "YYYY-MM-DD" (not `toISOString()`, which is UTC). */
export function todayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

/** "2025-12-31" -> "Dec 31, 2025". */
export function niceDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]!.slice(0, 3)} ${day}, ${year}`;
}

/** Epoch milliseconds -> "Nov 3, 2026" (locale-independent). */
export function niceDateFromMillis(millis: number): string {
  const date = new Date(millis);
  return `${MONTH_NAMES[date.getMonth()]!.slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Whole 15-minute units plus leftover minutes: "2 units", "2 units + 5 min", or "5 min" under one unit. */
export function formatUnits(minutes: number): string {
  const units = Math.floor(minutes / 15);
  const remainder = minutes % 15;
  if (units === 0 && remainder > 0) return `${remainder} min`;
  return `${units} unit${units === 1 ? "" : "s"}${remainder ? ` + ${remainder} min` : ""}`;
}

/** "09:00" -> "9:00 AM", "13:30" -> "1:30 PM" (locale-independent). */
export function clockTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const hour = ((hours ?? 0) + 11) % 12 + 1;
  return `${hour}:${String(minutes ?? 0).padStart(2, "0")} ${(hours ?? 0) < 12 ? "AM" : "PM"}`;
}

/** A visit's length: "45 min", "1 h", "5 h 15 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
