import { useCallback } from "react";
import { useAuth } from "./authContext";
import { IdleDialog } from "./IdleDialog";
import { useIdleTimeout } from "./useIdleTimeout";

/**
 * APP-SPEC 6.5 for every signed-in screen: the warning at 28 minutes idle, then sign-out and
 * /sign-in?reason=timeout at 30. Quick Schedule's tab state isn't touched.
 */
export function SessionTimeout() {
  const { user, leaving, signOut } = useAuth();

  const onTimeout = useCallback(() => {
    // Sign-out only clears local state, so it doesn't fail in practice; if it did, the person
    // stays on the page and the next check runs when the shell remounts.
    void signOut("/sign-in?reason=timeout", { replace: true }).catch(() => undefined);
  }, [signOut]);

  const { secondsLeft, stay } = useIdleTimeout({ enabled: user !== null && !leaving, onTimeout });
  return <IdleDialog secondsLeft={secondsLeft} onStay={stay} />;
}
