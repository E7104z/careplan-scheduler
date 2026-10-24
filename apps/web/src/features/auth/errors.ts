// APP-SPEC 6.6: every Firebase error a person can see, in plain words.

const SUPPORT = "That didn't work. Try again, and if it keeps happening, email support@thecdscloud.com.";
const NO_MATCH = "That email and password don't match. Try again or reset your password.";
const OFFLINE = "You're offline. Check your connection and try again.";
const PASSWORD_RULE = "Use at least 12 characters.";

/** A code that maps to `null` shows nothing: the person is back at the form. */
const MESSAGES: Record<string, string | null> = {
  "auth/invalid-credential": NO_MATCH,
  "auth/wrong-password": NO_MATCH,
  "auth/user-not-found": NO_MATCH,
  "auth/email-already-in-use": "An account already uses that email. Sign in instead.",
  "auth/weak-password": PASSWORD_RULE,
  "auth/password-does-not-meet-requirements": PASSWORD_RULE,
  "auth/invalid-email": "Enter an email address like name@agency.com.",
  "auth/too-many-requests": "Too many tries. Wait a few minutes, then try again.",
  "auth/popup-closed-by-user": null,
  "auth/network-request-failed": OFFLINE,
  unavailable: OFFLINE,
  "permission-denied": "You don't have access to that. Ask your agency owner.",
};

export function errorMessageForCode(code: string): string | null {
  return code in MESSAGES ? (MESSAGES[code] ?? null) : SUPPORT;
}

/** The sentence for a thrown Firebase error (its `code`); anything without a code gets the support line. */
export function errorMessage(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return errorMessageForCode(error.code);
  }
  return SUPPORT;
}

/** The error's code, for the few places that act on one (the Google popup being blocked). */
export function errorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return null;
}
