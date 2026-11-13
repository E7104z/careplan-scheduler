import type { ValidationResult } from "../types.js";

/**
 * An authorization's effective period and its HCBS classification, as SFCW exclusivity reads it.
 * Policy 3.60 says a participant can't be enrolled in SFCW and another HCBS State Plan or waiver
 * service at the same time; the check is on the authorization periods, not on clock times.
 */
export interface HcbsPeriod {
  id: string;
  /** What the authorization is, for the message: "PC - Agency", "Unknown service H2015". */
  name: string;
  /** YYYY-MM-DD; null when the dates aren't known. */
  start: string | null;
  end: string | null;
  /** true = an HCBS State Plan or waiver service; false = not HCBS; null = classification unknown. */
  hcbs: boolean | null;
}

function overlappingDate(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && startB <= endA;
}

/**
 * SFCW exclusivity (Policy 3.60; HCBS 01-26-01; Appendix 2g): a structured family caregiver
 * authorization can't overlap the period of any other HCBS State Plan or waiver authorization.
 * An overlapping HCBS authorization is BLOCK; one whose dates or classification aren't known is
 * REVIEW (never guessed); a non-HCBS service is ignored. Sequential periods are fine. Missing
 * SFCW dates themselves are REVIEW.
 * @rule SFC-01
 * @source Policy 3.60 (rev. Jul 2026); HCBS 01-26-01 (Jan 20, 2026); Appendix 2g (rev. Jun 2026)
 */
export function ruleSFC01HcbsExclusivity(
  sfcw: HcbsPeriod,
  others: readonly HcbsPeriod[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  if (sfcw.start === null || sfcw.end === null) {
    results.push({
      ruleId: "SFC-01",
      severity: "REVIEW",
      message: "The structured family caregiver authorization's dates are missing, so exclusivity can't be checked.",
      refs: { serviceAuthId: sfcw.id },
    });
    return results;
  }
  for (const other of others) {
    if (other.id === sfcw.id || other.hcbs === false) continue;
    if (other.start === null || other.end === null || other.hcbs === null) {
      results.push({
        ruleId: "SFC-01",
        severity: "REVIEW",
        message: `${other.name} can't be checked against the structured family caregiver authorization: its dates or classification are missing.`,
        refs: { serviceAuthId: other.id },
      });
      continue;
    }
    if (overlappingDate(other.start, other.end, sfcw.start, sfcw.end)) {
      results.push({
        ruleId: "SFC-01",
        severity: "BLOCK",
        message: `${other.name} (${other.start} to ${other.end}) overlaps the structured family caregiver authorization (${sfcw.start} to ${sfcw.end}). A participant can't be enrolled in SFCW and another HCBS service at once.`,
        refs: { serviceAuthId: other.id, date: other.start <= sfcw.start ? sfcw.start : other.start },
      });
    }
  }
  return results;
}

/** A caregiver's role on a structured family caregiver authorization. */
export interface SfcCaregiverRole {
  id: string;
  role: "primary" | "backup" | null;
}

/**
 * SFCW has one live-in primary caregiver and an identified qualified substitute (Policy 3.60).
 * More than one primary is BLOCK.
 * @rule SFC-02
 * @source Policy 3.60 (rev. Jul 2026); Appendix 2g (rev. Jun 2026)
 */
export function ruleSFC02SinglePrimary(assignments: readonly SfcCaregiverRole[]): ValidationResult[] {
  const primaries = assignments.filter((assignment) => assignment.role === "primary");
  if (primaries.length <= 1) return [];
  return primaries.map((primary) => ({
    ruleId: "SFC-02",
    severity: "BLOCK",
    message: "The structured family caregiver authorization has more than one primary caregiver. It takes one live-in primary caregiver and a qualified substitute.",
    refs: { serviceAuthId: primary.id },
  }));
}
