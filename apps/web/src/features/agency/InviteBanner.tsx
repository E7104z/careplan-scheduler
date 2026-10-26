import { Link } from "react-router";
import { useAgency } from "./agencyContext";
import { roleWithArticle } from "./inviteFields";

/** Pending invites for the person's email, each with "Review invite" (APP-SPEC 6.4). */
export function InviteBanner() {
  const { state } = useAgency();
  if (state.myInvites.length === 0) return null;

  return (
    <section aria-labelledby="my-invites-heading" className="border-l-4 border-brand py-1 pl-4">
      <h2 id="my-invites-heading" className="text-[17px] font-bold text-ink">
        Invites for you
      </h2>
      <ul className="mt-2 grid gap-2">
        {state.myInvites.map((invite) => (
          <li key={invite.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-ink">
              {invite.tenantName} invited you to join as {roleWithArticle(invite.role)}.
            </span>
            <Link
              to={`/join/${invite.id}`}
              className="inline-flex min-h-8 items-center rounded-sm font-semibold text-brand underline-offset-2 hover:underline max-sm:min-h-11"
            >
              Review invite<span className="sr-only"> from {invite.tenantName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
