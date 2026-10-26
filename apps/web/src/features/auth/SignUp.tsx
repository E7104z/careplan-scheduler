import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { TextInput } from "../../ui/TextInput";
import { finishGoogleRedirect, signUpWithEmail } from "./authService";
import { errorMessage, errorMessageForCode } from "./errors";
import { GoogleSignIn } from "./GoogleSignIn";
import { RedirectSignedIn } from "./guards";
import { PasswordInput } from "./PasswordInput";

const linkClass = "rounded-sm font-semibold text-brand hover:underline";
const MIN_PASSWORD = 12;
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Problems {
  name?: string;
  email?: string;
  password?: string;
}

function SignUpPage({ onHold }: { onHold: (hold: boolean) => void }) {
  const headingRef = usePageTitle("Create account | CarePlan Scheduler");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problems, setProblems] = useState<Problems>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    finishGoogleRedirect().catch((error: unknown) => setFormError(errorMessage(error)));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Problems = {
      name: name.trim() ? undefined : "Enter your name.",
      email: EMAIL_SHAPE.test(email.trim()) ? undefined : (errorMessageForCode("auth/invalid-email") ?? undefined),
      password:
        password.length >= MIN_PASSWORD ? undefined : (errorMessageForCode("auth/weak-password") ?? undefined),
    };
    setProblems(found);
    setFormError(null);
    if (found.name) return nameRef.current?.focus();
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    // Hold the page until every step is done; the account exists after the first one.
    setBusy(true);
    onHold(true);
    try {
      await signUpWithEmail(name.trim(), email, password);
      const verify = next ? `/verify-email?next=${encodeURIComponent(next)}` : "/verify-email";
      await navigate(verify, { replace: true, state: { sent: true } });
    } catch (error) {
      setFormError(errorMessage(error));
      setBusy(false);
      onHold(false);
    }
  };

  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="grid gap-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
        Create account
      </h1>

      <GoogleSignIn onError={setFormError} onBusy={onHold} />

      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
        <Field label="Your name" error={problems.name}>
          <TextInput
            ref={nameRef}
            autoComplete="name"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Work email" error={problems.email}>
          <TextInput
            ref={emailRef}
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" hint="At least 12 characters" error={problems.password}>
          <PasswordInput
            ref={passwordRef}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {formError ? (
          <p role="alert" className="text-sm text-block">
            {formError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" busy={busy}>
          Create account
        </Button>
      </form>

      <p className="text-sm text-ink-2">
        Already have an account?{" "}
        <Link to={`/sign-in${nextQuery}`} className={linkClass}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

/** APP-SPEC 6.2 Create account (`/sign-up`). */
export function SignUp() {
  const [hold, setHold] = useState(false);
  return (
    <RedirectSignedIn hold={hold}>
      <SignUpPage onHold={setHold} />
    </RedirectSignedIn>
  );
}
