import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { planFromStored, storedPlan } from "../quick-schedule/persistence";
import type { CarePlan } from "../quick-schedule/types";
import { getDb } from "../auth/firebase";
import { asMillis, asString } from "./docFields";
import type { AuthActor } from "./types";

/**
 * PHASE-3-SPEC section 6: saved participants and plans under the tenant. A write needs the
 * customer BAA on the tenant AND the deployment's `config/phiStorage.enabled`, which only the Admin
 * SDK sets (firestore.rules R-21 to R-28); this module never tries to work around a refusal.
 *
 * A plan is stored as the tab's own copy (persistence.ts `storedPlan`): no participant name or DCN
 * and no caregiver names (P3-08). It is kept as JSON text inside the `carePlan` map, with its SHA-256
 * in `checksum`, so it reads back through the same shape check exactly as it was saved.
 */

/** The stored plan's version: the tab's copy, `cps.quick.v3` (APP-SPEC 5.8). */
export const PLAN_SCHEMA = 3;
/** firestore.rules: a participant's displayName is 1 to 120 characters, a plan's name 1 to 160. */
export const PARTICIPANT_NAME_MAX = 120;
export const PLAN_NAME_MAX = 160;
/** Firestore writes at most 500 operations in one batch. */
const BATCH_LIMIT = 450;

/** A saved plan as the list shows it. */
export interface SavedPlanSummary {
  id: string;
  name: string;
  planStart: string;
  planEnd: string;
  /** Epoch ms; null while the server time is pending. */
  savedAt: number | null;
  savedBy: string;
}

/** A saved plan's text didn't match its checksum or shape: it isn't opened. */
export class SavedPlanError extends Error {
  constructor() {
    super("damaged-plan");
    this.name = "SavedPlanError";
  }
}

function participantsOf(tenantId: string) {
  return collection(getDb(), "tenants", tenantId, "participants");
}

function plansOf(tenantId: string, participantId: string) {
  return collection(getDb(), "tenants", tenantId, "participants", participantId, "plans");
}

/** True once the deployment allows PHI storage (`config/phiStorage.enabled`, Admin SDK only). */
export async function phiStorageEnabled(): Promise<boolean> {
  const snapshot = await getDoc(doc(getDb(), "config", "phiStorage"));
  return snapshot.exists() && (snapshot.data() as Record<string, unknown>).enabled === true;
}

/** A new participant under its agency alias; resolves to the random internal id (P3-08). */
export async function createParticipant(tenantId: string, actor: AuthActor, displayName: string): Promise<string> {
  const ref = doc(participantsOf(tenantId));
  await setDoc(ref, {
    displayName,
    createdAt: serverTimestamp(),
    createdBy: actor.uid,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  return ref.id;
}

export async function renameParticipant(tenantId: string, participantId: string, actor: AuthActor, displayName: string): Promise<void> {
  await updateDoc(doc(participantsOf(tenantId), participantId), {
    displayName,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
}

/** The participant's alias, or null when there is no such participant. */
export async function participantName(tenantId: string, participantId: string): Promise<string | null> {
  const snapshot = await getDoc(doc(participantsOf(tenantId), participantId));
  return snapshot.exists() ? asString((snapshot.data() as Record<string, unknown>).displayName) : null;
}

/** The participant's saved plans, newest first. */
export async function listPlans(tenantId: string, participantId: string): Promise<SavedPlanSummary[]> {
  const snapshot = await getDocs(plansOf(tenantId, participantId));
  return snapshot.docs
    .map((entry) => {
      const data = entry.data() as Record<string, unknown>;
      return {
        id: entry.id,
        name: asString(data.name),
        planStart: asString(data.planStart),
        planEnd: asString(data.planEnd),
        savedAt: asMillis(data.savedAt),
        savedBy: asString(data.savedBy),
      };
    })
    .sort((a, b) => (b.savedAt ?? Number.MAX_SAFE_INTEGER) - (a.savedAt ?? Number.MAX_SAFE_INTEGER));
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The first date any authorization starts and the last any ends. */
export function planDates(plan: CarePlan): { planStart: string; planEnd: string } {
  const starts = plan.services.map((state) => state.plan.start).sort();
  const ends = plan.services.map((state) => state.plan.end).sort();
  return { planStart: starts[0] ?? "", planEnd: ends.at(-1) ?? "" };
}

/** Saves the plan under the participant: a new plan, or over `planId`. Resolves to the plan's id. */
export async function savePlanFor(
  tenantId: string,
  participantId: string,
  actor: AuthActor,
  change: { planId: string | null; name: string; plan: CarePlan },
): Promise<string> {
  const json = JSON.stringify(storedPlan(change.plan));
  const ref: DocumentReference = change.planId ? doc(plansOf(tenantId, participantId), change.planId) : doc(plansOf(tenantId, participantId));
  await setDoc(ref, {
    name: change.name,
    carePlan: { schema: PLAN_SCHEMA, json },
    ...planDates(change.plan),
    checksum: await sha256(json),
    savedAt: serverTimestamp(),
    savedBy: actor.uid,
  });
  return ref.id;
}

/** Reads a saved plan back, checked against its checksum and the plan's shape. */
export async function openSavedPlan(tenantId: string, participantId: string, planId: string): Promise<CarePlan> {
  const snapshot = await getDoc(doc(plansOf(tenantId, participantId), planId));
  if (!snapshot.exists()) throw new SavedPlanError();
  const data = snapshot.data() as Record<string, unknown>;
  const stored = data.carePlan as Record<string, unknown> | undefined;
  const json = stored?.json;
  if (stored?.schema !== PLAN_SCHEMA || typeof json !== "string" || (await sha256(json)) !== data.checksum) {
    throw new SavedPlanError();
  }
  let plan: CarePlan | null;
  try {
    plan = planFromStored(JSON.parse(json));
  } catch {
    plan = null;
  }
  if (!plan) throw new SavedPlanError();
  return plan;
}

/** Owners only (firestore.rules). */
export async function deleteSavedPlan(tenantId: string, participantId: string, planId: string): Promise<void> {
  await deleteDoc(doc(plansOf(tenantId, participantId), planId));
}

/**
 * Deletes the participant with every saved plan and visit under them, so nothing is left behind
 * without its participant. Owners only (firestore.rules).
 */
export async function deleteParticipant(tenantId: string, participantId: string): Promise<void> {
  const db = getDb();
  const children = await Promise.all(
    ["plans", "visits"].map((name) => getDocs(collection(db, "tenants", tenantId, "participants", participantId, name))),
  );
  const refs = children.flatMap((snapshot) => snapshot.docs.map((entry) => entry.ref));
  for (let at = 0; at < refs.length; at += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(at, at + BATCH_LIMIT)) batch.delete(ref);
    await batch.commit();
  }
  const last = writeBatch(db);
  last.delete(doc(participantsOf(tenantId), participantId));
  await last.commit();
}
