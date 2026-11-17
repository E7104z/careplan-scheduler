import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { niceDate, niceDateFromMillis } from "../../lib/format";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { PageLoading } from "../../ui/PageLoading";
import { useToast } from "../../ui/ToastHost";
import { savePlan as keepInTab } from "../quick-schedule/persistence";
import { errorMessage } from "../auth/errors";
import { useAgency } from "./agencyContext";
import { rememberOpenedPlan } from "./openedPlan";
import { RenameParticipant } from "./RenameParticipant";
import {
  deleteParticipant,
  deleteSavedPlan,
  listPlans,
  openSavedPlan,
  participantName,
  SavedPlanError,
  type SavedPlanSummary,
} from "./savedPlans";
import { canDelete, canSave } from "./storageGate";
import { StorageNotice } from "./StorageNotice";
import { useStorageGate } from "./useStorageGate";

const PAGE = "mx-auto grid w-full max-w-[720px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6";
const HEADING = "text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]";
const DAMAGED = "This saved plan can't be opened: it doesn't match what was saved. Open the care plan PDF instead.";

type Confirming = { kind: "plan"; plan: SavedPlanSummary } | { kind: "participant" } | null;

/** `/app/participants/:participantId`: one participant's saved care plans (PHASE-3-SPEC section 6). */
export function ParticipantDetail() {
  const { participantId = "" } = useParams();
  const { state } = useAgency();
  const toast = useToast();
  const navigate = useNavigate();
  const gate = useStorageGate();
  const tenantId = state.tenantId ?? "";
  // No name in the title: browser history and the tab list keep it (P3-08).
  const headingRef = usePageTitle("Participant | CarePlan Scheduler");
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [plans, setPlans] = useState<SavedPlanSummary[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [deleting, setDeleting] = useState(false);
  const open = gate === "open";

  const load = useCallback(async () => {
    if (!tenantId || !participantId) return;
    setProblem(null);
    try {
      const found = await participantName(tenantId, participantId);
      setName(found);
      setPlans(found === null ? [] : await listPlans(tenantId, participantId));
    } catch (error) {
      setProblem(errorMessage(error));
      setName((current) => (current === undefined ? null : current));
    }
  }, [tenantId, participantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPlan = async (plan: SavedPlanSummary) => {
    setOpening(plan.id);
    setProblem(null);
    try {
      const carePlan = await openSavedPlan(tenantId, participantId, plan.id);
      // Quick Schedule opens on the tab's copy; the link lets "Save to agency" update this plan.
      keepInTab(carePlan);
      rememberOpenedPlan({ tenantId, participantId, planId: plan.id }, carePlan);
      void navigate("/app/quick");
    } catch (error) {
      setProblem(error instanceof SavedPlanError ? DAMAGED : errorMessage(error));
      setOpening(null);
    }
  };

  const confirmDelete = async () => {
    if (!confirming) return;
    setDeleting(true);
    try {
      if (confirming.kind === "plan") {
        await deleteSavedPlan(tenantId, participantId, confirming.plan.id);
        setConfirming(null);
        toast("Plan deleted");
        await load();
      } else {
        await deleteParticipant(tenantId, participantId);
        setConfirming(null);
        toast("Participant deleted");
        void navigate("/app/participants");
      }
    } catch (error) {
      setConfirming(null);
      setProblem(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  if (name === undefined) return <PageLoading />;
  if (name === null && problem === null) {
    return (
      <div className={PAGE}>
        <h1 ref={headingRef} tabIndex={-1} className={HEADING}>
          We couldn't find that participant
        </h1>
        <p className="text-ink-2">They may have been deleted.</p>
        <p>
          <Link to="/app/participants" className="rounded-sm font-semibold text-brand underline hover:text-brand-hover">
            Back to participants
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <div className="grid gap-1">
        <Link to="/app/participants" className="w-fit rounded-sm text-sm font-semibold text-brand underline hover:text-brand-hover">
          Participants
        </Link>
        <h1 ref={headingRef} tabIndex={-1} className={HEADING}>
          {name ?? "Participant"}
        </h1>
      </div>
      <StorageNotice gate={gate} isOwner={state.role === "owner"} />
      {problem ? (
        <p role="alert" className="rounded-sm border border-line bg-sunk px-3.5 py-2.5 text-sm text-block">
          {problem}
        </p>
      ) : null}
      {open && canSave(state.role) && name ? (
        <RenameParticipant tenantId={tenantId} participantId={participantId} name={name} onRenamed={setName} />
      ) : null}

      <section aria-labelledby="plans-heading" className="grid gap-3">
        <h2 id="plans-heading" className="text-[17px] font-bold text-ink">
          Saved care plans
        </h2>
        {plans.length === 0 ? (
          <p className="text-ink-2">
            No saved plans yet. Open their care plan PDF in{" "}
            <Link to="/app/quick" className="rounded-sm font-semibold text-brand underline hover:text-brand-hover">
              Quick Schedule
            </Link>
            , then choose Save to agency.
          </p>
        ) : (
          <ul className="grid gap-2">
            {plans.map((plan) => (
              <li key={plan.id} className="grid gap-2 rounded-sm border border-line px-3.5 py-3 sm:flex sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{plan.name}</p>
                  <p className="text-sm text-ink-2">
                    {plan.planStart && plan.planEnd ? `${niceDate(plan.planStart)} to ${niceDate(plan.planEnd)}` : null}
                    {plan.savedAt !== null ? ` · Saved ${niceDateFromMillis(plan.savedAt)}` : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" busy={opening === plan.id} onClick={() => void openPlan(plan)}>
                    Open in Quick Schedule
                  </Button>
                  {open && canDelete(state.role) ? (
                    <Button size="sm" variant="secondary" onClick={() => setConfirming({ kind: "plan", plan })}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {open && canDelete(state.role) ? (
        <div>
          <Button variant="secondary" onClick={() => setConfirming({ kind: "participant" })}>
            Delete participant
          </Button>
        </div>
      ) : null}

      <Dialog
        title={confirming?.kind === "participant" ? "Delete participant" : "Delete saved plan"}
        open={confirming !== null}
        onOpenChange={(next) => {
          if (!next) setConfirming(null);
        }}
      >
        <p className="text-ink">
          {confirming?.kind === "participant"
            ? `Delete ${name ?? "this participant"} and ${plans.length === 1 ? "their saved plan" : `their ${plans.length} saved plans`}? This can't be undone.`
            : `Delete ${confirming?.kind === "plan" ? confirming.plan.name : "this plan"}? This can't be undone.`}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Cancel
          </Button>
          <Button variant="danger" busy={deleting} onClick={() => void confirmDelete()}>
            {confirming?.kind === "participant" ? "Delete participant" : "Delete plan"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
