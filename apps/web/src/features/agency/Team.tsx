import { usePageTitle } from "../../lib/usePageTitle";
import { useAgency } from "./agencyContext";

const roleLabel = { owner: "Owner", scheduler: "Scheduler", viewer: "Viewer" } as const;

/** `/app/agency/members`: the agency's members. Prompt 10 adds pending invites and actions. */
export function Team() {
  const headingRef = usePageTitle("Team | CarePlan Scheduler");
  const { state } = useAgency();

  return (
    <div className="mx-auto grid w-full max-w-[960px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
          Team
        </h1>
        <p className="mt-1 max-w-[64ch] text-ink-2">Everyone who can work in {state.tenant?.name ?? "your agency"}.</p>
      </div>
      <section aria-label="Members" className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-ink-3">
              <th scope="col" className="px-5 py-3 font-medium max-sm:px-4">
                Name
              </th>
              <th scope="col" className="px-5 py-3 font-medium max-sm:px-4">
                Email
              </th>
              <th scope="col" className="px-5 py-3 font-medium max-sm:px-4">
                Role
              </th>
              <th scope="col" className="px-5 py-3 font-medium max-sm:px-4">
                Joined
              </th>
            </tr>
          </thead>
          <tbody>
            {state.members.map((member) => (
              <tr key={member.uid} className="border-b border-line last:border-b-0">
                <td className="px-5 py-3 text-ink max-sm:px-4">{member.displayName}</td>
                <td className="px-5 py-3 text-ink-2 max-sm:px-4">{member.email}</td>
                <td className="px-5 py-3 text-ink max-sm:px-4">{roleLabel[member.role]}</td>
                <td className="px-5 py-3 text-ink-2 max-sm:px-4">{member.joinedAt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
