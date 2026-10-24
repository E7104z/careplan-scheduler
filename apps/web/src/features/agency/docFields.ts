import { Timestamp } from "firebase/firestore";
import type { InviteStatus, MemberRole } from "./types";

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
