import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { PageLoading } from "../../ui/PageLoading";
import { useToast } from "../../ui/ToastHost";
import { useAuth } from "../auth/authContext";
import { errorMessage } from "../auth/errors";
import { RequireAuth, RequireVerified } from "../auth/guards";
import { roleWithArticle } from "./inviteFields";
import { acceptInvite, getInvite } from "./invites";
import { joinView } from "./joinView";
import { setLastTenantId } from "./memberships";
import type { Invite } from "./types";

const secondaryLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-line-2 bg-surface px-4 font-semibold leading-none text-ink transition-colors hover:bg-sunk max-sm:min-h-11";

type Loaded = { status: "loading" } | { status: "loaded"; invite: Invite | null } | { status: "failed"; message: string };

/** `/join/:inviteId` (APP-SPEC 6.4): signed in and verified, else sign in and come back here. */
export function Join() {
  return (
    <RequireAuth>
      <RequireVerified>
        <JoinInvite />
      </RequireVerified>
    </RequireAuth>
  );
}

function JoinInvite() {
  const headingRef = usePageTitle("Accept invite | CarePlan Scheduler");
  const { inviteId = "" } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [joining, setJoining] = useState(false);
  const [joinProblem, setJoinProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoaded({ status: "loading" });
    getInvite(inviteId).then(
      (invite) => {
        if (live) setLoaded({ status: "loaded", invite });
      },
      (error: unknown) => {
        if (live) setLoaded({ status: "failed", message: errorMessage(error) ?? "" });
      },
    );
    return () => {
      live = false;
    };
  }, [inviteId]);

  if (!user) return null;
  const account = { uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified };
  const signInAgain = () => void signOut(`/sign-in?next=${encodeURIComponent(`/join/${inviteId}`)}`);

  const join = async (invite: Invite) => {
    setJoinProblem(null);
    setJoining(true);
    try {
      await acceptInvite(account, invite);
    } catch (error) {
      setJoinProblem(errorMessage(error));
      setJoining(false);
      return;
    }
    try {
      await setLastTenantId(account, invite.tenantId);
    } catch {
      // Joined already; without this, /app opens the person's first agency instead of this one.
    }
    toast(`Joined ${invite.tenantName}`);
    void navigate("/app");
  };

  const body = () => {
    if (loaded.status === "loading") return <PageLoading />;
    if (loaded.status === "failed") {
      return (
        <>
          <p role="alert" className="text-ink">
            {loaded.message}
          </p>
          <div>
            <Link to="/app" className={secondaryLink}>
              Go to Home
            </Link>
          </div>
        </>
      );
    }
    const invite = loaded.invite;
    const view = joinView(invite, user.email, Date.now());
    switch (view.kind) {
      case "valid":
        return (
          <>
            <p className="text-ink">
              {view.tenantName} invited you to join as {roleWithArticle(view.role)}.
            </p>
            {joinProblem ? (
              <p role="alert" className="text-sm text-block">
                {joinProblem}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button busy={joining} onClick={() => invite && void join(invite)}>
                Join {view.tenantName}
              </Button>
              <Button variant="secondary" onClick={() => void navigate("/app")}>
                Not now
              </Button>
            </div>
          </>
        );
      case "wrong-email":
        return (
          <>
            <p className="text-ink">
              This invite is for {view.maskedEmail}. Sign in with that email to accept it.
            </p>
            <div>
              <Button variant="secondary" onClick={signInAgain}>
                Sign in with another email
              </Button>
            </div>
          </>
        );
      case "expired":
        return (
          <>
            <p className="text-ink">This invite expired on {view.date}. Ask the agency owner for a new one.</p>
            <div>
              <Link to="/app" className={secondaryLink}>
                Go to Home
              </Link>
            </div>
          </>
        );
      case "inactive":
        return (
          <>
            <p className="text-ink">This invite is no longer active.</p>
            <div>
              <Link to="/app" className={secondaryLink}>
                Go to Home
              </Link>
            </div>
          </>
        );
      case "not-found":
        return (
          <>
            <p className="text-ink">
              We couldn't find an invite for {user.email} at this link. Sign in with the email the invite was sent to, or
              ask the agency owner for a new link.
            </p>
            <div>
              <Button variant="secondary" onClick={signInAgain}>
                Sign in with another email
              </Button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="grid gap-4">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
        Accept invite
      </h1>
      {body()}
    </div>
  );
}
