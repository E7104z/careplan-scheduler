import { collection, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { getDb } from "../auth/firebase";
import { BAA_VERSION } from "./baaText";
import type { AuthActor } from "./types";

// APP-SPEC 6.3: one batched write creates the tenant, its founding owner member and
// users/{uid}.lastTenantId. firestore.rules (section 8) verifies each field, including the
// `getAfter` link between the tenant and its founding member.

function memberRef(tenantId: string, uid: string) {
  return doc(collection(getDb(), "tenants", tenantId, "members"), uid);
}

/** Creates a tenant, its founder, and the current-agency pointer; resolves to the new id. */
export async function createAgency(account: AuthActor, name: string, workweekStart: number): Promise<string> {
  const db = getDb();
  const tenantRef = doc(collection(db, "tenants"));
  const batch = writeBatch(db);
  batch.set(tenantRef, {
    name,
    state: "MO",
    timeZone: "America/Chicago",
    workweekStart,
    createdAt: serverTimestamp(),
    createdBy: account.uid,
  });
  batch.set(memberRef(tenantRef.id, account.uid), {
    uid: account.uid,
    role: "owner",
    email: account.email.toLowerCase(),
    displayName: account.displayName.slice(0, 120),
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", account.uid), { lastTenantId: tenantRef.id, updatedAt: serverTimestamp() });
  await batch.commit();
  return tenantRef.id;
}

/** Owners change only the two editable fields (APP-SPEC 6.3). */
export async function updateAgency(tenantId: string, changes: { name: string; workweekStart: number }): Promise<void> {
  await updateDoc(doc(getDb(), "tenants", tenantId), changes);
}

/**
 * An owner accepts the BAA, recording the version, who accepted, and when (PHASE-3-SPEC §3).
 * firestore.rules allows this only for an owner and only when the three fields arrive together.
 */
export async function acceptBaa(tenantId: string, account: AuthActor): Promise<void> {
  await updateDoc(doc(getDb(), "tenants", tenantId), {
    baaVersion: BAA_VERSION,
    baaAcceptedBy: account.uid,
    baaAcceptedAt: serverTimestamp(),
  });
}
