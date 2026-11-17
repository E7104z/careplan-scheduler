import { readJson, removeJson, writeJson } from "../../lib/storage";
import type { CarePlan } from "../quick-schedule/types";

/**
 * Which agency plan the tab's Quick Schedule plan came from, so "Save to agency" can update it
 * rather than make a copy. Ids only (random document ids and authorization UUIDs), never a name,
 * so the tab's storage still holds no PHI beyond the de-identified plan (AC-15).
 */
export const OPENED_PLAN_KEY = "cps.quick.saved";

export interface OpenedPlanLink {
  tenantId: string;
  participantId: string;
  planId: string;
  /** The plan's authorization ids when it was opened or saved: another plan has others. */
  serviceIds: string[];
}

function isLink(value: unknown): value is OpenedPlanLink {
  if (typeof value !== "object" || value === null) return false;
  const link = value as Record<string, unknown>;
  return (
    typeof link.tenantId === "string" &&
    typeof link.participantId === "string" &&
    typeof link.planId === "string" &&
    Array.isArray(link.serviceIds) &&
    link.serviceIds.every((id) => typeof id === "string")
  );
}

export function rememberOpenedPlan(link: Omit<OpenedPlanLink, "serviceIds">, plan: CarePlan): void {
  writeJson("session", OPENED_PLAN_KEY, { ...link, serviceIds: plan.services.map((state) => state.id) });
}

/** The saved plan this one is, or null: another agency's, or a plan with other authorizations, isn't. */
export function openedPlanFor(tenantId: string, plan: CarePlan): OpenedPlanLink | null {
  const link = readJson<unknown>("session", OPENED_PLAN_KEY);
  if (!isLink(link) || link.tenantId !== tenantId) return null;
  const ids = plan.services.map((state) => state.id);
  const same = ids.length === link.serviceIds.length && ids.every((id, at) => id === link.serviceIds[at]);
  return same ? link : null;
}

export function forgetOpenedPlan(): void {
  removeJson("session", OPENED_PLAN_KEY);
}
