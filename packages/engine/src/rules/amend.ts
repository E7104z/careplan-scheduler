import type { AuthorizationChain, ValidationResult } from "../types.js";

/**
 * A schedule that spans a care plan amendment is under review: the amendment's direction and
 * effective date are stored as recorded, and nothing confirms that date yet. One REVIEW for each
 * amendment, on its effective date. A plan with no amendment emits nothing.
 * @rule AMEND-01
 * @source HCBS Manual 4.20 (care plan amendments: decreases effective the first of a later month, increases may take effect mid-month, participant-requested reductions immediate)
 */
export function ruleAMEND01EffectiveDates(chain: AuthorizationChain): ValidationResult[] {
  return chain.versions
    .filter((version) => version.amendmentId !== null)
    .map((version) => ({
      ruleId: "AMEND-01",
      severity: "REVIEW" as const,
      message: "amendment effective date needs confirmation, Manual 4.20",
      refs: { serviceAuthId: chain.serviceAuthId, date: version.effectiveFrom, month: version.effectiveFrom.slice(0, 7) },
    }));
}
