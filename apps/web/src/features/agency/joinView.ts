import { niceInstant } from "./dates";
import { maskEmail } from "./inviteFields";
import type { Invite, MemberRole } from "./types";

/** What the Join page shows for an invite (APP-SPEC 6.4). */
export type JoinView =
  | { kind: "valid"; tenantName: string; role: MemberRole }
  | { kind: "wrong-email"; maskedEmail: string }
  | { kind: "expired"; date: string }
  | { kind: "inactive" }
  | { kind: "not-found" };

/**
 * `invite` is null when it doesn't exist or the rules hide it (an invite is readable only by
 * its invitee and the agency's owners, so a missing one and someone else's look the same).
 */
export function joinView(invite: Invite | null, myEmail: string, nowMs: number): JoinView {
  if (!invite) return { kind: "not-found" };
  if (invite.email !== myEmail.toLowerCase()) return { kind: "wrong-email", maskedEmail: maskEmail(invite.email) };
  if (invite.status !== "pending") return { kind: "inactive" };
  if (invite.expiresAt <= nowMs) return { kind: "expired", date: niceInstant(invite.expiresAt) };
  return { kind: "valid", tenantName: invite.tenantName, role: invite.role };
}
