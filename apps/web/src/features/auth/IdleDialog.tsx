import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";

function clock(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export interface IdleDialogProps {
  /** Seconds until sign-out; null hides the dialog. */
  secondsLeft: number | null;
  onStay: () => void;
}

/** APP-SPEC 6.5: the 2-minute warning before an idle session is signed out. */
export function IdleDialog({ secondsLeft, onStay }: IdleDialogProps) {
  return (
    <Dialog
      title="You'll be signed out in 2 minutes"
      description="To keep your agency's information safe, we sign you out after 30 minutes without activity."
      open={secondsLeft !== null}
      onOpenChange={(open) => {
        if (!open) onStay();
      }}
    >
      <div className="grid gap-4">
        <p role="timer" className="text-ink">
          Time left: <strong className="font-bold">{clock(secondsLeft ?? 0)}</strong>
        </p>
        <div>
          <Button onClick={onStay}>Stay signed in</Button>
        </div>
      </div>
    </Dialog>
  );
}
