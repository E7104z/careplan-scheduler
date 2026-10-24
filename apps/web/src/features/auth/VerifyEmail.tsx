import { useEffect, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { useAuth } from "./authContext";
import { resendVerification } from "./authService";
import { errorMessage } from "./errors";
import { RequireAuth } from "./guards";
import { safeNext } from "./next";

const RESEND_WAIT_MS = 60_000;
const POLL_MS = 5_000;
const NOT_YET = "We don't see the verification yet. Open the link in the email, then try again.";

function justSent(state: unknown): boolean {
  return typeof state === "object" && state !== null && "sent" in state && state.sent === true;
}

function VerifyEmailPage() {
  const headingRef = usePageTitle("Check your email | CarePlan Scheduler");
  const { user, refresh, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const location = useLocation();
  // "Send the email again" waits 60 seconds after any send, including the one at sign-up.
  const [waiting, setWaiting] = useState(() => justSent(location.state));
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => setWaiting(false), RESEND_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  // Notice the verification on its own while this tab is in view.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh().catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (user?.emailVerified) return <Navigate to={next} replace />;

  const check = async () => {
    setChecking(true);
    setMessage(null);
    try {
      if (!(await refresh())) setMessage(NOT_YET);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    setMessage(null);
    setWaiting(true);
    try {
      await resendVerification();
      setMessage("We sent the email again.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  return (
    <div className="grid gap-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
        Check your email
      </h1>
      <p className="text-ink">
        We sent a link to <strong className="font-semibold">{user?.email}</strong>. Open it to verify your email, then
        come back here.
      </p>
      <div className="grid gap-3">
        <Button className="w-full" busy={checking} onClick={() => void check()}>
          I've verified my email
        </Button>
        <Button variant="secondary" className="w-full" disabled={waiting} onClick={() => void resend()}>
          Send the email again
        </Button>
      </div>
      <div role="status" aria-live="polite">
        {message ? <p className="text-sm text-ink">{message}</p> : null}
      </div>
      <p className="text-sm text-ink-2">
        Wrong email?{" "}
        <button
          type="button"
          className="rounded-sm font-semibold text-brand hover:underline"
          onClick={() => void signOut("/sign-up")}
        >
          Sign out and start again
        </button>
      </p>
    </div>
  );
}

/** APP-SPEC 6.2 Verify email (`/verify-email`), for a signed-in person whose email isn't verified yet. */
export function VerifyEmail() {
  return (
    <RequireAuth>
      <VerifyEmailPage />
    </RequireAuth>
  );
}
