import type { OtherProgram, ProgramCode, ProgramEnrollment, ServiceAuthorization, ValidationResult } from "../types.js";

// Program compatibility (CP4-7). Each program is one the person entered, with its dates; none is
// inferred from a name or a service. Policy states these exclusions outright, so an overlap is
// BLOCK; the funding sequence can't be seen from the plan, so it is REVIEW.

/** DSDS's State Plan personal care (Policy 4.35.1): Basic and Advanced, in-home and RCF/ALF, and CDS. */
const STATE_PLAN_PC: ReadonlySet<ProgramCode> = new Set(["CDS", "AGENCY_PC", "APC", "RCF_PC", "RCF_APC"]);
/** DSDS's self-directed personal care: CDS (State Plan) and ILW. */
const SELF_DIRECTED: ReadonlySet<ProgramCode> = new Set(["CDS", "ILW"]);
const DD_RESIDENTIAL: ReadonlySet<OtherProgram> = new Set(["DD_SHARED_LIVING", "DD_RESIDENTIAL_HABILITATION", "DD_ISL"]);

const PROGRAM_NAMES: Record<OtherProgram, string> = {
  PACE: "PACE",
  DD_SHARED_LIVING: "DD Shared Living",
  DD_RESIDENTIAL_HABILITATION: "DD Residential Habilitation",
  DD_ISL: "DD Individualized Supportive Living",
  DMH_SELF_DIRECTED: "DMH self-directed services",
  DD_WAIVER_PERSONAL_ASSISTANT: "DD waiver personal assistant services",
};

function overlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** One BLOCK per authorization in `covers` that an enrollment in `programs` overlaps. */
function excluded(
  ruleId: string,
  authorizations: ServiceAuthorization[],
  enrollments: ProgramEnrollment[],
  programs: (program: OtherProgram) => boolean,
  covers: (auth: ServiceAuthorization) => boolean,
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const auth of authorizations.filter(covers)) {
    const enrollment = enrollments.find((entry) => programs(entry.program) && overlap(entry, auth));
    if (!enrollment) continue;
    results.push({
      ruleId,
      severity: "BLOCK",
      message: `${PROGRAM_NAMES[enrollment.program]} (${enrollment.start} to ${enrollment.end}) overlaps ${auth.serviceCode}`,
      refs: { serviceAuthId: auth.id, participantId: auth.participantId },
    });
  }
  return results;
}

/**
 * A participant enrolled in PACE is not eligible for any service authorized through HCBS
 * (Policy 4.35.3).
 * @rule PRG-01
 * @source Policy 4.35.3 (rev. May 2023)
 */
export function rulePRG01Pace(authorizations: ServiceAuthorization[], enrollments: ProgramEnrollment[]): ValidationResult[] {
  return excluded("PRG-01", authorizations, enrollments, (program) => program === "PACE", () => true);
}

/**
 * Participants authorized for DD Shared Living, Residential Habilitation or Individualized
 * Supportive Living are not eligible for State Plan Personal Care through DSDS, and a participant
 * may be in only one self-direction program at a time (Policy 4.35.1). Participants authorized for
 * DMH self-directed services are not eligible for CDS or ILW personal care (Policy 3.25).
 * @rule PRG-02
 * @source Policy 4.35.1 (read Nov 13, 2026); Policy 3.25 (rev. Jan 2026)
 */
export function rulePRG02DmhPrograms(authorizations: ServiceAuthorization[], enrollments: ProgramEnrollment[]): ValidationResult[] {
  const results = [
    ...excluded("PRG-02", authorizations, enrollments, (program) => DD_RESIDENTIAL.has(program), (auth) => STATE_PLAN_PC.has(auth.program)),
    ...excluded("PRG-02", authorizations, enrollments, (program) => program === "DMH_SELF_DIRECTED", (auth) => SELF_DIRECTED.has(auth.program)),
  ];
  // One result per authorization, in the plan's order.
  const order = authorizations.map((auth) => auth.id);
  return results
    .filter((result, index) => results.findIndex((other) => other.refs.serviceAuthId === result.refs.serviceAuthId) === index)
    .sort((a, b) => order.indexOf(a.refs.serviceAuthId ?? "") - order.indexOf(b.refs.serviceAuthId ?? ""));
}

/**
 * Medicaid State Plan services must be used before a comparable HCBS waiver service; DD waiver
 * personal assistant services are comparable to State Plan Personal Care, which must be exhausted
 * first (Policy 4.35.1). Whether it is exhausted isn't on the plan, so this is REVIEW.
 * @rule PRG-03
 * @source Policy 4.35.1 (read Nov 13, 2026)
 */
export function rulePRG03FundingSequence(authorizations: ServiceAuthorization[], enrollments: ProgramEnrollment[]): ValidationResult[] {
  return enrollments
    .filter((entry) => entry.program === "DD_WAIVER_PERSONAL_ASSISTANT")
    .map((entry) => {
      const statePlan = authorizations.some((auth) => STATE_PLAN_PC.has(auth.program) && overlap(entry, auth));
      return {
        ruleId: "PRG-03",
        severity: "REVIEW" as const,
        message: statePlan
          ? `DD waiver personal assistant services (${entry.start} to ${entry.end}) and State Plan personal care on the same dates`
          : `DD waiver personal assistant services (${entry.start} to ${entry.end}) with no State Plan personal care on the plan for those dates`,
        refs: { participantId: entry.participantId },
      };
    });
}
