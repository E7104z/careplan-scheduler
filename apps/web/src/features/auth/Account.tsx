import { useRef, useState, type FormEvent } from "react";
import { getTheme, setTheme, type Theme } from "../../lib/theme";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Panel } from "../../ui/Panel";
import { TextInput } from "../../ui/TextInput";
import { useToast } from "../../ui/ToastHost";
import { useAuth } from "./authContext";
import { saveDisplayName, sendPasswordReset } from "./authService";
import { errorMessage } from "./errors";

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** `/app/account`: name, email, password reset, appearance and sign out (Prompt 8). */
export function Account() {
  const headingRef = usePageTitle("Your account | CarePlan Scheduler");
  const { user, refresh, signOut } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.displayName ?? "");
  const [nameProblem, setNameProblem] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [theme, setThemeChoice] = useState<Theme>(getTheme);
  const nameRef = useRef<HTMLInputElement>(null);

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setNameProblem("Enter your name.");
      nameRef.current?.focus();
      return;
    }
    setNameProblem(undefined);
    setSaving(true);
    try {
      await saveDisplayName(name.trim());
      await refresh();
      toast("Changes saved");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const sendReset = async () => {
    if (!user) return;
    setFormError(null);
    setSending(true);
    try {
      await sendPasswordReset(user.email);
      toast("Password reset email sent");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
        Your account
      </h1>

      {formError ? (
        <p role="alert" className="text-sm text-block">
          {formError}
        </p>
      ) : null}

      <Panel title="Profile">
        <form noValidate onSubmit={(event) => void saveName(event)} className="grid gap-4">
          <Field label="Name" error={nameProblem}>
            <TextInput
              ref={nameRef}
              autoComplete="name"
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Email" hint="The email you sign in with.">
            <TextInput type="email" readOnly value={user?.email ?? ""} />
          </Field>
          <div>
            <Button type="submit" busy={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </Panel>

      {user?.usesPassword ? (
        <Panel title="Password">
          <div className="grid gap-3">
            <p className="text-ink-2">We'll email you a link to choose a new password.</p>
            <div>
              <Button variant="secondary" busy={sending} onClick={() => void sendReset()}>
                Send password reset email
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel title="Appearance">
        <fieldset className="grid gap-2">
          <legend className="sr-only">Appearance</legend>
          {THEMES.map((option) => (
            <label key={option.value} className="flex min-h-11 items-center gap-3 text-ink">
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={theme === option.value}
                className="h-4 w-4 accent-brand"
                onChange={() => {
                  setThemeChoice(option.value);
                  setTheme(option.value);
                }}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </Panel>

      <div>
        <Button variant="secondary" onClick={() => void signOut("/", { state: { toast: "Signed out" } })}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
