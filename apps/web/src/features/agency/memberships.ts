import { collectionGroup, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getDb } from "../auth/firebase";
import { asRole, asString, asTenant } from "./docFields";
import { listAgencyInvites, listMyInvites } from "./invites";
import { listMembers } from "./members";
import { agencyInitialState, type AgencyState, type AuthActor, type Membership } from "./types";

// APP-SPEC 7.2: my memberships come from a collection-group query; the current agency is
// users/{uid}.lastTenantId when the person is still a member, otherwise the first membership.

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

export async function setLastTenantId(account: AuthActor, tenantId: string): Promise<void> {
  await updateDoc(doc(getDb(), "users", account.uid), { lastTenantId: tenantId, updatedAt: serverTimestamp() });
}

/**
 * Loads the memberships, my pending invites (for the banner), the current agency, its members
 * and (for owners) its pending invites.
 */
export async function loadAgencyData(account: AuthActor): Promise<AgencyState> {
  const [memberships, invitesForMe] = await Promise.all([myMemberships(account), listMyInvites(account.email)]);
  // An invite to an agency the person is already in can't be accepted, so it isn't offered.
  const myInvites = invitesForMe.filter((invite) => !memberships.some((entry) => entry.tenantId === invite.tenantId));
  if (memberships.length === 0) return { ...agencyInitialState(), myInvites };

  const db = getDb();
  const userSnapshot = await getDoc(doc(db, "users", account.uid));
  const userData = userSnapshot.exists() ? ((userSnapshot.data() ?? {}) as Record<string, unknown>) : null;
  const lastTenantId = userData !== null ? asString(userData.lastTenantId) : "";
  const current = memberships.find((membership) => membership.tenantId === lastTenantId) ?? memberships[0];
  if (!current) return { ...agencyInitialState(), myInvites };

  const [tenantSnapshot, members, agencyInvites] = await Promise.all([
    getDoc(doc(db, "tenants", current.tenantId)),
    listMembers(current.tenantId),
    current.role === "owner" ? listAgencyInvites(current.tenantId) : Promise.resolve([]),
  ]);

  return {
    memberships,
    tenantId: current.tenantId,
    tenant: tenantSnapshot.exists() ? asTenant((tenantSnapshot.data() ?? {}) as Record<string, unknown>) : null,
    role: current.role,
    members,
    agencyInvites,
    myInvites,
  };
}
