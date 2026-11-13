import { Timestamp } from "firebase/firestore";
import type { InviteStatus, MemberRole, Tenant } from "./types";

// Reading Firestore document fields defensively: a field of the wrong type gets a safe default.

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asRole(value: unknown): MemberRole {
  return value === "owner" || value === "scheduler" || value === "viewer" ? value : "viewer";
}

export function asStatus(value: unknown): InviteStatus {
  return value === "pending" || value === "accepted" ? value : "revoked";
}

/** A Timestamp as epoch ms; null while a serverTimestamp is still pending. */
export function asMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

/** A tenant document read defensively: BAA timestamps become epoch ms, strings get safe defaults. */
export function asTenant(data: Record<string, unknown>): Tenant {
  return {
    name: asString(data.name),
    state: asString(data.state),
    timeZone: asString(data.timeZone),
    workweekStart: typeof data.workweekStart === "number" ? data.workweekStart : 0,
    baaVersion: asString(data.baaVersion),
    baaAcceptedBy: asString(data.baaAcceptedBy),
    baaAcceptedAt: asMillis(data.baaAcceptedAt),
  };
}
