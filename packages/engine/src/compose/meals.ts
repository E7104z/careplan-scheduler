import type { HdmDelivery, ValidationResult } from "../types.js";

/** One calendar day of home delivered meals, summed across the day's deliveries. */
export interface HdmDay {
  date: string;
  meals: number;
}

/**
 * Sum dated home delivered meals into one entry per calendar day, in date order (ADW-04).
 * Meals stay meals; this never converts a meal to minutes or hours (IMP-T30).
 * @rule ADW-04
 * @source HCBS-3a (07/26) rate sheet cell G14: "Max 2/day"
 */
export function hdmDayTotals(deliveries: readonly HdmDelivery[]): HdmDay[] {
  const byDate = new Map<string, HdmDay>();
  for (const delivery of deliveries) {
    const day = byDate.get(delivery.date) ?? { date: delivery.date, meals: 0 };
    day.meals += delivery.meals;
    byDate.set(delivery.date, day);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Home delivered meals cap (ADW-04): at most `max` meals a day, reusing WS-R09's "Max 2/day".
 * Meals are counted as meals, never minutes or hours (IMP-T30 stays green).
 * @rule ADW-04
 * @source HCBS-3a (07/26) rate sheet cell G14: "Max 2/day"; 3.00 Home Delivered Meals (300-available-home-and-community-19)
 */
export function hdmMealChecks(deliveries: readonly HdmDelivery[], max: number): ValidationResult[] {
  return hdmDayTotals(deliveries)
    .filter((day) => day.meals > max)
    .map((day): ValidationResult => ({
      ruleId: "WS-R09",
      severity: "REVIEW",
      message: `More than ${max} meals a day. DSDS's rate sheet notes a maximum of ${max} a day.`,
      refs: { date: day.date },
    }));
}
