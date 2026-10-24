import { useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { MO_2026_07 } from "@careplan/engine";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { Toast, ToastProvider, ToastViewport } from "../../ui/Toast";
import { ImportPanel, PASTE_BOX_ID, type BuiltFrom } from "../import/ImportPanel";
import { READ_SUMMARY_TITLE_ID, ReadSummary } from "../import/ReadSummary";
import { CarePlanPane } from "./CarePlanPane";
import { buildQuickModel } from "./model";
import { StatusPanel } from "./StatusPanel";
import { TASK_PICKER_ID } from "./TaskPicker";
import type { QuickModel, QuickState } from "./types";
import { refusalPlace, useQuickStore, type QuickFeedback } from "./useQuickStore";

const PACK = MO_2026_07;

/** A refusal that belongs in a toast, or the QS-02 "Removed …" message after a service change. */
function toastMessage(feedback: QuickFeedback | null, model: QuickModel): string | null {
  if (!feedback) return null;
  if (feedback.refusal !== undefined) return refusalPlace(feedback.action) === "toast" ? feedback.refusal : null;
  const count = feedback.removed?.length ?? 0;
  if (count === 0) return null;
  return `Removed ${count} ${count === 1 ? "task that isn't" : "tasks that aren't"} part of ${model.svc.name}`;
}

/**
 * APP-SPEC 5.1 Quick Schedule: paste a Fusion care plan (or open its PDF, or start by hand) and
 * get a schedule that follows Missouri's rules. State lives in this tab only (sessionStorage,
 * without the participant's name and DCN).
 */
export function QuickSchedule() {
  const headingRef = usePageTitle("Quick Schedule | CarePlan Scheduler");
  const [{ state, feedback }, dispatch] = useQuickStore();
  const model = useMemo(() => buildQuickModel(state, PACK), [state]);
  // "New care plan" reopens the import panel over the current schedule until the next plan is built.
  const [importOpen, setImportOpen] = useState(false);
  const importShown = state.isExample || importOpen;
  // A new plan starts its panes fresh (no half-typed values or open tables from the last one).
  const [planKey, setPlanKey] = useState(0);
  const [toast, setToast] = useState<{ seq: number; message: string } | null>(null);
  const toastSeq = useRef(0);
  useEffect(() => {
    if (!feedback || feedback.seq === toastSeq.current) return;
    toastSeq.current = feedback.seq;
    const message = toastMessage(feedback, model);
    if (message !== null) setToast({ seq: feedback.seq, message });
  }, [feedback, model]);

  const focusAfter = useRef<string | null>(null);
  useEffect(() => {
    const id = focusAfter.current;
    if (id === null) return;
    focusAfter.current = null;
    document.getElementById(id)?.focus();
  });

  const onBuilt = (next: QuickState, from: BuiltFrom) => {
    dispatch({ type: "replace", state: next });
    setPlanKey((key) => key + 1);
    setImportOpen(false);
    focusAfter.current = from === "import" ? READ_SUMMARY_TITLE_ID : from === "manual" ? TASK_PICKER_ID : null;
  };

  const startNew = () => {
    setImportOpen(true);
    focusAfter.current = PASTE_BOX_ID;
  };

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
            Quick Schedule
          </h1>
          <p className="mt-1 max-w-[64ch] text-ink-2">
            Paste a care plan from Fusion or open its PDF. You get a ready schedule that follows Missouri's rules,
            and you can change it within them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {importShown ? null : (
            <Button variant="secondary" onClick={startNew}>
              New care plan
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            Print schedule
          </Button>
        </div>
      </div>

      {importShown ? <ImportPanel onBuilt={onBuilt} /> : null}
      {state.source === "fusion" ? (
        <ReadSummary key={planKey} state={state} model={model} onNewPlan={startNew} />
      ) : null}

      <p role="note" className="flex items-start gap-2.5 rounded-sm bg-info-bg px-3.5 py-2.5 text-sm text-ink">
        <Info className="mt-0.5 h-4 w-4 flex-none text-info" aria-hidden="true" />
        Nothing you paste or open is uploaded or saved to our servers. It stays in this browser tab, and the
        participant's name and DCN are gone when you close it.
      </p>

      <div className="grid items-start gap-6 min-[1060px]:grid-cols-[minmax(360px,400px)_minmax(0,1fr)]">
        <CarePlanPane key={planKey} state={state} model={model} pack={PACK} feedback={feedback} dispatch={dispatch} />
        <div className="grid min-w-0 gap-5">
          <StatusPanel state={state} model={model} />
        </div>
      </div>

      {/* QS-02: toasts belong to this page, so Radix Toast stays out of the other public pages. */}
      <ToastProvider>
        {toast ? (
          <Toast
            key={toast.seq}
            open
            onOpenChange={(open) => {
              if (!open) setToast(null);
            }}
            message={toast.message}
          />
        ) : null}
        <ToastViewport />
      </ToastProvider>
    </div>
  );
}
