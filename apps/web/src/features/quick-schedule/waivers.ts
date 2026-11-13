import type { WaiverCode, WaiverEnrollment } from "@careplan/engine";
import { PARTICIPANT_ID } from "./caregivers.js";
import type { CarePlan, PlanWaiver } from "./types.js";

/** What the person chooses: the waiver's own name, not a code. */
export const WAIVER_LABELS: Record<WaiverCode, string> = {
  ILW: "Independent Living Waiver",
  ADW: "Aged and Disabled Waiver",
  ADCW: "Adult Day Care Waiver",
  SFCW: "Structured Family Caregiver Waiver",
};

/** The plan's waiver enrollments; plans saved before Coverage Phase 4 have none. */
export function planWaivers(plan: CarePlan): PlanWaiver[] {
  return plan.waivers ?? [];
}

/** The enrollments as the engine's CON-16 reads them: one participant (this plan's). */
export function engineEnrollments(plan: CarePlan): WaiverEnrollment[] {
  return planWaivers(plan).map((waiver) => ({ participantId: PARTICIPANT_ID, ...waiver }));
}

/** Add an enrollment spanning the plan's own dates; the person changes the code and dates as needed. */
export function addWaiver(plan: CarePlan): CarePlan {
  const span = plan.services[0]!.plan;
  return { ...plan, waivers: [...planWaivers(plan), { waiver: "ADW", start: span.start, end: span.end }] };
}

/** Change what was entered for an enrollment. */
export function updateWaiver(plan: CarePlan, index: number, patch: Partial<PlanWaiver>): CarePlan {
  return { ...plan, waivers: planWaivers(plan).map((waiver, at) => (at === index ? { ...waiver, ...patch } : waiver)) };
}

/** Take an enrollment off the plan. */
export function removeWaiver(plan: CarePlan, index: number): CarePlan {
  return { ...plan, waivers: planWaivers(plan).filter((_, at) => at !== index) };
}
