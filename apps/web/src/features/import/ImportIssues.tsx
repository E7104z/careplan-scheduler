import { useState, type ReactNode } from "react";
import { MO_2026_07, type ServiceCode } from "@careplan/engine";
import type { ImportIssue } from "@careplan/import";
import { cn } from "../../lib/cn";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Select } from "../../ui/Select";
import { Spinner } from "../../ui/Spinner";
import { ServiceOptions } from "../quick-schedule/ServiceOptions";
import type { ImportChoice, ImportOutcome } from "./importFlow";

export type NeedsOutcome = Extract<ImportOutcome, { kind: "needs" }>;

/** A message about the import that isn't one of the reader's issues: an empty box or a PDF. */
export interface ImportNotice {
  title: string;
  detail: string;
}

const LEVEL_BORDER = { error: "border-l-block", input: "border-l-info", warn: "border-l-warn" } as const;

function IssueBox({ level, title, children }: { level: keyof typeof LEVEL_BORDER; title: string; children: ReactNode }) {
  return (
    <div className={cn("grid gap-2 rounded-sm border border-l-4 border-line bg-surface px-3.5 py-3", LEVEL_BORDER[level])}>
      <h3 className="text-[15px] font-bold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-2">{children}</p>;
}

const dateInput = "h-10 w-full rounded-sm border border-line-2 bg-surface px-3 text-ink focus:border-brand";

/** IMP-13: the plan dates weren't in the text, so the person enters them. */
function PlanDates({ onChoose }: { onChoose: (choice: ImportChoice) => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | undefined>();
  const use = () => {
    if (!start || !end || end < start) {
      setError("Enter a start date and an end date after it.");
      return;
    }
    setError(undefined);
    onChoose({ kind: "plan", plan: { start, end } });
  };
  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <Field label="Plan starts" className="w-[190px]">
        <input type="date" className={dateInput} value={start} onChange={(event) => setStart(event.target.value)} />
      </Field>
      <Field label="Plan ends" className="w-[190px]" error={error}>
        <input type="date" className={dateInput} value={end} onChange={(event) => setEnd(event.target.value)} />
      </Field>
      <Button size="sm" onClick={use}>
        Use these dates
      </Button>
    </div>
  );
}

/** IMP-11: a Fusion service label we haven't seen; the person says which service it is. */
function ServiceChoice({ onChoose }: { onChoose: (choice: ImportChoice) => void }) {
  const [code, setCode] = useState<ServiceCode>("T1019U2");
  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <Field label="Service" className="w-[320px] max-w-full">
        <Select value={code} onChange={(event) => setCode(event.target.value as ServiceCode)}>
          <ServiceOptions pack={MO_2026_07} />
        </Select>
      </Field>
      <Button size="sm" onClick={() => onChoose({ kind: "serviceCode", code })}>
        Use this service
      </Button>
    </div>
  );
}

/** Where the text being read came from: the paste box or a PDF. */
export type ImportSource = "paste" | "pdf";

function IssueView({
  issue,
  from,
  onChoose,
}: {
  issue: ImportIssue;
  from: ImportSource;
  onChoose: (choice: ImportChoice) => void;
}) {
  switch (issue.code) {
    case "no-rows":
      return from === "pdf" ? (
        <IssueBox level="error" title="We couldn't find care plan tasks in that PDF">
          <Body>
            Open the participant's care plan PDF from Fusion, or copy the care plan from Fusion's screen and paste it
            above.
          </Body>
        </IssueBox>
      ) : (
        <IssueBox level="error" title="We couldn't find care plan tasks in that text">
          <Body>
            Copy from the participant's name in Fusion down to the last task, then paste again. Or open the care
            plan PDF.
          </Body>
        </IssueBox>
      );
    case "incomplete":
      return (
        <IssueBox level="error" title={`This copy has ${issue.have} of the plan's ${issue.total} rows`}>
          <Body>
            Fusion splits long plans over pages. In Fusion, go to the next page, copy it, and paste it in the box
            above. We'll add it to what we've read.
          </Body>
          <div>
            <Button variant="secondary" size="sm" onClick={() => onChoose({ kind: "acceptPartial" })}>
              Build with the {issue.have} rows I have
            </Button>
          </div>
        </IssueBox>
      );
    case "different-participant":
      return (
        <IssueBox level="error" title="That page is for a different participant">
          <Body>{issue.message} Paste the next page of the same care plan.</Body>
        </IssueBox>
      );
    case "unknown-service":
      return (
        <IssueBox level="input" title={`Which service is "${issue.label ?? ""}"?`}>
          <Body>We haven't seen this Fusion service name before. Choose the service it stands for.</Body>
          <ServiceChoice onChoose={onChoose} />
        </IssueBox>
      );
    case "no-plan-dates":
      return (
        <IssueBox level="input" title="Enter the plan dates">
          <Body>
            The plan dates weren't in what we read. They're at the top of the care plan in Fusion, next to "Care
            Plan:".
          </Body>
          <PlanDates onChoose={onChoose} />
        </IssueBox>
      );
    case "bad-dates":
      return (
        <IssueBox level="error" title="The plan dates don't look right">
          <Body>{issue.message}</Body>
        </IssueBox>
      );
    default:
      // Notes that don't stop the build are listed in the read summary instead.
      return null;
  }
}

export interface ImportIssuesProps {
  outcome: NeedsOutcome | null;
  notice: ImportNotice | null;
  reading: boolean;
  from: ImportSource;
  onChoose: (choice: ImportChoice) => void;
}

/** IMPORT-SPEC 3.1: what still stops the plan from building, with the control that resolves it. */
export function ImportIssues({ outcome, notice, reading, from, onChoose }: ImportIssuesProps) {
  const services = outcome?.parsed.services ?? [];
  return (
    <div aria-live="polite" className="grid gap-2.5 px-5 pb-5 empty:p-0 max-sm:px-4 max-sm:pb-4">
      {reading ? (
        <p className="flex items-center gap-2.5 text-sm text-ink-2">
          <Spinner className="h-4 w-4 text-brand" />
          Reading the PDF…
        </p>
      ) : null}
      {notice ? (
        <IssueBox level="error" title={notice.title}>
          <Body>{notice.detail}</Body>
        </IssueBox>
      ) : null}
      {outcome?.issues.map((issue, index) => (
        <IssueView key={`${issue.code}-${index}`} issue={issue} from={from} onChoose={onChoose} />
      ))}
      {outcome && services.length > 1 && outcome.serviceIndex === null ? (
        <IssueBox level="input" title={`This care plan has ${services.length} services`}>
          <Body>Choose the one to schedule. You can come back for the other.</Body>
          <div className="flex flex-wrap gap-2">
            {services.map((service, index) => (
              <Button
                key={index}
                variant="secondary"
                size="sm"
                onClick={() => onChoose({ kind: "serviceIndex", index })}
              >
                {service.label ?? `Service ${index + 1}`} · {service.units} units
              </Button>
            ))}
          </div>
        </IssueBox>
      ) : null}
    </div>
  );
}
