import { daysInMonth as daysInMonthFrom } from "./dates.js";
import { factorFor, type DaysPerWeek } from "./factors.js";

export type DerivedMethod = "hcbs3c-roundup" | "workbook-trunc099" | "short-month";

export interface DerivedUnits {
  units: number;
  source: "derived";
  method: DerivedMethod;
}

export { daysInMonthFrom as daysInMonth };

/** F-2a: HCBS-3c task units. Integer math, ceil. */
export function hcbs3cTaskUnits(minPerDay: number, dpw: DaysPerWeek): DerivedUnits {
  const units = Math.ceil((minPerDay / 15) * factorFor(dpw));
  return { units, source: "derived", method: "hcbs3c-roundup" };
}

/** F-2b: workbook task units using the integer floating-point guard. */
export function workbookTaskUnits(weeklyMinutes: number, timesPerWeek: number): DerivedUnits {
  const num = weeklyMinutes * factorFor(timesPerWeek as DaysPerWeek);
  const den = timesPerWeek * 15;
  const units = Math.trunc((num + 0.99 * den) / den);
  return { units, source: "derived", method: "workbook-trunc099" };
}

/** F-3: monthly task units. 7-day tasks are prorated by days in month; others use F-2b. */
export function monthTaskUnits(
  weeklyMinutes: number,
  timesPerWeek: number,
  daysInMonthValue: number,
): DerivedUnits {
  if (timesPerWeek === 7) {
    const num = weeklyMinutes * daysInMonthValue;
    const den = 7 * 15;
    const units = Math.trunc((num + 0.99 * den) / den);
    return { units, source: "derived", method: "short-month" };
  }
  return workbookTaskUnits(weeklyMinutes, timesPerWeek);
}
