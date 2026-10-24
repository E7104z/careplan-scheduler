import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, type NavigateOptions } from "react-router";
import { AuthContext, type AuthContextValue, type AuthUser } from "./authContext";
import { reloadCurrentUser, signOutUser, watchAuth } from "./authService";

interface Session {
  user: AuthUser | null;
  loading: boolean;
}

/** Holds the signed-in person for every signed-in screen (APP-SPEC 6). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ user: null, loading: true });
  const navigate = useNavigate();
  const location = useLocation();

  // "Leaving" lasts while the page where sign-out started is still showing. React Router
  // applies navigation as a transition, so a flag cleared after `navigate()` could render the
  // old page signed out (and bounce it to /sign-in); tying it to the history entry can't.
  const [leavingFrom, setLeavingFrom] = useState<string | null>(null);
  const locationKey = useRef(location.key);
  useEffect(() => {
    locationKey.current = location.key;
    setLeavingFrom((from) => (from !== null && from !== location.key ? null : from));
  }, [location.key]);
  const leaving = leavingFrom !== null && leavingFrom === location.key;

  useEffect(() => watchAuth((user) => setSession({ user, loading: false })), []);

  const refresh = useCallback(async () => {
    const user = await reloadCurrentUser();
    setSession((current) => ({ ...current, user }));
    return user?.emailVerified ?? false;
  }, []);

  const signOut = useCallback(
    async (to: string, options?: NavigateOptions) => {
      setLeavingFrom(locationKey.current);
      try {
        await signOutUser();
      } catch (error) {
        setLeavingFrom(null);
        throw error;
      }
      await navigate(to, options);
    },
    [navigate],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.user,
      loading: session.loading,
      emailVerified: session.user?.emailVerified ?? false,
      leaving,
      signOut,
      refresh,
    }),
    [session, leaving, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
