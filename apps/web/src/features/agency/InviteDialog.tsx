import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Field } from "../../ui/Field";
import { TextInput } from "../../ui/TextInput";
import { errorMessage } from "../auth/errors";
import { niceInstant } from "./dates";
import { inviteLink, ROLE_OPTIONS, validateInviteEmail } from "./inviteFields";
import { InviteLink } from "./InviteLink";
import { createInvite } from "./invites";
import type { AuthActor, Invite, MemberRole } from "./types";

export interface InviteDialogProps {
  owner: AuthActor;
  tenantId: string;
  agencyName: string;
  memberEmails: string[];
  /** After an invite is created, so the pending invites table shows it. */
  onCreated: () => Promise<void>;
}

/** "Invite someone": email and role, then the link to send (APP-SPEC 6.4). */
export function InviteDialog({ owner, tenantId, agencyName, memberEmails, onCreated }: InviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("scheduler");
  const [emailProblem, setEmailProblem] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Invite | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const roleId = useId();

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setEmail("");
      setRole("scheduler");
      setEmailProblem(undefined);
      setFormError(null);
      setSaving(false);
      setCreated(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const problem = validateInviteEmail(email, memberEmails);
    if (problem) {
      setEmailProblem(problem);
      emailRef.current?.focus();
      return;
    }
    setEmailProblem(undefined);
    setSaving(true);
    try {
      const invite = await createInvite(owner, tenantId, agencyName, email.trim().toLowerCase(), role);
      setCreated(invite);
      await onCreated();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Invite someone"
      open={open}
      onOpenChange={openChange}
      trigger={<Button>Invite someone</Button>}
    >
      {created ? (
        <div className="grid gap-3">
          <p className="text-sm text-ink-2">
            Invite created for {created.email}. Send them this link. It expires on {niceInstant(created.expiresAt)}.
          </p>
          <InviteLink link={inviteLink(window.location.origin, created.id)} email={created.email} agencyName={agencyName} />
        </div>
      ) : (
        <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
          {formError ? (
            <p role="alert" className="text-sm text-block">
              {formError}
            </p>
          ) : null}
          <Field label="Email" required error={emailProblem}>
            <TextInput
              ref={emailRef}
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium text-ink-2">Role</legend>
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-3 rounded-sm border border-line px-3 py-2.5 has-[:checked]:border-brand has-[:checked]:bg-brand-tint"
              >
                <input
                  type="radio"
                  name="invite-role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  aria-labelledby={`${roleId}-${option.value}-label`}
                  aria-describedby={`${roleId}-${option.value}-hint`}
                  className="mt-1 h-4 w-4 accent-brand"
                />
                <span className="grid">
                  <span id={`${roleId}-${option.value}-label`} className="font-medium text-ink">
                    {option.label}
                  </span>
                  <span id={`${roleId}-${option.value}-hint`} className="text-[13px] text-ink-2">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            <Button type="submit" busy={saving}>
              Create invite
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
