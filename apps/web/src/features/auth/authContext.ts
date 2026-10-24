import { createContext, useContext } from "react";
import type { NavigateOptions } from "react-router";

/** The signed-in person, as the screens need them (never the Firebase SDK object). */
export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  /** Signs in with email and password (so "Send password reset email" applies). */
  usesPassword: boolean;
}

export interface AuthContextValue {
  user: AuthUser | null;
  /** True until Firebase reports the saved session (or none). */
  loading: boolean;
  emailVerified: boolean;
  /** True from "Sign out" until the page has moved on, so the guards don't bounce to /sign-in. */
  leaving: boolean;
  /** Signs out, then goes to `to` (APP-SPEC 6.2: "/" with the toast; 6.5: /sign-in?reason=timeout). */
  signOut: (to: string, options?: NavigateOptions) => Promise<void>;
  /** Reloads the person from Firebase (after verifying their email); resolves to emailVerified. */
  refresh: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth needs an AuthProvider above it");
  return value;
}
