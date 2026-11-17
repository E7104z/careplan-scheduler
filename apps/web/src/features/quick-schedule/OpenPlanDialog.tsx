import { useState, type FormEvent } from "react";
import { readFileText } from "../../lib/download";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Field } from "../../ui/Field";
import { PasswordInput } from "../auth/PasswordInput";
import { decryptPlan, PlanFileError, type PlanFileProblem } from "./planFile";
import type { CarePlan } from "./types";

export interface OpenPlanDialogProps {
  /** The chosen `.careplan` file; null keeps the dialog closed. */
  file: File | null;
  onClose: () => void;
  onOpened: (plan: CarePlan) => void;
}

const PROBLEMS: Record<PlanFileProblem, string> = {
  "not-a-plan-file": "This isn't a CarePlan Scheduler plan file. Choose a file that ends in .careplan.",
  "wrong-passphrase": "That passphrase doesn't open this file. Check it and try again.",
  unreadable: "This plan file can't be opened here. Open the care plan PDF from Fusion instead.",
};

/** APP-SPEC 5.9 "Open a saved plan": a `.careplan` file and its passphrase. */
export function OpenPlanDialog({ file, onClose, onOpened }: OpenPlanDialogProps) {
  const [passphrase, setPassphrase] = useState("");
  const [problem, setProblem] = useState<PlanFileProblem | null>(null);
  const [opening, setOpening] = useState(false);

  const close = () => {
    setPassphrase("");
    setProblem(null);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setOpening(true);
    setProblem(null);
    try {
      const opened = await decryptPlan(await readFileText(file), passphrase);
      setPassphrase("");
      onOpened(opened.plan);
    } catch (error) {
      setProblem(error instanceof PlanFileError ? error.problem : "unreadable");
    } finally {
      setOpening(false);
    }
  };

  return (
    <Dialog
      title="Open a saved plan"
      description={file ? `Type the passphrase for ${file.name}.` : undefined}
      open={file !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <form noValidate className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <Field label="Passphrase">
          <PasswordInput autoComplete="current-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
        </Field>
        {problem ? (
          <p role="alert" className="text-sm text-block">
            {PROBLEMS[problem]}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" busy={opening} disabled={passphrase === ""}>
            Open plan
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
