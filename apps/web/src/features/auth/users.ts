import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDb } from "./firebase";

// APP-SPEC 7.2 `users/{uid}`: email (lowercase), displayName, createdAt, updatedAt, lastTenantId.
// firestore.rules (section 8) checks each write: the person's own doc, their own email, server times.

const NAME_LIMIT = 120;

function userRef(uid: string) {
  return doc(getDb(), "users", uid);
}

/** Creates `users/{uid}` (on sign-up, and on a first Google sign-in). */
export async function createUserDoc(uid: string, email: string, displayName: string): Promise<void> {
  await setDoc(userRef(uid), {
    email: email.toLowerCase(),
    displayName: displayName.slice(0, NAME_LIMIT),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Creates `users/{uid}` only if it's missing. */
export async function ensureUserDoc(uid: string, email: string, displayName: string): Promise<void> {
  const snapshot = await getDoc(userRef(uid));
  if (!snapshot.exists()) await createUserDoc(uid, email, displayName);
}

/** Saves a new name (or creates the doc with it, if sign-up never got that far). */
export async function saveUserName(uid: string, email: string, displayName: string): Promise<void> {
  const snapshot = await getDoc(userRef(uid));
  if (!snapshot.exists()) {
    await createUserDoc(uid, email, displayName);
    return;
  }
  await updateDoc(userRef(uid), { displayName: displayName.slice(0, NAME_LIMIT), updatedAt: serverTimestamp() });
}
