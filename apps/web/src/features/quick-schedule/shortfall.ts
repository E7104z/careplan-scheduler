import { monthBalance, monthFigures } from "./model.js";
import type { QuickModel } from "./types.js";

/**
 * How many months in a row the schedule must need more than its authorization before we prompt
 * the person to notify DSDS and request a review. This is our default, not a state rule.
 */
export const SHORTFALL_CONSECUTIVE_MONTHS = 2;

/** Months whose scheduled minutes exceed their authorized minutes. */
export function shortfallMonths(model: QuickModel): string[] {
  return model.months.filter((month) => monthBalance(monthFigures(model, month)).leftMinutes < 0);
}

/** True when a shortfall has run for at least {@link SHORTFALL_CONSECUTIVE_MONTHS} months in a row. */
export function recurringShortfall(model: QuickModel): boolean {
  const short = new Set(shortfallMonths(model));
  let run = 0;
  for (const month of model.months) {
    run = short.has(month) ? run + 1 : 0;
    if (run >= SHORTFALL_CONSECUTIVE_MONTHS) return true;
  }
  return false;
}
