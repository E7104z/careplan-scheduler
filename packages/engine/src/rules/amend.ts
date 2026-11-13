import type { AuthorizationChain, ValidationResult } from "../types.js";

/**
 * A care plan amendment is under review until its effective date is confirmed from the care plan
 * (`dateConfirmed`): one REVIEW for each unconfirmed amendment, on its effective date. The
 * Manual 4.20 behaviors set where an amendment takes effect (amendments/apply.ts); they never
 * confirm the date. A plan with no amendment emits nothing.
 * @rule AMEND-01
 * @source HCBS Manual 4.20 (care plan amendments: decreases effective the first of a later month, increases may take effect mid-month, participant-requested reductions immediate)
 */
export function ruleAMEND01EffectiveDates(chain: AuthorizationChain): ValidationResult[] {
  return chain.versions
    .filter((version) => version.amendmentId !== null && version.dateConfirmed !== true)
    .map((version) => ({
      ruleId: "AMEND-01",
      severity: "REVIEW" as const,
      message: "amendment effective date needs confirmation, Manual 4.20",
      refs: { serviceAuthId: chain.serviceAuthId, date: version.effectiveFrom, month: version.effectiveFrom.slice(0, 7) },
    }));
}
