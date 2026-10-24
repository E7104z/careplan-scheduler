import { useState } from "react";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";

export interface RemoveMemberDialogProps {
  /** The person to remove; null keeps the dialog closed. */
  name: string | null;
  agencyName: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}

/** "Remove <name> from <agency>? They lose access right away." (APP-SPEC 6.4). */
export function RemoveMemberDialog({ name, agencyName, onConfirm, onClose, onCloseAutoFocus }: RemoveMemberDialogProps) {
  const [removing, setRemoving] = useState(false);

  const confirm = async () => {
    setRemoving(true);
    await onConfirm();
    setRemoving(false);
  };

  return (
    <Dialog
      title="Remove from team"
      open={name !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <p className="text-ink">
        Remove {name} from {agencyName}? They lose access right away.
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" busy={removing} onClick={() => void confirm()}>
          Remove from team
        </Button>
      </div>
    </Dialog>
  );
}
