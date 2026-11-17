import type { MemberRole, Tenant } from "./types";

// PHASE-3-SPEC section 6, worked out for the screen: what the person may do with saved
// participants and plans, and the one sentence that says why when they can't. Pure; no Firebase.

/**
 * "open": saving works. "needs-baa": an owner hasn't accepted the customer BAA. "storage-off":
 * the deployment's PHI storage isn't enabled (it waits on the Google Cloud BAA and the security
 * review, P3-10). "loading": the flag hasn't been read yet.
 */
export type StorageGate = "open" | "needs-baa" | "storage-off" | "loading";

export function storageGate(tenant: Tenant | null, phiStorage: boolean | null): StorageGate {
  if (!(tenant?.baaVersion ?? "")) return "needs-baa";
  if (phiStorage === null) return "loading";
  return phiStorage ? "open" : "storage-off";
}

/** Owners and schedulers save; viewers read (firestore.rules canWriteParticipants). */
export function canSave(role: MemberRole | null): boolean {
  return role === "owner" || role === "scheduler";
}

/** Only owners delete participants and plans (firestore.rules). */
export function canDelete(role: MemberRole | null): boolean {
  return role === "owner";
}

export const GATE_COPY: Record<Exclude<StorageGate, "open" | "loading">, { title: string; detail: string }> = {
  "needs-baa": {
    title: "Saving to your agency needs the business associate agreement",
    detail:
      "An owner accepts it once for the agency. Until then, use Save plan in Quick Schedule to keep an encrypted file on this computer.",
  },
  "storage-off": {
    title: "Saving to your agency isn't turned on yet",
    detail:
      "It turns on once our own agreement with Google Cloud and our security review are complete. Until then, use Save plan in Quick Schedule to keep an encrypted file on this computer.",
  },
};

export const VIEWER_NOTE = "You can open saved plans. An owner or scheduler saves and changes them.";

/** P3-08: an alias, never a DCN. Returns the problem to show, or null. */
export function participantNameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "Enter the name your agency uses for this participant.";
  if (trimmed.length > 120) return "Use 120 characters or fewer.";
  // A Missouri DCN is 8 digits; a name with 8 digits in a row is most likely one.
  if (/\d{8}/.test(trimmed.replace(/[\s-]/g, ""))) return "Leave the DCN out. Use a name or your agency's alias.";
  return null;
}
