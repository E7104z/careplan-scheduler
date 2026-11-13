import type { EventAuthorization, PlanEvent } from "../events/types.js";
import type { ServiceAuthorization, ValidationResult } from "../types.js";
import { placedInMonth } from "./evt.js";

/**
 * A new Advanced Personal Care authorization (T1019TF, by its code) in its first month: REVIEW,
 * never BLOCK or PASS. Appendix 3 expects two nurse visits in that month unless an ongoing nurse
 * visit covers it; DHSS has not confirmed the first-month count, so the engine only asks the
 * person to check. It creates no visit and reads none. `authorizedStarts` gives an
 * authorization's own first date when the schedule being checked starts later.
 * @rule NUR-01
 * @source HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care, as reviewed Oct 31, 2026; DHSS has not confirmed the first-month visit count
 */
export function ruleNUR01ApcFirstMonth(
  authorizations: readonly ServiceAuthorization[],
  months: readonly string[],
  authorizedStarts: Readonly<Record<string, string>> = {},
): ValidationResult[] {
  return authorizations
    .filter((authorization) => authorization.serviceCode === "T1019TF")
    .map((authorization) => ({ authorization, firstMonth: (authorizedStarts[authorization.id] ?? authorization.start).slice(0, 7) }))
    .filter(({ firstMonth }) => months.includes(firstMonth))
    .map(({ authorization, firstMonth }): ValidationResult => ({
      ruleId: "NUR-01",
      severity: "REVIEW",
      message:
        "A new Advanced Personal Care authorization is expected to have two nurse visits in its first month unless an ongoing nurse visit covers it. Check the care plan.",
      refs: { serviceAuthId: authorization.id, month: firstMonth },
    }));
}

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
