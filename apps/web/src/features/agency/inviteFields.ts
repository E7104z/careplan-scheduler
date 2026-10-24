import type { MemberRole } from "./types";

// Pure rules and copy for invites (APP-SPEC 6.4), kept here so tests exercise them.

export const INVITE_DAYS = 14;

export const ROLE_LABEL: Readonly<Record<MemberRole, string>> = {
  owner: "Owner",
  scheduler: "Scheduler",
  viewer: "Viewer",
};

/** The invite dialog's choices, in the order shown (Scheduler is the default). */
export const ROLE_OPTIONS: ReadonlyArray<{ value: MemberRole; label: string; description: string }> = [
  { value: "scheduler", label: "Scheduler", description: "Builds and changes schedules" },
  { value: "viewer", label: "Viewer", description: "Can look but not change" },
  { value: "owner", label: "Owner", description: "Also manages agency details and the team" },
];

// The same shape firestore.rules requires of `invites.email`.
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The sentence for an email that can't be invited, or null when it's fine. */
export function validateInviteEmail(value: string, memberEmails: readonly string[]): string | null {
  const email = value.trim().toLowerCase();
  if (!EMAIL_SHAPE.test(email)) return "Enter an email address like name@agency.com.";
  if (memberEmails.some((member) => member.toLowerCase() === email)) return "That person is already on your team.";
  return null;
}

/** `<origin>/join/<id>`, the link an owner sends. */
export function inviteLink(origin: string, inviteId: string): string {
  return `${origin}/join/${inviteId}`;
}

/** "Open in my email app": to the invitee, subject "Join <agency> on CarePlan Scheduler", the link as the body. */
export function inviteMailto(email: string, agencyName: string, link: string): string {
  const to = encodeURIComponent(email).replace(/%40/g, "@");
  const subject = encodeURIComponent(`Join ${agencyName} on CarePlan Scheduler`);
  return `mailto:${to}?subject=${subject}&body=${encodeURIComponent(link)}`;
}

/** "a Scheduler", "a Viewer", "an Owner". */
export function roleWithArticle(role: MemberRole): string {
  return `${role === "owner" ? "an" : "a"} ${ROLE_LABEL[role]}`;
}

/** "jordan@example.com" → "j***@example.com". */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}
