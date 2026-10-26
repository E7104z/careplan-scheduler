import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import type { AuthUser } from "./authContext";
import { errorCode } from "./errors";
import { getAuthInstance } from "./firebase";
import { markActive } from "./useIdleTimeout";
import { createUserDoc, ensureUserDoc, saveUserName } from "./users";

// The only module the auth screens call for Firebase Auth (.clinerules 21). Errors are thrown as
// Firebase raised them; screens turn them into words with errors.ts.

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    emailVerified: user.emailVerified,
    usesPassword: user.providerData.some((provider) => provider.providerId === "password"),
  };
}

function currentUser(): User {
  const user = getAuthInstance().currentUser;
  if (!user) throw Object.assign(new Error("Not signed in"), { code: "auth/no-current-user" });
  return user;
}

/** Calls back with the person now signed in (or null), now and on every change. Returns unsubscribe. */
export function watchAuth(callback: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(getAuthInstance(), (user) => callback(user ? toAuthUser(user) : null));
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  // A fresh sign-in starts the 30 idle minutes now, not from an old session's last activity.
  markActive();
  await signInWithEmailAndPassword(getAuthInstance(), email.trim(), password);
}

/** APP-SPEC 6.2 Create account: the account, its name, the verification email, then `users/{uid}`. */
export async function signUpWithEmail(name: string, email: string, password: string): Promise<void> {
  markActive();
  const { user } = await createUserWithEmailAndPassword(getAuthInstance(), email.trim(), password);
  await updateProfile(user, { displayName: name });
  await sendEmailVerification(user);
  await createUserDoc(user.uid, user.email ?? email.trim(), name);
}

/**
 * "Continue with Google": a popup, or a full-page redirect when the browser blocks popups.
 * Creates `users/{uid}` the first time.
 */
export async function signInWithGoogle(): Promise<void> {
  markActive();
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  try {
    const { user } = await signInWithPopup(auth, provider);
    await ensureUserDoc(user.uid, user.email ?? "", user.displayName ?? "");
  } catch (error) {
    if (errorCode(error) !== "auth/popup-blocked") throw error;
    await signInWithRedirect(auth, provider);
  }
}

/** After a Google redirect comes back: creates `users/{uid}` the first time. */
export async function finishGoogleRedirect(): Promise<void> {
  const result = await getRedirectResult(getAuthInstance());
  if (result) await ensureUserDoc(result.user.uid, result.user.email ?? "", result.user.displayName ?? "");
}

/** No account enumeration: the screen says the same thing whether or not the account exists. */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getAuthInstance(), email.trim());
  } catch (error) {
    if (errorCode(error) !== "auth/user-not-found") throw error;
  }
}

export async function resendVerification(): Promise<void> {
  await sendEmailVerification(currentUser());
}

/**
 * Reloads the person from Firebase. Once their email is verified, the ID token is refreshed too,
 * so Firestore's rules (which read `email_verified` from the token) see it straight away.
 */
export async function reloadCurrentUser(): Promise<AuthUser | null> {
  const user = getAuthInstance().currentUser;
  if (!user) return null;
  await user.reload();
  if (user.emailVerified) await user.getIdToken(true);
  return toAuthUser(user);
}

/** Your account → name: the Auth profile and `users/{uid}`. */
export async function saveDisplayName(name: string): Promise<void> {
  const user = currentUser();
  await updateProfile(user, { displayName: name });
  await saveUserName(user.uid, user.email ?? "", name);
}

export async function signOutUser(): Promise<void> {
  await signOut(getAuthInstance());
}
