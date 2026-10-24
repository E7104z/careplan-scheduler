import { useRef, useState } from "react";
import { usePageTitle } from "../../lib/usePageTitle";
import { Dialog } from "../../ui/Dialog";
import { useToast } from "../../ui/ToastHost";
import { useAuth } from "../auth/authContext";
import { errorMessage } from "../auth/errors";
import { useAgency } from "./agencyContext";
import { copyText } from "./clipboard";
import { inviteLink, ROLE_LABEL } from "./inviteFields";
import { InviteDialog } from "./InviteDialog";
import { InviteLink } from "./InviteLink";
import { revokeInvite } from "./invites";
import { changeRole, removeMember } from "./members";
import { memberActionsId, memberName, MembersTable } from "./MembersTable";
import { inviteCopyId, InvitesTable } from "./InvitesTable";
import { RemoveMemberDialog } from "./RemoveMemberDialog";
import type { Invite, Member, MemberRole } from "./types";

/** `/app/agency/members`: the team and its pending invites; owners manage both (APP-SPEC 6.4). */
export function Team() {
  const headingRef = usePageTitle("Team | CarePlan Scheduler");
  const { user } = useAuth();
  const { state, reload } = useAgency();
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [linkFor, setLinkFor] = useState<Invite | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  // Where focus goes when a dialog opened from a menu or a row closes.
  const returnFocusId = useRef<string | null>(null);

  const isOwner = state.role === "owner";
  const agencyName = state.tenant?.name ?? "";
  const tenantId = state.tenantId ?? "";
  if (!user) return null;
  const owner = { uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified };

  const run = async (action: () => Promise<void>, done: string): Promise<boolean> => {
    setProblem(null);
    try {
      await action();
    } catch (error) {
      setProblem(errorMessage(error));
      return false;
    }
    await reload();
    toast(done);
    return true;
  };

  const restoreFocus = (event: Event) => {
    event.preventDefault();
    const target = returnFocusId.current ? document.getElementById(returnFocusId.current) : null;
    (target ?? headingRef.current)?.focus();
  };

  const changeMemberRole = (member: Member, role: MemberRole) =>
    void run(() => changeRole(tenantId, member.uid, role), `Role changed to ${ROLE_LABEL[role]}`);

  const startRemove = (member: Member) => {
    returnFocusId.current = memberActionsId(member.uid);
    setRemoving(member);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const removed = await run(() => removeMember(tenantId, removing.uid), "Removed from team");
    // Their row is gone, so focus goes back to the page heading.
    if (removed) returnFocusId.current = null;
    setRemoving(null);
  };

  const copyLink = async (invite: Invite) => {
    if (await copyText(inviteLink(window.location.origin, invite.id))) {
      toast("Invite link copied");
      return;
    }
    returnFocusId.current = inviteCopyId(invite.id);
    setLinkFor(invite);
  };

  const revoke = async (invite: Invite) => {
    setRevokingId(invite.id);
    await run(() => revokeInvite(invite.id), "Invite revoked");
    setRevokingId(null);
  };

  return (
    <div className="mx-auto grid w-full max-w-[960px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
            Team
          </h1>
          <p className="mt-1 max-w-[64ch] text-ink-2">Everyone who can work in {agencyName || "your agency"}.</p>
        </div>
        {isOwner ? (
          <InviteDialog
            owner={owner}
            tenantId={tenantId}
            agencyName={agencyName}
            memberEmails={state.members.map((member) => member.email)}
            onCreated={reload}
          />
        ) : null}
      </div>
      {!isOwner ? <p className="text-ink-2">Only an owner can invite or remove people.</p> : null}
      {problem ? (
        <p role="alert" className="rounded-sm border border-line bg-sunk px-3.5 py-2.5 text-sm text-block">
          {problem}
        </p>
      ) : null}
      <section aria-labelledby="members-heading" className="grid gap-3">
        <h2 id="members-heading" className="text-[17px] font-bold text-ink">
          Members
        </h2>
        <MembersTable
          members={state.members}
          myUid={user.uid}
          canManage={isOwner}
          onChangeRole={changeMemberRole}
          onRemove={startRemove}
        />
      </section>
      {isOwner ? (
        <section aria-labelledby="invites-heading" className="grid gap-3">
          <h2 id="invites-heading" className="text-[17px] font-bold text-ink">
            Pending invites
          </h2>
          <InvitesTable
            invites={state.agencyInvites}
            busyId={revokingId}
            onCopy={(invite) => void copyLink(invite)}
            onRevoke={(invite) => void revoke(invite)}
          />
        </section>
      ) : null}
      <RemoveMemberDialog
        name={removing ? memberName(removing) : null}
        agencyName={agencyName}
        onConfirm={confirmRemove}
        onClose={() => setRemoving(null)}
        onCloseAutoFocus={restoreFocus}
      />
      <Dialog
        title="Invite link"
        open={linkFor !== null}
        onOpenChange={(open) => {
          if (!open) setLinkFor(null);
        }}
        onCloseAutoFocus={restoreFocus}
      >
        {linkFor ? (
          <InviteLink
            link={inviteLink(window.location.origin, linkFor.id)}
            email={linkFor.email}
            agencyName={agencyName}
            selectFirst
          />
        ) : null}
      </Dialog>
    </div>
  );
}
