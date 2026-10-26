import { useEffect, useRef, useState } from "react";
import { MO_2026_07 } from "@careplan/engine";
import { Button } from "../../ui/Button";
import { FileDrop } from "../../ui/FileDrop";
import { Textarea } from "../../ui/Textarea";
import { exampleStateA, exampleStateB, manualState } from "../quick-schedule/state";
import type { QuickState } from "../quick-schedule/types";
import { ImportIssues, type ImportNotice, type ImportSource, type NeedsOutcome } from "./ImportIssues";
import { addPage, emptyImportFlow, next, setChoice, type ImportChoice, type ImportFlow } from "./importFlow";
import type { PdfReadResult } from "./readPdf";

/** The paste box's id, so the page can put focus there after "New care plan". */
export const PASTE_BOX_ID = "qs-paste";

export type BuiltFrom = "import" | "example" | "manual";

export interface ImportPanelProps {
  /** A plan is ready: read from a paste or PDF, one of the examples, or an empty one by hand. */
  onBuilt: (state: QuickState, from: BuiltFrom) => void;
}

const PASTE_FIRST: ImportNotice = {
  title: "Paste the care plan first",
  detail: "Copy it from Fusion, click in the box, and paste.",
};

// The PDF reader is its own chunk; this is the one failure readPdf can't report itself.
const READER_UNAVAILABLE: ImportNotice = {
  title: "We couldn't open the PDF reader",
  detail: "Check your internet connection and try again. You can also paste the care plan instead.",
};

const linkButton =
  "rounded-sm font-semibold text-brand underline hover:text-brand-hover max-sm:inline-flex max-sm:min-h-11 max-sm:items-center";

/**
 * APP-SPEC 5.1 import panel: paste (builds on paste, no button press), "Build schedule" for typed
 * text, the examples, the PDF drop zone, and the issues that still stop a build (IMPORT-SPEC 3.1).
 * Each paste is added to the ones before (IMP-12), so a plan over two Fusion pages is pasted one
 * page at a time.
 */
export function ImportPanel({ onBuilt }: ImportPanelProps) {
  const [text, setText] = useState("");
  const [flow, setFlowState] = useState<ImportFlow>(emptyImportFlow);
  const flowRef = useRef(flow);
  const [outcome, setOutcome] = useState<NeedsOutcome | null>(null);
  const [notice, setNotice] = useState<ImportNotice | null>(null);
  const [reading, setReading] = useState(false);
  const [from, setFrom] = useState<ImportSource>("paste");
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
    setText("");
  };

  const run = (value: ImportFlow) => {
    const result = next(value, MO_2026_07, new Date());
    if (result.kind === "ready") {
      reset();
      onBuilt(result.state, "import");
      return;
    }
    // Text with no care plan in it isn't a page of the plan: the next paste is page 1 again.
    const noRows = result.issues.some((issue) => issue.code === "no-rows");
    setFlow(noRows ? emptyImportFlow() : value);
    setOutcome(result);
  };

  const acceptText = (value: string, source: ImportSource = "paste") => {
    if (value.trim() === "") return;
    setFrom(source);
    setText("");
    setNotice(null);
    run(addPage(flowRef.current, value));
  };

  const build = () => {
    if (text.trim() === "") {
      setNotice(PASTE_FIRST);
      document.getElementById(PASTE_BOX_ID)?.focus();
      return;
    }
    acceptText(text);
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
    else acceptText(result.text, "pdf");
  };

  const start = (state: QuickState, from: BuiltFrom) => {
    reset();
    onBuilt(state, from);
  };

  const page = flow.pages.length + 1;

  return (
    <section aria-labelledby="qs-import-title" className="rounded-md border border-line bg-surface">
      <div className="grid min-[860px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-3 p-5 max-sm:p-4">
          <h2 id="qs-import-title" className="text-[17px] font-bold text-ink">
            Paste the care plan from Fusion
          </h2>
          <ol className="grid list-decimal gap-0.5 pl-5 text-sm text-ink-2">
            <li>In Fusion, open the participant's care plan.</li>
            <li>Select from the participant's name down to the last task, and copy.</li>
            <li>Paste it here. If Fusion shows the tasks on two pages, paste one page at a time.</li>
          </ol>
          <label htmlFor={PASTE_BOX_ID} className="sr-only">
            {page > 1 ? `Care plan text, page ${page}` : "Care plan text"}
          </label>
          <Textarea
            id={PASTE_BOX_ID}
            placeholder={page > 1 ? `Paste page ${page} here` : "Paste here"}
            value={text}
            onChange={(event) => {
              // A paste is read straight away (onPasteText runs first) and the box is emptied.
              const native = event.nativeEvent;
              if ("inputType" in native && native.inputType === "insertFromPaste") return;
              setText(event.target.value);
            }}
            onPasteText={(value) => acceptText(value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={build}>Build schedule</Button>
            <span className="ml-1 text-[13px] text-ink-3">Examples:</span>
            <Button variant="quiet" size="sm" onClick={() => start(exampleStateA(new Date()), "example")}>
              5-day plan
            </Button>
            <Button variant="quiet" size="sm" onClick={() => start(exampleStateB(new Date()), "example")}>
              7-day plan
            </Button>
          </div>
        </div>
        <div className="grid min-w-0 content-start gap-3 border-t border-line p-5 max-sm:p-4 min-[860px]:border-l min-[860px]:border-t-0">
          <h2 className="text-[17px] font-bold text-ink">Or open the care plan PDF</h2>
          <FileDrop
            accept="application/pdf,.pdf"
            title="Choose the PDF"
            acceptLabel="or drop it here"
            onFile={(file) => void openFile(file)}
          />
          <p className="text-[13px] text-ink-3">The PDF is read on this computer. It isn't uploaded.</p>
          <p className="text-[13px] text-ink-3">
            No care plan handy?{" "}
            <button type="button" className={linkButton} onClick={() => start(manualState(new Date()), "manual")}>
              Build a schedule by hand
            </button>
          </p>
        </div>
      </div>
      <ImportIssues outcome={outcome} notice={notice} reading={reading} from={from} onChoose={choose} />
    </section>
  );
}
