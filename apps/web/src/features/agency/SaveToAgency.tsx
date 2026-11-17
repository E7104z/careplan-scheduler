import { useState } from "react";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import type { CarePlan } from "../quick-schedule/types";
import { SaveToAgencyForm } from "./SaveToAgencyForm";
import { useAgency } from "./agencyContext";
import { canSave, VIEWER_NOTE } from "./storageGate";
import { StorageNotice } from "./StorageNotice";
import { useStorageGate } from "./useStorageGate";

/**
 * Quick Schedule's "Save to agency" inside `/app` (PHASE-3-SPEC section 6): the plan under one of
 * the agency's participants, so the team can open it again. Closed gates say why instead.
 */
export function SaveToAgency({ plan }: { plan: CarePlan }) {
  const { state } = useAgency();
  const gate = useStorageGate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" disabled={gate === "loading"} onClick={() => setOpen(true)}>
        Save to agency
      </Button>
      <Dialog
        title="Save to your agency"
        open={open}
        onOpenChange={setOpen}
      >
        {gate !== "open" ? (
          <div className="grid gap-4">
            <StorageNotice gate={gate} isOwner={state.role === "owner"} />
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : !canSave(state.role) ? (
          <div className="grid gap-4">
            <p className="text-ink">{VIEWER_NOTE}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <SaveToAgencyForm plan={plan} onDone={() => setOpen(false)} />
        )}
      </Dialog>
    </>
  );
}
