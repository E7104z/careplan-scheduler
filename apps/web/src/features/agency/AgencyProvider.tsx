import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { useAuth, type AuthUser } from "../auth/authContext";
import { errorMessage } from "../auth/errors";
import { AgencyContext } from "./agencyContext";
import { loadAgencyData, setLastTenantId } from "./memberships";
import { agencyInitialState, agencyReducer, type AuthActor } from "./types";

function toActor(user: AuthUser | null): AuthActor | null {
  if (!user) return null;
  return { uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified };
}

/**
 * Loads the signed-in person's agencies once and holds the current one for the shell. A failed
 * load never throws: it keeps the last good state and sets `error`, so a member who is offline
 * sees how to fix it rather than being sent to set up a new agency.
 */
export function AgencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(agencyReducer, agencyInitialState());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  const reload = useCallback(async () => {
    const actor = toActor(user);
    if (!actor) return;
    const id = ++runId.current;
    try {
      const next = await loadAgencyData(actor);
      if (runId.current === id) {
        dispatch({ type: "loaded", state: next });
        setError(null);
      }
    } catch (problem) {
      if (runId.current === id) setError(errorMessage(problem));
    } finally {
      if (runId.current === id) setReady(true);
    }
  }, [user]);

  useEffect(() => {
    if (!toActor(user)) {
      runId.current += 1;
      dispatch({ type: "reset" });
      setError(null);
      setReady(false);
      return;
    }
    setReady(false);
    void reload();
  }, [reload]);

  const switchAgency = useCallback(
    async (tenantId: string) => {
      const actor = toActor(user);
      if (!actor) return;
      try {
        await setLastTenantId(actor, tenantId);
      } catch (problem) {
        setError(errorMessage(problem));
        return;
      }
      await reload();
    },
    [reload, user],
  );

  return (
    <AgencyContext.Provider value={{ state, ready, error, reload, switchAgency }}>
      {children}
    </AgencyContext.Provider>
  );
}
