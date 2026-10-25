import { Ellipsis } from "lucide-react";
import { Button } from "../../ui/Button";
import { Menu, type MenuItem } from "../../ui/Menu";
import { niceInstant } from "./dates";
import { ROLE_LABEL } from "./inviteFields";
import type { Member, MemberRole } from "./types";

const cell = "px-5 py-3 max-sm:px-4";
const ROLES: MemberRole[] = ["owner", "scheduler", "viewer"];

export function memberName(member: Member): string {
  return member.displayName || member.email;
}

/** The id of a member's actions button, so focus can return to it after a dialog. */
export function memberActionsId(uid: string): string {
  return `member-actions-${uid}`;
}

export interface MembersTableProps {
  members: Member[];
  myUid: string;
  /** Owners get a menu on everyone else's row; nobody gets one on their own. */
  canManage: boolean;
  onChangeRole: (member: Member, role: MemberRole) => void;
  onRemove: (member: Member) => void;
}

/** Team members: name, email, role, joined (APP-SPEC 6.4). */
export function MembersTable({ members, myUid, canManage, onChangeRole, onRemove }: MembersTableProps) {
  const actionsFor = (member: Member): MenuItem[] => [
    ...ROLES.filter((role) => role !== member.role).map((role) => ({
      label: `Make ${ROLE_LABEL[role].toLowerCase()}`,
      onSelect: () => onChangeRole(member, role),
    })),
    { label: "Remove from team", destructive: true, onSelect: () => onRemove(member) },
  ];

  return (
    <div className="relative overflow-x-auto rounded-md border border-line bg-surface">
      <table aria-label="Members" className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-sunk text-ink-2">
            <th scope="col" className={`${cell} font-medium`}>
              Name
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              Email
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              Role
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              Joined
            </th>
            {canManage ? (
              <th scope="col" className={`${cell} font-medium`}>
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.uid} className="border-b border-line last:border-b-0">
              <th scope="row" className={`${cell} font-medium text-ink`}>
                {memberName(member)}
              </th>
              <td className={`${cell} text-ink-2`}>{member.email}</td>
              <td className={`${cell} text-ink`}>{ROLE_LABEL[member.role]}</td>
              <td className={`${cell} whitespace-nowrap text-ink-2`}>
                {member.joinedAt === null ? "Just now" : niceInstant(member.joinedAt)}
              </td>
              {canManage ? (
                <td className={`${cell} text-right`}>
                  {member.uid === myUid ? null : (
                    <Menu
                      trigger={
                        <Button id={memberActionsId(member.uid)} variant="quiet" size="sm">
                          <Ellipsis className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Actions for {memberName(member)}</span>
                        </Button>
                      }
                      items={actionsFor(member)}
                    />
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
