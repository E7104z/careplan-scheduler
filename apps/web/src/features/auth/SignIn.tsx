import { useEffect, useRef, useState, type FormEvent } from "react";
import { Info } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { TextInput } from "../../ui/TextInput";
import { finishGoogleRedirect, signInWithEmail } from "./authService";
import { errorMessage, errorMessageForCode } from "./errors";
import { GoogleSignIn } from "./GoogleSignIn";
import { RedirectSignedIn } from "./guards";
import { PasswordInput } from "./PasswordInput";

const linkClass = "rounded-sm font-semibold text-brand hover:underline";

interface Problems {
  email?: string;
  password?: string;
}

function SignInPage({ onHold }: { onHold: (hold: boolean) => void }) {
  const headingRef = usePageTitle("Sign in | CarePlan Scheduler");
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const timedOut = searchParams.get("reason") === "timeout";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problems, setProblems] = useState<Problems>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    finishGoogleRedirect().catch((error: unknown) => setFormError(errorMessage(error)));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Problems = {
      email: email.trim() ? undefined : (errorMessageForCode("auth/invalid-email") ?? undefined),
      password: password ? undefined : "Enter your password.",
    };
    setProblems(found);
    setFormError(null);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    setBusy(true);
    try {
      // On success the session changes and RedirectSignedIn takes the person on to `next`.
      await signInWithEmail(email, password);
    } catch (error) {
      setFormError(errorMessage(error));
      setBusy(false);
    }
  };

  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="grid gap-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
        Sign in
      </h1>
      {timedOut ? (
        <p role="note" className="flex items-start gap-2.5 rounded-sm bg-info-bg px-3.5 py-2.5 text-sm text-ink">
          <Info className="mt-0.5 h-4 w-4 flex-none text-info" aria-hidden="true" />
          You were signed out after 30 minutes without activity.
        </p>
      ) : null}

      <GoogleSignIn onError={setFormError} onBusy={onHold} />

      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
        <Field label="Email" error={problems.email}>
          <TextInput
            ref={emailRef}
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" error={problems.password}>
          <PasswordInput
            ref={passwordRef}
            autoComplete="current-password"
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
          Sign in
        </Button>
      </form>

      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <Link to="/reset-password" className={linkClass}>
          Forgot password?
        </Link>
        <Link to={`/sign-up${nextQuery}`} className={linkClass}>
          Create an account
        </Link>
      </div>
    </div>
  );
}

/** APP-SPEC 6.2 Sign in (`/sign-in`). Someone already signed in goes on to `next` or /app. */
export function SignIn() {
  const [hold, setHold] = useState(false);
  return (
    <RedirectSignedIn hold={hold}>
      <SignInPage onHold={setHold} />
    </RedirectSignedIn>
  );
}
