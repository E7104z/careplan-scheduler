import { daysInMonth as daysInMonthFrom } from "./dates.js";
import { factorFor, type DaysPerWeek } from "./factors.js";
import type { MonthlyAuthorization, ServiceAuthorization } from "../types.js";

export type DerivedMethod = "hcbs3c-roundup" | "workbook-trunc099" | "short-month";

export interface DerivedUnits {
  units: number;
  source: "derived";
  method: DerivedMethod;
}

export { daysInMonthFrom as daysInMonth };

function requireIntegerMinutes(name: string, minutes: number): void {
  if (!Number.isInteger(minutes)) {
    throw new RangeError(`${name} must be an integer number of minutes, got ${minutes}`);
  }
}

/** F-2a: HCBS-3c task units. Integer math, ceil. */
export function hcbs3cTaskUnits(minPerDay: number, dpw: DaysPerWeek): DerivedUnits {
  requireIntegerMinutes("minPerDay", minPerDay);
  const num = minPerDay * factorFor(dpw);
  const units = Math.floor((num + 14) / 15);
  return { units, source: "derived", method: "hcbs3c-roundup" };
}

/** F-2a from weekly minutes: ceil(weeklyMinutes / timesPerWeek / 15 * factor), dividing once. */
export function hcbs3cTaskUnitsFromWeekly(weeklyMinutes: number, timesPerWeek: number): DerivedUnits {
  requireIntegerMinutes("weeklyMinutes", weeklyMinutes);
  const num = weeklyMinutes * factorFor(timesPerWeek as DaysPerWeek);
  const den = timesPerWeek * 15;
  const units = Math.floor((num + den - 1) / den);
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

/** Whole transport units in a month (F-4); 0 when the authorization has no transport. */
export function monthTransportUnits(auth: ServiceAuthorization): number {
  return Math.floor((auth.transportMinutesPerMonth ?? 0) / 15);
}

/** Derived service month units: Σ F-3 task units + transport units (AUTH-04). */
export function derivedServiceMonthUnits(auth: ServiceAuthorization, year: number, month: number): number {
  const days = daysInMonthFrom(year, month);
  let units = monthTransportUnits(auth);
  for (const task of auth.tasks) {
    units += monthTaskUnits(task.minPerDay * task.daysPerWeek, task.daysPerWeek, days).units;
  }
  return units;
}

/**
 * AUTH-09's combined monthly figure: the units Basic (S5150) and Advanced (S5150TF) Respite are
 * authorized for in one month, summed across authorizations. Respite is a combined group (Policy
 * 3.50): the 868-unit ceiling applies to the two services together, never to one service alone.
 */
export function combinedRespiteUnits(
  authorizations: ServiceAuthorization[],
  monthlyAuthorizations: MonthlyAuthorization[],
  month: string,
): number {
  const authById = new Map(authorizations.map((auth) => [auth.id, auth]));
  let total = 0;
  for (const ma of monthlyAuthorizations) {
    if (ma.month !== month) continue;
    if (authById.get(ma.serviceAuthId)?.program === "RESPITE") total += ma.units;
  }
  return total;
}
