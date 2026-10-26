import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "../auth/firebase";
import { errorCode } from "../auth/errors";
import { asMillis, asRole, asStatus, asString } from "./docFields";
import { INVITE_DAYS } from "./inviteFields";
import type { AuthActor, Invite, MemberRole } from "./types";

// APP-SPEC 6.4 and 7.2 `invites/{id}`. firestore.rules (section 8) checks each write: owners
// create (14 days, lowercase email, the agency's own name) and revoke; the invitee accepts in one
// batch with their member doc.

const DAY_MS = 24 * 60 * 60 * 1000;

function invitesRef() {
  return collection(getDb(), "invites");
}

function toInvite(id: string, data: Record<string, unknown>): Invite {
  return {
    id,
    tenantId: asString(data.tenantId),
    tenantName: asString(data.tenantName),
    email: asString(data.email),
    role: asRole(data.role),
    status: asStatus(data.status),
    expiresAt: asMillis(data.expiresAt) ?? 0,
  };
}

/** Creates a pending invite to the current agency; resolves to it (for the link). */
export async function createInvite(
  owner: AuthActor,
  tenantId: string,
  tenantName: string,
  email: string,
  role: MemberRole,
): Promise<Invite> {
  const ref = doc(invitesRef());
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_DAYS * DAY_MS);
  const lowercase = email.trim().toLowerCase();
  await setDoc(ref, {
    tenantId,
    tenantName,
    email: lowercase,
    role,
    status: "pending",
    createdAt: serverTimestamp(),
    createdBy: owner.uid,
    expiresAt,
  });
  return { id: ref.id, tenantId, tenantName, email: lowercase, role, status: "pending", expiresAt: expiresAt.toMillis() };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(invitesRef(), inviteId), { status: "revoked" });
}

/** The agency's pending invites, soonest to expire first (owners only). */
export async function listAgencyInvites(tenantId: string): Promise<Invite[]> {
  const snapshot = await getDocs(query(invitesRef(), where("tenantId", "==", tenantId), where("status", "==", "pending")));
  return snapshot.docs
    .map((invite) => toInvite(invite.id, invite.data() as Record<string, unknown>))
    .sort((a, b) => a.expiresAt - b.expiresAt);
}

/** Pending invites for my email that haven't expired, for the invite banner. */
export async function listMyInvites(email: string, nowMs: number = Date.now()): Promise<Invite[]> {
  const snapshot = await getDocs(
    query(invitesRef(), where("email", "==", email.toLowerCase()), where("status", "==", "pending")),
  );
  return snapshot.docs
    .map((invite) => toInvite(invite.id, invite.data() as Record<string, unknown>))
    .filter((invite) => invite.expiresAt > nowMs)
    .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
}

/**
 * One invite for the Join page; null when it doesn't exist or the rules hide it from this person
 * (only the invitee and the agency's owners may read it, so the two look the same).
 */
export async function getInvite(inviteId: string): Promise<Invite | null> {
  try {
    const snapshot = await getDoc(doc(invitesRef(), inviteId));
    return snapshot.exists() ? toInvite(snapshot.id, snapshot.data() as Record<string, unknown>) : null;
  } catch (error) {
    if (errorCode(error) === "permission-denied") return null;
    throw error;
  }
}

/** Joining is one batch: the member doc (with `inviteId`) and the invite marked accepted. */
export async function acceptInvite(account: AuthActor, invite: Invite): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(doc(db, "tenants", invite.tenantId, "members", account.uid), {
    uid: account.uid,
    role: invite.role,
    email: account.email.toLowerCase(),
    displayName: account.displayName.slice(0, 120),
    joinedAt: serverTimestamp(),
    inviteId: invite.id,
  });
  batch.update(doc(db, "invites", invite.id), {
    status: "accepted",
    acceptedBy: account.uid,
    acceptedAt: serverTimestamp(),
  });
  await batch.commit();
}
