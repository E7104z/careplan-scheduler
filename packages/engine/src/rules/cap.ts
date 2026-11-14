import type { ServiceAuthorization, ValidationResult } from "../types.js";

function overlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * The combination of agency model PC and CDS shall not exceed 60% of the cost maximum; the cost
 * of APC and RN visits can take it past 60%, only up to 100%; over 100% with an HCBS waiver needs
 * Bureau of Federal Programs approval (Manual 4.20). The scheduler holds no costs, so this is one
 * flag on the plan: REVIEW on each of the two authorizations, never a balance and never a block.
 * @rule CAP-01
 * @source HCBS Manual 4.20 (rev. Jul 2025); Policy 3.25 (rev. Jan 2026)
 */
export function ruleCAP01CombinedCostCap(authorizations: ServiceAuthorization[]): ValidationResult[] {
  const agency = authorizations.filter((auth) => auth.serviceCode === "T1019");
  const cds = authorizations.filter((auth) => auth.serviceCode === "T1019U2");
  const paired = [
    ...agency.filter((auth) => cds.some((other) => overlap(auth, other))),
    ...cds.filter((auth) => agency.some((other) => overlap(auth, other))),
  ];
  return paired.map((auth) => ({
    ruleId: "CAP-01",
    severity: "REVIEW" as const,
    message: "Agency personal care and CDS on the same dates share the 60% cost maximum",
    refs: { serviceAuthId: auth.id },
  }));
}
