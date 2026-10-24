import { useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { PageLoading } from "../../ui/PageLoading";
import { useAgency } from "./agencyContext";

/** Shown in place of a page when the agency data didn't load, with the way to fix it. */
function AgencyLoadProblem({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  const headingRef = usePageTitle("We couldn't load your agency | CarePlan Scheduler");
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };

  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-4 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
        We couldn't load your agency
      </h1>
      <p role="alert" className="text-ink-2">
        {message}
      </p>
      <div>
        <Button busy={retrying} onClick={() => void retry()}>
          Try again
        </Button>
      </div>
    </div>
  );
}

/**
 * A member-only page: no membership → /app/new-agency, which lists any pending invites above the
 * set-up form, so an invited person picks between joining and setting up (APP-SPEC 3 and 6.4).
 */
export function RequireMembership({ children }: { children: ReactNode }) {
  const { ready, error, state, reload } = useAgency();
  if (!ready) return <PageLoading />;
  if (error) return <AgencyLoadProblem message={error} onRetry={reload} />;
  if (state.memberships.length === 0) return <Navigate to="/app/new-agency" replace />;
  return children;
}

/** The set-up page is only for a verified person without an agency. */
export function RequireNoMembership({ children }: { children: ReactNode }) {
  const { ready, error, state, reload } = useAgency();
  if (!ready) return <PageLoading />;
  if (error) return <AgencyLoadProblem message={error} onRetry={reload} />;
  if (state.memberships.length > 0) return <Navigate to="/app" replace />;
  return children;
}
