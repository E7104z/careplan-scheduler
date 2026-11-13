import { ruleCON09WeeklyHours, splitByDate, type ValidationResult } from "@careplan/engine";
import type { CarePlan } from "./types.js";

const RESPITE = new Set(["S5150", "S5150TF"]);

/**
 * CON-09 on respite: the minutes of every Basic and Advanced Respite coverage block, combined, by
 * date (Policy 3.50: the span is the duration). ILW is checked on its weekly pattern instead
 * (validatePlan), so it isn't counted again here.
 */
export function respiteWeeklyHours(plan: CarePlan): ValidationResult[] {
  const daily: Record<string, number> = {};
  for (const state of plan.services) {
    if (!RESPITE.has(state.serviceCode)) continue;
    for (const block of state.coverage ?? []) {
      for (const [date, minutes] of Object.entries(splitByDate(block.start, block.end))) {
        daily[date] = (daily[date] ?? 0) + minutes;
      }
    }
  }
  return ruleCON09WeeklyHours(daily);
}
