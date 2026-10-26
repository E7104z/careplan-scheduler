import { describe, expect, it } from "vitest";
import { errorMessage, errorMessageForCode } from "../../src/features/auth/errors";

const FALLBACK = "That didn't work. Try again, and if it keeps happening, email support@thecdscloud.com.";

// APP-SPEC 6.6, row by row.
const TABLE: [string, string | null][] = [
  ["auth/invalid-credential", "That email and password don't match. Try again or reset your password."],
  ["auth/wrong-password", "That email and password don't match. Try again or reset your password."],
  ["auth/user-not-found", "That email and password don't match. Try again or reset your password."],
  ["auth/email-already-in-use", "An account already uses that email. Sign in instead."],
  ["auth/weak-password", "Use at least 12 characters."],
  ["auth/password-does-not-meet-requirements", "Use at least 12 characters."],
  ["auth/invalid-email", "Enter an email address like name@agency.com."],
  ["auth/too-many-requests", "Too many tries. Wait a few minutes, then try again."],
  ["auth/popup-closed-by-user", null],
  ["auth/network-request-failed", "You're offline. Check your connection and try again."],
  ["unavailable", "You're offline. Check your connection and try again."],
  ["permission-denied", "You don't have access to that. Ask your agency owner."],
];

describe("Firebase error copy (APP-SPEC 6.6)", () => {
  it.each(TABLE)("%s", (code, message) => {
    expect(errorMessageForCode(code)).toBe(message);
  });

  it("anything else gets the support sentence", () => {
    expect(errorMessageForCode("auth/internal-error")).toBe(FALLBACK);
    expect(errorMessageForCode("deadline-exceeded")).toBe(FALLBACK);
  });

  it("reads the code from an error, and an error without one gets the support sentence", () => {
    expect(errorMessage({ code: "auth/email-already-in-use", message: "Firebase: Error (auth/email-already-in-use)." })).toBe(
      "An account already uses that email. Sign in instead.",
    );
    expect(errorMessage(Object.assign(new Error("x"), { code: "permission-denied" }))).toBe(
      "You don't have access to that. Ask your agency owner.",
    );
    expect(errorMessage(new Error("boom"))).toBe(FALLBACK);
    expect(errorMessage("boom")).toBe(FALLBACK);
    expect(errorMessage(null)).toBe(FALLBACK);
  });
});
