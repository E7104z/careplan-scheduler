import { useState, type FormEvent } from "react";
import { downloadBlob } from "../../lib/download";
import { todayIso } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Field } from "../../ui/Field";
import { PasswordInput } from "../auth/PasswordInput";
import { encryptPlan, PASSPHRASE_MIN, planFileName } from "./planFile";
import type { CarePlan } from "./types";

export interface SavePlanDialogProps {
  plan: CarePlan;
  open: boolean;
  onClose: () => void;
  /** The file was made and its download started. */
  onSaved: (fileName: string) => void;
}

const TOO_SHORT = `Use at least ${PASSPHRASE_MIN} characters. A short sentence of four or five words works well.`;
const NO_MATCH = "The two passphrases don't match. Type the same one in both boxes.";
const FAILED = "Couldn't save the plan file. Try again.";

/**
 * APP-SPEC 5.9 "Save plan": the whole care plan as an encrypted file on this computer. Nothing is
 * uploaded; only the passphrase opens the file again, and it can't be recovered.
 */
export function SavePlanDialog({ plan, open, onClose, onSaved }: SavePlanDialogProps) {
  const [passphrase, setPassphrase] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<{ passphrase?: string; again?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  const close = () => {
    setPassphrase("");
    setAgain("");
    setErrors({});
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = {
      passphrase: passphrase.length < PASSPHRASE_MIN ? TOO_SHORT : undefined,
      again: passphrase.length >= PASSPHRASE_MIN && again !== passphrase ? NO_MATCH : undefined,
    };
    setErrors(found);
    if (found.passphrase || found.again) return;
    setSaving(true);
    try {
      const today = todayIso();
      const text = await encryptPlan(plan, passphrase, today);
      const fileName = planFileName(today);
      downloadBlob(new Blob([text], { type: "application/octet-stream" }), fileName);
      close();
      onSaved(fileName);
    } catch {
      setErrors({ form: FAILED });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Save this care plan"
      description="Saves an encrypted file to this computer, with everything on the schedule. It isn't uploaded."
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <form noValidate className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <Field label="Passphrase" hint={`At least ${PASSPHRASE_MIN} characters`} error={errors.passphrase}>
          <PasswordInput autoComplete="new-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
        </Field>
        <Field label="Type the passphrase again" error={errors.again}>
          <PasswordInput autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} />
        </Field>
        <p className="text-sm text-ink-2">
          Keep the passphrase somewhere safe. Without it nobody can open the file, and we can't recover it.
        </p>
        {errors.form ? (
          <p role="alert" className="text-sm text-block">
            {errors.form}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" busy={saving}>
            Save plan file
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
