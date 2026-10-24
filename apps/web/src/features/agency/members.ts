import { collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { getDb } from "../auth/firebase";
import { asMillis, asRole, asString } from "./docFields";
import type { Member, MemberRole } from "./types";

// APP-SPEC 6.4 and 7.2 `tenants/{t}/members/{uid}`. firestore.rules lets owners change the role
// of, or remove, anyone but themselves; the Team page never offers either on the owner's own row.

function memberRef(tenantId: string, uid: string) {
  return doc(getDb(), "tenants", tenantId, "members", uid);
}

/** Everyone in the agency, by name. */
export async function listMembers(tenantId: string): Promise<Member[]> {
  const snapshot = await getDocs(collection(getDb(), "tenants", tenantId, "members"));
  return snapshot.docs
    .map((member) => {
      const data = member.data() as Record<string, unknown>;
      return {
        uid: asString(data.uid),
        role: asRole(data.role),
        email: asString(data.email),
        displayName: asString(data.displayName),
        joinedAt: asMillis(data.joinedAt),
      };
    })
    .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
}

export async function changeRole(tenantId: string, uid: string, role: MemberRole): Promise<void> {
  await updateDoc(memberRef(tenantId, uid), { role });
}

export async function removeMember(tenantId: string, uid: string): Promise<void> {
  await deleteDoc(memberRef(tenantId, uid));
}
