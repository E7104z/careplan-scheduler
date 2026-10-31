import { Check, Circle } from "lucide-react";
import { Link } from "react-router";
import { useAgency } from "../features/agency/agencyContext";
import { InviteBanner } from "../features/agency/InviteBanner";
import { useAuth } from "../features/auth/authContext";
import { readJson } from "../lib/storage";
import { usePageTitle } from "../lib/usePageTitle";

const primaryLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-brand px-4 font-semibold leading-none text-brand-on transition-colors hover:bg-brand-hover max-sm:min-h-11";

interface ChecklistItem {
  to: string;
  label: string;
  done: boolean;
}

/** `/app`: a greeting, the current agency, invites for me, and a set-up checklist from real data. */
export function Home() {
  const headingRef = usePageTitle("Home | CarePlan Scheduler");
  const { user } = useAuth();
  const { state } = useAgency();
  const firstName = (user?.displayName ?? "").trim().split(/\s+/)[0] || "there";
  const agencyName = state.tenant?.name ?? "";
  const invitedSomeone = state.members.length > 1 || state.agencyInvites.length > 0;
  // Quick Schedule saves its plan under one of these keys once it has one in this tab (APP-SPEC 5.6, 5.8).
  const triedQuick = readJson<unknown>("session", "cps.quick.v3") !== null || readJson<unknown>("session", "cps.quick.v2") !== null;

  const checklist: ChecklistItem[] = [
    { to: "/app/agency/members", label: "Invite your team", done: invitedSomeone },
    { to: "/app/quick", label: "Try Quick Schedule", done: triedQuick },
  ];

  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
          Hi {firstName}
        </h1>
        {agencyName ? <p className="mt-1 text-ink-2">{agencyName}</p> : null}
      </div>
      <InviteBanner />
      <div>
        <Link to="/app/quick" className={primaryLink}>
          Start a Quick Schedule
        </Link>
      </div>
      <section aria-labelledby="ready-heading">
        <h2 id="ready-heading" className="text-[17px] font-bold text-ink">
          Get your agency ready
        </h2>
        <ul className="mt-3 grid gap-1">
          {checklist.map((item) => (
            <li key={item.to} className="flex items-center gap-2.5 rounded-sm px-1 py-1.5">
              {item.done ? (
                <Check className="h-4 w-4 flex-none text-brand" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 flex-none text-ink-3" aria-hidden="true" />
              )}
              <Link to={item.to} className="rounded-sm font-medium text-brand hover:underline">
                {item.label}
              </Link>
              <span className="sr-only">{item.done ? "Done" : "To do"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
