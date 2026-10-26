import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { TextInput } from "../../ui/TextInput";
import { sendPasswordReset } from "./authService";
import { errorMessage, errorMessageForCode } from "./errors";

const linkClass = "rounded-sm font-semibold text-brand hover:underline";
const SENT = "If an account uses that email, a reset link is on its way.";

/** APP-SPEC 6.2 Reset password (`/reset-password`): the same answer whether or not the account exists. */
export function ResetPassword() {
  const headingRef = usePageTitle("Reset password | CarePlan Scheduler");
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSent(false);
    if (!email.trim()) {
      setProblem(errorMessageForCode("auth/invalid-email") ?? undefined);
      emailRef.current?.focus();
      return;
    }
    setProblem(undefined);
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
        Reset your password
      </h1>
      <p className="text-ink-2">Enter the email you sign in with. We'll send a link to choose a new password.</p>

      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
        <Field label="Email" error={problem}>
          <TextInput
            ref={emailRef}
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <div role="status" aria-live="polite">
          {sent ? <p className="text-sm text-ink">{SENT}</p> : null}
        </div>
        {formError ? (
          <p role="alert" className="text-sm text-block">
            {formError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" busy={busy}>
          Send reset link
        </Button>
      </form>

      <Link to="/sign-in" className={`${linkClass} justify-self-start text-sm`}>
        Back to sign in
      </Link>
    </div>
  );
}
