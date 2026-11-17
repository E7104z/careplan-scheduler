import { useState, type FormEvent } from "react";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { TextInput } from "../../ui/TextInput";
import { useToast } from "../../ui/ToastHost";
import { useAuth } from "../auth/authContext";
import { errorMessage } from "../auth/errors";
import { PARTICIPANT_NAME_MAX, renameParticipant } from "./savedPlans";
import { participantNameProblem } from "./storageGate";

export interface RenameParticipantProps {
  tenantId: string;
  participantId: string;
  name: string;
  onRenamed: (name: string) => void;
}

/** Changes the name or alias the agency uses for a participant (P3-08: never a DCN). */
export function RenameParticipant({ tenantId, participantId, name, onRenamed }: RenameParticipantProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [problem, setProblem] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setValue(name);
            setProblem(undefined);
            setEditing(true);
          }}
        >
          Change name
        </Button>
      </div>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const found = participantNameProblem(value);
    setProblem(found ?? undefined);
    if (found) return;
    setSaving(true);
    try {
      await renameParticipant(tenantId, participantId, user, value.trim());
      onRenamed(value.trim());
      setEditing(false);
      toast("Name changed");
    } catch (error) {
      setProblem(errorMessage(error) ?? undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-sm border border-line p-4">
      <Field label="Name or alias" hint="Leave the DCN out." error={problem} required>
        <TextInput autoFocus value={value} maxLength={PARTICIPANT_NAME_MAX} autoComplete="off" onChange={(event) => setValue(event.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" busy={saving}>
          Save name
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
