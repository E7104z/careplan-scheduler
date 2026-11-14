import { ruleCAP01CombinedCostCap } from "./rules/cap.js";
import {
  ruleCDS01PromptingCueing,
  ruleCDS02WaitingTime,
  ruleCDS03LicensedTasks,
  ruleCDS04NemtTrips,
  ruleCDS05FacilityResidents,
} from "./rules/cds.js";
import { rulePRG01Pace, rulePRG02DmhPrograms, rulePRG03FundingSequence } from "./rules/programs.js";
import type { ProgramEnrollment, ServiceAuthorization, ValidationResult } from "./types.js";

/** CDS task rules (Policy 3.25) on one plan's authorizations: the labels and transportation it states. */
export function cdsTaskResults(authorizations: ServiceAuthorization[]): ValidationResult[] {
  return [
    ...ruleCDS01PromptingCueing(authorizations),
    ...ruleCDS02WaitingTime(authorizations),
    ...ruleCDS03LicensedTasks(authorizations),
    ...ruleCDS04NemtTrips(authorizations),
  ];
}

/**
 * Setting and program compatibility (CP4-7) and the combined cost cap (CP4-8): across the plan's
 * services and the programs the person entered.
 */
export function settingAndProgramResults(authorizations: ServiceAuthorization[], programs: ProgramEnrollment[]): ValidationResult[] {
  return [
    ...ruleCDS05FacilityResidents(authorizations),
    ...rulePRG01Pace(authorizations, programs),
    ...rulePRG02DmhPrograms(authorizations, programs),
    ...rulePRG03FundingSequence(authorizations, programs),
    ...ruleCAP01CombinedCostCap(authorizations),
  ];
}
