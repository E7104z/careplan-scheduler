import type { Caregiver, Visit } from "@careplan/engine";
import { newId } from "./ids.js";
import { otherService } from "./others.js";
import type { CaregiverRelationship, CarePlan, PlanCaregiver, PlanOther, QuickModel } from "./types.js";

/** One plan is one participant. The id is a constant: no name or DCN is ever used as a key. */
export const PARTICIPANT_ID = "participant";

export const RELATIONSHIP_LABELS: Record<CaregiverRelationship, string> = {
  none: "Not related",
  spouse: "Spouse",
  legal_guardian: "Legal guardian",
  parent: "Parent",
  sibling: "Sibling",
  child: "Child",
  stepchild: "Stepchild",
  grandparent: "Grandparent",
  grandchild: "Grandchild",
  other_family: "Other family",
};

/** The plan's caregivers; plans saved before Coverage Phase 4 have none. */
export function planCaregivers(plan: CarePlan): PlanCaregiver[] {
  return plan.caregivers ?? [];
}

/**
 * What a caregiver is called on the page and the printout: the name while it is in memory, else
 * "Caregiver 1" by their place in the plan. A name is never read from storage, because none is
 * ever written there.
 */
export function caregiverLabel(plan: CarePlan, id: string, useName = true): string {
  const at = planCaregivers(plan).findIndex((caregiver) => caregiver.id === id);
  if (at < 0) return "Caregiver";
  const name = planCaregivers(plan)[at]!.name?.trim();
  return useName && name ? name : `Caregiver ${at + 1}`;
}

/** A caregiver with nothing entered yet: every qualification is "not entered", never assumed. */
export function newCaregiver(): PlanCaregiver {
  return { id: newId(), relationship: null, agencyEmployee: null, nurseLicense: null, fcsrRegistered: null };
}

/**
 * The plan's caregivers as the engine's rules read them. A qualification that wasn't entered is
 * left out, so the rule that needs it asks for it (CON-17, REVIEW) instead of assuming an answer.
 */
export function engineCaregivers(plan: CarePlan): Caregiver[] {
  return planCaregivers(plan).map((caregiver): Caregiver => {
    const relationships: Caregiver["relationships"] = {};
    if (caregiver.relationship !== null) relationships[PARTICIPANT_ID] = caregiver.relationship;
    return {
    id: caregiver.id,
    relationships,
    ...(caregiver.agencyEmployee === null ? {} : { agencyEmployee: caregiver.agencyEmployee }),
    ...(caregiver.nurseLicense === null ? {} : { nurseLicense: caregiver.nurseLicense }),
    ...(caregiver.fcsrRegistered === null ? {} : { fcsrRegistered: caregiver.fcsrRegistered }),
    };
  });
}

/** The caregivers assigned to a service that are still in the plan, in the order assigned. */
export function assignedTo(plan: CarePlan, service: number): string[] {
  const known = new Set(planCaregivers(plan).map((caregiver) => caregiver.id));
  return (plan.services[service]?.caregiverIds ?? []).filter((id) => known.has(id));
}

/**
 * Who is assigned to what, in the form the engine's qualification rules read (they find a
 * service's caregivers from its visits): one zero-length visit per assignment on the service's
 * first date. They say only "this caregiver is assigned to this service", so a caregiver's
 * relationship and qualifications are checked even before any clock time is entered; being
 * zero-length they overlap nothing and add no minutes.
 */
export function assignmentVisits(plan: CarePlan, models: QuickModel[]): Visit[] {
  return plan.services.flatMap((state, index) => {
    const start = models[index]!.auth.start;
    return assignedTo(plan, index).map((caregiverId): Visit => ({
      id: `assigned:${state.id}:${caregiverId}`, participantId: PARTICIPANT_ID, caregiverId, serviceCode: state.serviceCode,
      start: `${start}T00:00`, end: `${start}T00:00`, taskIds: [],
    }));
  });
}

/** Whether a kept authorization is the structured family caregiver service, which has a primary and a backup. */
export function isSfc(other: PlanOther): boolean {
  return otherService(other)?.mode === "DAY_COVERAGE";
}

function mapService(plan: CarePlan, service: number, caregiverIds: string[]): CarePlan {
  return { ...plan, services: plan.services.map((state, index) => (index === service ? { ...state, caregiverIds } : state)) };
}

/** Add an empty caregiver to the plan. */
export function addCaregiver(plan: CarePlan): CarePlan {
  return { ...plan, caregivers: [...planCaregivers(plan), newCaregiver()] };
}

/** Change what was entered for a caregiver. */
export function updateCaregiver(plan: CarePlan, id: string, patch: Partial<Omit<PlanCaregiver, "id">>): CarePlan {
  return { ...plan, caregivers: planCaregivers(plan).map((caregiver) => (caregiver.id === id ? { ...caregiver, ...patch } : caregiver)) };
}

/** Take a caregiver off the plan, and off every service and covered-day role they were on. */
export function removeCaregiver(plan: CarePlan, id: string): CarePlan {
  return {
    ...plan,
    caregivers: planCaregivers(plan).filter((caregiver) => caregiver.id !== id),
    services: plan.services.map((state) =>
      state.caregiverIds?.includes(id) ? { ...state, caregiverIds: state.caregiverIds.filter((existing) => existing !== id) } : state,
    ),
    ...(plan.others
      ? {
          others: plan.others.map((other) =>
            other.sfcCaregivers
              ? {
                  ...other,
                  sfcCaregivers: {
                    primary: other.sfcCaregivers.primary === id ? null : other.sfcCaregivers.primary,
                    backup: other.sfcCaregivers.backup === id ? null : other.sfcCaregivers.backup,
                  },
                }
              : other,
          ),
        }
      : {}),
  };
}

/** Assign a caregiver to a service, or take them off it. */
export function assignCaregiver(plan: CarePlan, service: number, id: string, on: boolean): CarePlan {
  const current = plan.services[service]?.caregiverIds ?? [];
  if (!plan.services[service] || !planCaregivers(plan).some((caregiver) => caregiver.id === id)) return plan;
  const next = on ? (current.includes(id) ? current : [...current, id]) : current.filter((existing) => existing !== id);
  return mapService(plan, service, next);
}

/** Set a covered-day service's primary or backup caregiver (null clears it). One person can't be both. */
export function setSfcCaregiver(plan: CarePlan, otherId: string, role: "primary" | "backup", id: string | null): CarePlan {
  if (!plan.others) return plan;
  return {
    ...plan,
    others: plan.others.map((other) => {
      if (other.id !== otherId || !isSfc(other)) return other;
      const pair = { primary: null, backup: null, ...other.sfcCaregivers, [role]: id };
      const otherRole = role === "primary" ? "backup" : "primary";
      if (id !== null && pair[otherRole] === id) pair[otherRole] = null;
      return { ...other, sfcCaregivers: pair };
    }),
  };
}
