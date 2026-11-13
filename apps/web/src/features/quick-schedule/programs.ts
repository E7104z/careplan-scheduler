import type { OtherProgram, ProgramEnrollment } from "@careplan/engine";
import { PARTICIPANT_ID } from "./caregivers.js";
import type { CarePlan, PlanProgram } from "./types.js";

/** What the person chooses (CP4-7): each program's own name. */
export const PROGRAM_LABELS: Record<OtherProgram, string> = {
  PACE: "PACE (Program of All-Inclusive Care for the Elderly)",
  DD_SHARED_LIVING: "DD Shared Living (host home or companion home)",
  DD_RESIDENTIAL_HABILITATION: "DD Residential Habilitation",
  DD_ISL: "DD Individualized Supportive Living",
  DMH_SELF_DIRECTED: "DMH self-directed services",
  DD_WAIVER_PERSONAL_ASSISTANT: "DD waiver personal assistant services",
};

/** The programs entered for the plan; plans saved before CP4-7 have none. */
export function planPrograms(plan: CarePlan): PlanProgram[] {
  return plan.programs ?? [];
}

/** The programs as the engine's PRG rules read them: one participant (this plan's). */
export function enginePrograms(plan: CarePlan): ProgramEnrollment[] {
  return planPrograms(plan).map((entry) => ({ participantId: PARTICIPANT_ID, ...entry }));
}

/** Add a program spanning the plan's own dates; the person picks the program and changes the dates. */
export function addProgram(plan: CarePlan): CarePlan {
  const span = plan.services[0]!.plan;
  return { ...plan, programs: [...planPrograms(plan), { program: "PACE", start: span.start, end: span.end }] };
}

/** Change what was entered for a program. */
export function updateProgram(plan: CarePlan, index: number, patch: Partial<PlanProgram>): CarePlan {
  return { ...plan, programs: planPrograms(plan).map((entry, at) => (at === index ? { ...entry, ...patch } : entry)) };
}

/** Take a program off the plan. */
export function removeProgram(plan: CarePlan, index: number): CarePlan {
  return { ...plan, programs: planPrograms(plan).filter((_, at) => at !== index) };
}
