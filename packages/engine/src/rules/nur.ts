import type { EventAuthorization, PlanEvent } from "../events/types.js";
import type { ValidationResult } from "../types.js";
import { placedInMonth } from "./evt.js";

/**
 * Missed-visit follow-up: an authorized nurse visit month that has passed with no date placed.
 * It says only that no date was placed; the app schedules and does not record delivery.
 * `currentMonth` is the month on the person's calendar (YYYY-MM); earlier months have passed.
 * @rule NUR-02
 * @source Missouri coverage audit RN-04 (missed general health evaluation follow-up); the follow-up wording is a product decision, Nov 13, 2026
 */
export function ruleNUR02UnplacedVisits(
  authorizations: readonly EventAuthorization[],
  events: readonly PlanEvent[],
  currentMonth: string,
): ValidationResult[] {
  return authorizations
    .filter((authorization) => authorization.unit === "visit")
    .flatMap((authorization) =>
      authorization.months
        .filter((entry) => entry.month < currentMonth && entry.quantity > 0 && placedInMonth(authorization.id, events, entry.month) === 0)
        .map((entry): ValidationResult => ({
          ruleId: "NUR-02",
          severity: "WARN",
          message: "No date was placed for this month's visit.",
          refs: { serviceAuthId: authorization.id, month: entry.month },
        })),
    );
}
