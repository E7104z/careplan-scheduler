import { describe, expect, it } from "vitest";
import { chicagoDate, niceInstant } from "../src/features/agency/dates";
import {
  INVITE_DAYS,
  inviteLink,
  inviteMailto,
  maskEmail,
  roleWithArticle,
  validateInviteEmail,
} from "../src/features/agency/inviteFields";
import { joinView } from "../src/features/agency/joinView";
import type { Invite } from "../src/features/agency/types";

// 2026-11-03 12:00 America/Chicago (CST, UTC-6).
const NOV_3_NOON = Date.UTC(2026, 10, 3, 18, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

const INVITE: Invite = {
  id: "i-test-01",
  tenantId: "t-test-01",
  tenantName: "P-TEST-AGENCY-01",
  email: "p-test-01@example.com",
  role: "scheduler",
  status: "pending",
  expiresAt: NOV_3_NOON,
};

describe("invite fields (APP-SPEC 6.4)", () => {
  it("invites last 14 days", () => {
    expect(INVITE_DAYS).toBe(14);
  });

  it("asks for an email address like name@agency.com, the shape firestore.rules accepts", () => {
    const message = "Enter an email address like name@agency.com.";
    expect(validateInviteEmail("", [])).toBe(message);
    expect(validateInviteEmail("   ", [])).toBe(message);
    expect(validateInviteEmail("p-test-01", [])).toBe(message);
    expect(validateInviteEmail("p-test-01@example", [])).toBe(message);
    expect(validateInviteEmail("p test@example.com", [])).toBe(message);
    expect(validateInviteEmail(" P-Test-01@Example.com ", [])).toBeNull();
  });

  it("won't invite someone who is already on the team (their member doc blocks joining)", () => {
    expect(validateInviteEmail("P-TEST-02@example.com", ["p-test-02@example.com"])).toBe(
      "That person is already on your team.",
    );
  });

  it("builds the join link and the mailto with the subject and the link in the body", () => {
    const link = inviteLink("https://careplan.example", "i-test-01");
    expect(link).toBe("https://careplan.example/join/i-test-01");
    const mailto = inviteMailto("p-test-01@example.com", "P-TEST-AGENCY-01", link);
    expect(mailto.startsWith("mailto:p-test-01@example.com?")).toBe(true);
    const params = new URLSearchParams(mailto.slice(mailto.indexOf("?") + 1));
    expect(params.get("subject")).toBe("Join P-TEST-AGENCY-01 on CarePlan Scheduler");
    expect(params.get("body")).toBe(link);
  });

  it("names a role with its article", () => {
    expect(roleWithArticle("scheduler")).toBe("a Scheduler");
    expect(roleWithArticle("viewer")).toBe("a Viewer");
    expect(roleWithArticle("owner")).toBe("an Owner");
  });

  it("masks an address to its first letter and domain", () => {
    expect(maskEmail("jordan@example.com")).toBe("j***@example.com");
    expect(maskEmail("p-test-01@example.com")).toBe("p***@example.com");
  });
});

describe("Join page state", () => {
  const before = NOV_3_NOON - DAY_MS;
  const after = NOV_3_NOON + DAY_MS;

  it("a pending invite for my email, before it expires, can be joined", () => {
    expect(joinView(INVITE, "P-TEST-01@example.com", before)).toEqual({
      kind: "valid",
      tenantName: "P-TEST-AGENCY-01",
      role: "scheduler",
    });
  });

  it("an invite for another email shows that address masked", () => {
    expect(joinView({ ...INVITE, email: "jordan@example.com" }, "p-test-01@example.com", before)).toEqual({
      kind: "wrong-email",
      maskedEmail: "j***@example.com",
    });
  });

  it("an expired invite shows its date in Central time", () => {
    expect(joinView(INVITE, "p-test-01@example.com", after)).toEqual({ kind: "expired", date: "Nov 3, 2026" });
  });

  it("revoked and accepted invites are no longer active", () => {
    expect(joinView({ ...INVITE, status: "revoked" }, "p-test-01@example.com", before)).toEqual({ kind: "inactive" });
    expect(joinView({ ...INVITE, status: "accepted" }, "p-test-01@example.com", before)).toEqual({ kind: "inactive" });
  });

  it("a missing (or hidden) invite is not found", () => {
    expect(joinView(null, "p-test-01@example.com", before)).toEqual({ kind: "not-found" });
  });
});

describe("dates in Central time", () => {
  it("uses the America/Chicago calendar day, not UTC's", () => {
    // 2026-11-04 03:00 UTC is still Nov 3 in Chicago.
    expect(chicagoDate(Date.UTC(2026, 10, 4, 3, 0))).toBe("2026-11-03");
    expect(niceInstant(Date.UTC(2026, 10, 4, 3, 0))).toBe("Nov 3, 2026");
    expect(niceInstant(Date.UTC(2026, 0, 9, 18, 0))).toBe("Jan 9, 2026");
  });
});
