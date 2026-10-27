import { lazy, Suspense, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Info } from "lucide-react";
import { MO_2026_07 } from "@careplan/engine";
import { todayIso } from "../../lib/format";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { PageLoading } from "../../ui/PageLoading";
import { Toast, ToastProvider, ToastViewport } from "../../ui/Toast";
import { ImportPanel, PASTE_BOX_ID, type BuiltFrom } from "../import/ImportPanel";
import { READ_SUMMARY_TITLE_ID, ReadSummary } from "../import/ReadSummary";
import { CarePlanPane } from "./CarePlanPane";
import { buildQuickModel } from "./model";
import { openPrintout, printSchedulePdf, savePrintout, saveSchedulePdf, SHELL_PRINT_EVENT, worksheetFileName, type Printout } from "./printSchedule";
import { SchedulePane } from "./SchedulePane";
import { TASK_PICKER_ID } from "./TaskPicker";
import "./print.css";
import type { QuickModel, QuickState } from "./types";
import { refusalPlace, useQuickStore, type QuickFeedback } from "./useQuickStore";
import { ViewTabs, viewPanelId, viewTabId, type QuickView } from "./worksheet/ViewTabs";
import { emptyWorksheet, worksheetReducer } from "./worksheet/worksheetState";

const PACK = MO_2026_07;

// Phase 3: the Worksheet view loads only when its tab is opened, so /quick's first paint stays in budget.
const WorksheetPanel = lazy(() => import("./worksheet/WorksheetPanel").then((module) => ({ default: module.WorksheetPanel })));

const PRINT_FAILED = "Couldn't make the PDF. Check your connection, then try again.";

type PrintAction = "print" | "save";
/** What is being made: the schedule's printout or the worksheet's, printed or saved. */
type Printing = `${QuickView}-${PrintAction}`;

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
  // Phase 3: the Worksheet view's fields. Memory only (W-4), and blank again for each new care plan.
  const [view, setView] = useState<QuickView>("schedule");
  const [worksheet, changeWorksheet] = useReducer(worksheetReducer, state, emptyWorksheet);
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
    changeWorksheet({ type: "reset", fields: emptyWorksheet(next) });
    setPlanKey((key) => key + 1);
    setImportOpen(false);
    focusAfter.current = from === "import" ? READ_SUMMARY_TITLE_ID : from === "manual" ? TASK_PICKER_ID : null;
  };

  const startNew = () => {
    setImportOpen(true);
    focusAfter.current = PASTE_BOX_ID;
  };

  // APP-SPEC 5.4 Print: the one-page PDF. Print errors get their own toasts, numbered below the
  // store's feedback so the two never share a key.
  const [printing, setPrinting] = useState<Printing | null>(null);
  // Set at once (state waits for a render): Ctrl+P can reach the page and the Windows app's menu
  // in the same moment, and that is one printout.
  const making = useRef(false);
  const printErrors = useRef(0);
  const canPrint = model.tasks.length > 0;
  /**
   * Makes the printout of the view that is open (or the one named): false when there's nothing to
   * print (a schedule with no tasks yet). The worksheet always prints: a blank form is still a form.
   */
  const makePrintout = (action: PrintAction, what: QuickView = view): boolean => {
    if (what === "schedule" && !canPrint) return false;
    if (making.current) return true;
    making.current = true;
    setPrinting(`${what}-${action}`);
    const source = { state, model, pack: PACK };
    const today = todayIso();
    const worksheetPrintout: Printout = {
      title: "Worksheet",
      waiting: "Making the worksheet…",
      fileName: worksheetFileName(today),
      // The worksheet's layout and pdf-lib load only now, in their own chunks (APP-SPEC 10).
      make: () => import("./worksheet/worksheetPrintout").then((module) => module.worksheetPdf({ ...source, fields: worksheet }, today)),
    };
    const job = what === "worksheet"
      ? (action === "print" ? openPrintout(worksheetPrintout) : savePrintout(worksheetPrintout))
      : (action === "print" ? printSchedulePdf(source) : saveSchedulePdf(source));
    job
      .catch(() => setToast({ seq: --printErrors.current, message: PRINT_FAILED }))
      .finally(() => {
        making.current = false;
        setPrinting(null);
      });
    return true;
  };
  const latestPrintout = useRef(makePrintout);
  useEffect(() => {
    latestPrintout.current = makePrintout;
  });
  // Ctrl+P (and the Windows app's File > Print) make the printout rather than print the page.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "p") return;
      if (latestPrintout.current("print")) event.preventDefault();
    };
    const onShellPrint = (event: Event) => {
      if (latestPrintout.current("print")) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(SHELL_PRINT_EVENT, onShellPrint);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(SHELL_PRINT_EVENT, onShellPrint);
    };
  }, []);

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 print:hidden">
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
          <Button variant="secondary" disabled={!canPrint} busy={printing === "schedule-print"} onClick={() => makePrintout("print", "schedule")}>
            Print schedule
          </Button>
          <Button variant="secondary" disabled={!canPrint} busy={printing === "schedule-save"} onClick={() => makePrintout("save", "schedule")}>
            Save as PDF
          </Button>
        </div>
      </div>

      {importShown ? (
        <div className="print:hidden">
          <ImportPanel onBuilt={onBuilt} />
        </div>
      ) : null}
      {state.source === "fusion" ? (
        <div className="print:hidden">
          <ReadSummary key={planKey} state={state} model={model} onNewPlan={startNew} />
        </div>
      ) : null}

      <p role="note" className="flex items-start gap-2.5 rounded-sm bg-info-bg px-3.5 py-2.5 text-sm text-ink print:hidden">
        <Info className="mt-0.5 h-4 w-4 flex-none text-info" aria-hidden="true" />
        Nothing you paste or open is uploaded or saved to our servers. It stays in this browser tab, and the
        participant's name and DCN are gone when you close it.
      </p>

      {/* One column (below 1060px): the care plan comes first, and a long one pushes the status and
          the week several screens down, so this link skips past it. */}
      <a
        href="#qs-schedule"
        className="-my-3 self-start rounded-sm font-semibold text-brand underline hover:text-brand-hover max-sm:inline-flex max-sm:min-h-11 max-sm:items-center min-[1060px]:hidden print:hidden"
      >
        Skip to the schedule
      </a>

      <div className="grid items-start gap-6 min-[1060px]:grid-cols-[minmax(360px,400px)_minmax(0,1fr)] print:block">
        <div className="print:hidden">
          <CarePlanPane key={planKey} state={state} model={model} pack={PACK} feedback={feedback} dispatch={dispatch} />
        </div>
        <div className="grid min-w-0 gap-4 print:block">
          <ViewTabs view={view} onChange={setView} />
          <div role="tabpanel" id={viewPanelId("schedule")} aria-labelledby={viewTabId("schedule")} hidden={view !== "schedule"} className="min-w-0">
            <SchedulePane state={state} model={model} pack={PACK} feedback={feedback} dispatch={dispatch} />
          </div>
          {view === "worksheet" ? (
            <div role="tabpanel" id={viewPanelId("worksheet")} aria-labelledby={viewTabId("worksheet")} className="min-w-0 print:hidden">
              <Suspense fallback={<PageLoading />}>
                <WorksheetPanel
                  state={state} model={model} pack={PACK} seq={feedback?.seq ?? 0} dispatch={dispatch} fields={worksheet} change={changeWorksheet}
                  printing={printing === "worksheet-print" ? "print" : printing === "worksheet-save" ? "save" : null}
                  onPrint={(action) => makePrintout(action, "worksheet")}
                />
              </Suspense>
            </div>
          ) : null}
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
