import { daysInMonth } from "@careplan/engine";

/** Source of a `m/d/yyyy` matcher with three capture groups (month, day, year). */
export const MDY = "(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})";

/** Month, day and year as read from Fusion text → `YYYY-MM-DD`. Not checked for a real date. */
export function ymd(month: string, day: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** True when an ISO `YYYY-MM-DD` string names a real calendar day. */
export function isRealDate(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}
