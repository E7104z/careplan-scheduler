import { ruleById, type ScheduleValidationResult } from "@careplan/engine";
import { SeverityPill } from "../../../ui/SeverityPill";
import { copyFor } from "../ruleCopy";
import { WORKSHEET_COPY } from "./worksheetCopy";

const LINE_NAMES: Record<string, string> = {
  nurse: "Nurse visits", hdm: "Home delivered meals", respiteBasic: "Respite: Basic", respiteAdvanced: "Respite: Advanced",
  adultDayCare: "Adult Day Care", adultDayCareWaiver: "Adult Day Care Waiver", chore: "Chore",
};

export interface WorksheetChecksProps {
  results: ScheduleValidationResult[];
  /** Entries the calculator couldn't use, with the sentence saying how to fix each. */
  issues: string[];
  /** The name to show for a task code (the care plan's name for it). */
  taskName: (taskCode: string) => string;
}

/**
 * The worksheet's own checks (WS-R01 to WS-R09, AUTH-09 for respite), in a list with their severity
 * (Phase 3 W-7: shown only here; they never change the schedule's status or the guard).
 */
export function WorksheetChecks({ results, issues, taskName }: WorksheetChecksProps) {
  return (
    <section aria-labelledby="ws-checks" className="grid gap-3">
      <h3 id="ws-checks" className="text-[15px] font-bold text-ink">{WORKSHEET_COPY.checksTitle}</h3>
      <p className="text-[13px] text-ink-2">{WORKSHEET_COPY.checksNote}</p>
      {issues.length > 0 ? (
        <div role="alert" className="rounded-sm bg-block-bg px-3.5 py-2.5 text-sm text-ink">
          <p className="font-semibold">{WORKSHEET_COPY.issuesTitle}</p>
          <ul className="list-disc pl-5">
            {issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        </div>
      ) : null}
      {results.length === 0 ? (
        <p className="text-sm text-ink-2">{WORKSHEET_COPY.noChecks}</p>
      ) : (
        <ul className="grid gap-2">
          {results.map((result, index) => {
            const copy = copyFor(result.ruleId, result.severity);
            const about = result.refs.taskCode ? taskName(result.refs.taskCode) : result.refs.line ? LINE_NAMES[result.refs.line] : undefined;
            return (
              <li key={`${result.ruleId}-${index}`} className="grid gap-1 rounded-md border border-line bg-surface px-4 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  <SeverityPill severity={result.severity} />
                  <span className="font-semibold text-ink">
                    {copy?.title ?? result.ruleId}
                    {about ? <span className="font-normal text-ink-2"> · {about}</span> : null}
                  </span>
                </span>
                <span className="text-sm text-ink-2">{result.message}</span>
                <span className="text-[13px] text-ink-3">
                  Rule {result.ruleId} · {ruleById(result.ruleId)?.source} · checked under {result.rulePackVersion}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
