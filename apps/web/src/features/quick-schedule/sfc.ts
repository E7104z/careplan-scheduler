import { ruleSFC01HcbsExclusivity, ruleSFC02SinglePrimary, type HcbsPeriod, type ValidationResult } from "@careplan/engine";
import { isSfc, planCaregivers } from "./caregivers.js";
import { otherName, otherService, planOthers } from "./others.js";
import type { CarePlan } from "./types.js";

/**
 * The structured family caregiver authorization's period (Policy 3.60), as SFC-01 reads it. The
 * app keeps SFCW as a kept authorization (`PlanOther`, mode DAY_COVERAGE), not a scheduled service.
 */
export function sfcwPeriod(plan: CarePlan): HcbsPeriod | null {
  const sfc = planOthers(plan).find(isSfc);
  if (!sfc || sfc.id === undefined) return null;
  return { id: sfc.id, name: otherName(sfc), start: sfc.start, end: sfc.end, hcbs: true };
}

/**
 * The plan's other authorizations as SFC-01 reads them, in the plan's order. A scheduled service
 * is HCBS; a kept Appendix 1 service is HCBS; a kept code outside Appendix 1 (or a service kept
 * with no code) is unknown, never guessed.
 */
export function hcbsPeriods(plan: CarePlan, excludingSfc: boolean): HcbsPeriod[] {
  const periods: HcbsPeriod[] = [];
  for (const state of plan.services) {
    periods.push({
      id: state.id,
      name: state.serviceLabel ?? state.serviceCode,
      start: state.plan.start,
      end: state.plan.end,
      hcbs: true,
    });
  }
  for (const other of planOthers(plan)) {
    if (excludingSfc && isSfc(other)) continue;
    if (other.id === undefined) continue;
    const service = otherService(other);
    // A kept Appendix 1 service is HCBS; anything else is unknown (never guessed).
    const hcbs: boolean | null = service ? true : null;
    periods.push({ id: other.id, name: otherName(other), start: other.start, end: other.end, hcbs });
  }
  return periods;
}

/** The plan's caregiver roles on its SFCW authorization, as SFC-02 reads them. */
export function sfcCaregiverRoles(plan: CarePlan): { id: string; role: "primary" | "backup" | null }[] {
  const sfc = planOthers(plan).find(isSfc);
  if (!sfc) return [];
  return planCaregivers(plan).map((caregiver) => {
    const role =
      sfc.sfcCaregivers?.primary === caregiver.id ? "primary" : sfc.sfcCaregivers?.backup === caregiver.id ? "backup" : null;
    return { id: caregiver.id, role };
  });
}

/**
 * The SFCW exclusivity results (Policy 3.60): SFC-01 on the authorization periods, SFC-02 on the
 * primary caregiver. No SFCW authorization, no results. The engine's rules are called as they are.
 */
export function sfcResults(plan: CarePlan): ValidationResult[] {
  const sfcw = sfcwPeriod(plan);
  if (!sfcw) return [];
  return [
    ...ruleSFC01HcbsExclusivity(sfcw, hcbsPeriods(plan, true)),
    ...ruleSFC02SinglePrimary(sfcCaregiverRoles(plan)),
  ];
}
