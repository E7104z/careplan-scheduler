import { useState } from "react";
import { Button } from "../../ui/Button";
import { signInWithGoogle } from "./authService";
import { errorMessage } from "./errors";

export interface GoogleSignInProps {
  /** A sentence to show, or null to clear it (a closed popup shows nothing). */
  onError: (message: string | null) => void;
  /** True while the sign-in and the first-time `users/{uid}` write are running. */
  onBusy: (busy: boolean) => void;
}

/** "Continue with Google" and the "or" divider above the email form (APP-SPEC 6.2). */
export function GoogleSignIn({ onError, onBusy }: GoogleSignInProps) {
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    onBusy(true);
    onError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };

  return (
    <div className="grid gap-5">
      <Button variant="secondary" className="w-full" busy={busy} onClick={() => void start()}>
        Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-[13px] text-ink-2">
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
        or
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
