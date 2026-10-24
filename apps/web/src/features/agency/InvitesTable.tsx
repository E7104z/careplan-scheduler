import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { niceInstant } from "./dates";
import { ROLE_LABEL } from "./inviteFields";
import type { Invite } from "./types";

const cell = "px-5 py-3 max-sm:px-4";

/** The id of an invite's "Copy link" button, so focus can return to it after a dialog. */
export function inviteCopyId(inviteId: string): string {
  return `invite-copy-${inviteId}`;
}

export interface InvitesTableProps {
  invites: Invite[];
  busyId: string | null;
  onCopy: (invite: Invite) => void;
  onRevoke: (invite: Invite) => void;
}

/** Pending invites: email, role, expires, "Copy link", "Revoke" (APP-SPEC 6.4; owners only). */
export function InvitesTable({ invites, busyId, onCopy, onRevoke }: InvitesTableProps) {
  if (invites.length === 0) {
    return <EmptyState title="Invites you create show here until someone joins or the invite expires." />;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table aria-label="Pending invites" className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-sunk text-ink-2">
            <th scope="col" className={`${cell} font-medium`}>
              Email
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              Role
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              Expires
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invites.map((invite) => (
            <tr key={invite.id} className="border-b border-line last:border-b-0">
              <th scope="row" className={`${cell} font-medium text-ink`}>
                {invite.email}
              </th>
              <td className={`${cell} text-ink`}>{ROLE_LABEL[invite.role]}</td>
              <td className={`${cell} whitespace-nowrap text-ink-2`}>{niceInstant(invite.expiresAt)}</td>
              <td className={cell}>
                <div className="flex justify-end gap-2">
                  <Button id={inviteCopyId(invite.id)} variant="secondary" size="sm" onClick={() => onCopy(invite)}>
                    Copy link<span className="sr-only"> for {invite.email}</span>
                  </Button>
                  <Button variant="quiet" size="sm" busy={busyId === invite.id} onClick={() => onRevoke(invite)}>
                    Revoke<span className="sr-only"> invite for {invite.email}</span>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
