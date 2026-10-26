import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Panel } from "../../ui/Panel";
import { Select } from "../../ui/Select";
import { TextInput } from "../../ui/TextInput";
import { useToast } from "../../ui/ToastHost";
import { useAuth } from "../auth/authContext";
import { errorMessage } from "../auth/errors";
import { useAgency } from "./agencyContext";
import { validateAgencyName, WORKWEEK_HINT, WORKWEEK_OPTIONS } from "./agencyFields";
import { InviteBanner } from "./InviteBanner";
import { createAgency } from "./tenants";

/**
 * `/app/new-agency`: the one-time set-up that creates the founding tenant (APP-SPEC 6.3). Someone
 * invited to an agency sees the invite banner above the form (6.4).
 */
export function NewAgency() {
  const headingRef = usePageTitle("Set up your agency | CarePlan Scheduler");
  const { user } = useAuth();
  const { reload } = useAgency();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState("");
  const [workweekStart, setWorkweekStart] = useState(0);
  const [nameProblem, setNameProblem] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const problem = validateAgencyName(name);
    if (problem) {
      setNameProblem(problem);
      nameRef.current?.focus();
      return;
    }
    setNameProblem(undefined);
    if (!user) return;
    setSaving(true);
    try {
      await createAgency(
        { uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified },
        name.trim(),
        workweekStart,
      );
      await reload();
      toast("Agency set up");
      navigate("/app");
    } catch (error) {
      setFormError(errorMessage(error));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
          Set up your agency
        </h1>
        <p className="mt-1 max-w-[64ch] text-ink-2">
          Tell us a little about your agency. Missouri and Central time are fixed for everyone right now.
        </p>
      </div>
      <InviteBanner />
      {formError ? (
        <p role="alert" className="rounded-sm border border-line bg-sunk px-3.5 py-2.5 text-sm text-block">
          {formError}
        </p>
      ) : null}
      <Panel title="Agency details">
        <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
          <Field label="Agency name" required error={nameProblem}>
            <TextInput
              ref={nameRef}
              value={name}
              maxLength={120}
              autoComplete="organization"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Workweek starts on" hint={WORKWEEK_HINT}>
            <Select value={workweekStart} onChange={(event) => setWorkweekStart(Number(event.target.value))}>
              {WORKWEEK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="State">
            <TextInput readOnly value="Missouri" />
          </Field>
          <Field label="Time zone">
            <TextInput readOnly value="Central (America/Chicago)" />
          </Field>
          <div>
            <Button type="submit" busy={saving}>
              Set up agency
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
