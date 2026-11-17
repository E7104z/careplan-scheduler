import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { MO_2026_07 } from "@careplan/engine";
import { Button } from "../../ui/Button";
import { FileDrop } from "../../ui/FileDrop";
import { singlePlan } from "../quick-schedule/carePlan";
import { exampleStateA, exampleStateB, manualState } from "../quick-schedule/state";
import type { CarePlan, QuickState } from "../quick-schedule/types";
import { ImportIssues, type ImportNotice, type NeedsOutcome } from "./ImportIssues";
import { addPage, emptyImportFlow, next, setChoice, type ImportChoice, type ImportFlow } from "./importFlow";
import type { PdfReadResult } from "./readPdf";

/** The PDF chooser's id, so the page can put focus there after "New care plan". */
export const PDF_CHOOSER_ID = "qs-pdf";

export type BuiltFrom = "import" | "example" | "manual" | "saved";

export interface ImportPanelProps {
  /** A plan is ready: read from a PDF (every service in it), an example, or an empty one by hand. */
  onBuilt: (plan: CarePlan, from: BuiltFrom) => void;
}

// The PDF reader is its own chunk; this is the one failure readPdf can't report itself.
const READER_UNAVAILABLE: ImportNotice = {
  title: "We couldn't open the PDF reader",
  detail: "Check your internet connection and try again.",
};

// APP-SPEC 5.9: opening a saved plan file (and its decryption) loads only when someone chooses one.
const OpenPlanDialog = lazy(() =>
  import("../quick-schedule/OpenPlanDialog").then((module) => ({ default: module.OpenPlanDialog })),
);

const linkButton =
  "rounded-sm font-semibold text-brand underline hover:text-brand-hover max-sm:inline-flex max-sm:min-h-11 max-sm:items-center";

/**
 * APP-SPEC 5.1 import panel: the care plan PDF from Fusion is the only way a plan comes in
 * (D-13, Nov 13, 2026), beside the examples, building by hand and reopening a plan this app saved
 * (APP-SPEC 5.9, an encrypted file of the person's own work, never another program's data), with the issues that still
 * stop a build (IMPORT-SPEC 3.1). A PDF chosen after an incomplete one is added to it (IMP-12).
 */
export function ImportPanel({ onBuilt }: ImportPanelProps) {
  const [flow, setFlowState] = useState<ImportFlow>(emptyImportFlow);
  const flowRef = useRef(flow);
  const [outcome, setOutcome] = useState<NeedsOutcome | null>(null);
  const [notice, setNotice] = useState<ImportNotice | null>(null);
  const [reading, setReading] = useState(false);
  // APP-SPEC 5.9: the chosen saved plan file, waiting for its passphrase.
  const [savedFile, setSavedFile] = useState<File | null>(null);
  const savedChooser = useRef<HTMLInputElement>(null);
  // A PDF read in progress belongs to the panel as it was when the file was chosen.
  const readToken = useRef(0);
  useEffect(() => () => void (readToken.current += 1), []);

  const setFlow = (value: ImportFlow) => {
    flowRef.current = value;
    setFlowState(value);
  };

  const reset = () => {
    readToken.current += 1;
    setFlow(emptyImportFlow());
    setOutcome(null);
    setNotice(null);
    setReading(false);
  };

  const run = (value: ImportFlow) => {
    const result = next(value, MO_2026_07, new Date());
    if (result.kind === "ready") {
      reset();
      onBuilt(result.plan, "import");
      return;
    }
    // A PDF with no care plan in it isn't part of a plan: the next PDF starts again.
    const noRows = result.issues.some((issue) => issue.code === "no-rows");
    setFlow(noRows ? emptyImportFlow() : value);
    setOutcome(result);
  };

  const choose = (choice: ImportChoice) => run(setChoice(flowRef.current, choice));

  const openFile = async (file: File) => {
    const token = ++readToken.current;
    setNotice(null);
    setReading(true);
    let result: PdfReadResult;
    try {
      const { readPdf } = await import("./readPdf");
      result = await readPdf(file);
    } catch {
      result = { kind: "error", ...READER_UNAVAILABLE };
    }
    if (token !== readToken.current) return;
    setReading(false);
    if (result.kind === "error") setNotice({ title: result.title, detail: result.detail });
    else run(addPage(flowRef.current, result.text));
  };

  const start = (state: QuickState, from: BuiltFrom) => {
    reset();
    onBuilt(singlePlan(state), from);
  };

  return (
    <section aria-labelledby="qs-import-title" className="rounded-md border border-line bg-surface">
      <div className="grid min-[860px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-3 p-5 max-sm:p-4">
          <h2 id="qs-import-title" className="text-[17px] font-bold text-ink">
            Open the care plan PDF from Fusion
          </h2>
          <ol className="grid list-decimal gap-0.5 pl-5 text-sm text-ink-2">
            <li>In Fusion, open the participant's care plan.</li>
            <li>Download it as a PDF.</li>
            <li>Choose the PDF here or drop it on the box.</li>
          </ol>
          <FileDrop
            id={PDF_CHOOSER_ID}
            accept="application/pdf,.pdf"
            title="Choose the PDF"
            acceptLabel="or drop it here"
            onFile={(file) => void openFile(file)}
          />
          <p className="text-[13px] text-ink-3">The PDF is read on this computer. It isn't uploaded.</p>
        </div>
        <div className="grid min-w-0 content-start gap-3 border-t border-line p-5 max-sm:p-4 min-[860px]:border-l min-[860px]:border-t-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-3">Examples:</span>
            <Button variant="quiet" size="sm" onClick={() => start(exampleStateA(new Date()), "example")}>
              5-day plan
            </Button>
            <Button variant="quiet" size="sm" onClick={() => start(exampleStateB(new Date()), "example")}>
              7-day plan
            </Button>
          </div>
          <p className="text-[13px] text-ink-3">
            No care plan handy?{" "}
            <button type="button" className={linkButton} onClick={() => start(manualState(new Date()), "manual")}>
              Build a schedule by hand
            </button>
          </p>
          <p className="text-[13px] text-ink-3">
            Saved a plan before?{" "}
            <button type="button" className={linkButton} onClick={() => savedChooser.current?.click()}>
              Open a saved plan
            </button>
          </p>
          <input
            ref={savedChooser}
            type="file"
            accept=".careplan"
            className="sr-only"
            tabIndex={-1}
            aria-label="Saved plan file"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (file) setSavedFile(file);
            }}
          />
        </div>
      </div>
      <ImportIssues outcome={outcome} notice={notice} reading={reading} onChoose={choose} />
      {savedFile ? (
        <Suspense fallback={null}>
          <OpenPlanDialog
            file={savedFile}
            onClose={() => setSavedFile(null)}
            onOpened={(plan) => {
              setSavedFile(null);
              reset();
              onBuilt(plan, "saved");
            }}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
