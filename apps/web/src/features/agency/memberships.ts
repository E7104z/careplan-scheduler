import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "../auth/firebase";
import type { AgencyState, AuthActor, Member, MemberRole, Membership, Tenant } from "./types";

// APP-SPEC 7.2: my memberships come from a collection-group query; the current agency is
// users/{uid}.lastTenantId when the person is still a member, otherwise the first membership.

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asRole(value: unknown): MemberRole {
  return value === "owner" || value === "scheduler" || value === "viewer" ? value : "viewer";
}

function asJoinedLabel(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toLocaleDateString() : null;
}

export async function myMemberships(account: AuthActor): Promise<Membership[]> {
  const db = getDb();
  const snapshot = await getDocs(query(collectionGroup(db, "members"), where("uid", "==", account.uid)));
  const entries = await Promise.all(
    snapshot.docs.map(async (member) => {
      const tenantId = member.ref.parent?.parent?.id ?? "";
      const tenant = tenantId ? await getDoc(doc(db, "tenants", tenantId)) : null;
      const data = tenant?.exists() ? ((tenant.data() ?? {}) as Record<string, unknown>) : null;
      return {
        tenantId,
        name: (data !== null && asString(data.name)) || "Agency",
        role: asRole((member.data() as Record<string, unknown>).role),
      };
    }),
  );
  return entries.filter((entry) => entry.tenantId !== "").sort((a, b) => a.name.localeCompare(b.name));
}

export async function listAgencyMembers(tenantId: string): Promise<Member[]> {
  const snapshot = await getDocs(collection(getDb(), "tenants", tenantId, "members"));
  return snapshot.docs
    .map((member) => {
      const data = member.data() as Record<string, unknown>;
      return {
        uid: asString(data.uid),
        role: asRole(data.role),
        email: asString(data.email),
        displayName: asString(data.displayName),
        joinedAt: asJoinedLabel(data.joinedAt),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function countPendingAgencyInvites(tenantId: string): Promise<number> {
  const snapshot = await getDocs(
    query(collection(getDb(), "invites"), where("tenantId", "==", tenantId), where("status", "==", "pending")),
  );
  return snapshot.size;
}

export async function setLastTenantId(account: AuthActor, tenantId: string): Promise<void> {
  await updateDoc(doc(getDb(), "users", account.uid), { lastTenantId: tenantId, updatedAt: serverTimestamp() });
}

/** Loads the memberships, current agency, its members and (for owners) its pending invites. */
export async function loadAgencyData(account: AuthActor): Promise<AgencyState> {
  const memberships = await myMemberships(account);
  if (memberships.length === 0) {
    return { memberships, tenantId: null, tenant: null, role: null, members: [], pendingInvites: 0 };
  }

  const db = getDb();
  const userSnapshot = await getDoc(doc(db, "users", account.uid));
  const userData = userSnapshot.exists() ? ((userSnapshot.data() ?? {}) as Record<string, unknown>) : null;
  const lastTenantId = userData !== null ? asString(userData.lastTenantId) : "";
  const current = memberships.find((membership) => membership.tenantId === lastTenantId) ?? memberships[0];
  if (!current) {
    return { memberships, tenantId: null, tenant: null, role: null, members: [], pendingInvites: 0 };
  }

  const [tenantSnapshot, members, pendingInvites] = await Promise.all([
    getDoc(doc(db, "tenants", current.tenantId)),
    listAgencyMembers(current.tenantId),
    current.role === "owner" ? countPendingAgencyInvites(current.tenantId) : Promise.resolve(0),
  ]);

  const tenant = tenantSnapshot.exists()
    ? (tenantSnapshot.data() as Tenant)
    : null;

  return {
    memberships,
    tenantId: current.tenantId,
    tenant,
    role: current.role,
    members,
    pendingInvites,
  };
}
