import { useCallback, useEffect, useState } from "react";
import type { ValidationResult } from "@careplan/engine";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { PageLoading } from "../../ui/PageLoading";
import { SeverityPill } from "../../ui/SeverityPill";
import { errorMessage } from "../auth/errors";
import { useAgency } from "./agencyContext";
import { listParticipants, listVisits, type ParticipantAlias } from "./participants";
import { toWeekday, workerLoadResults } from "./workerLoadChecks";

/**
 * `/app/agency/worker-load`: the agency's cross-participant worker-load checks (CP4-9).
 * Everything shown about another participant is the agency alias, never a name, DCN or
 * address. CON-04 double-bookings are must-fix; CON-05 40-hour weeks are a check.
 */
export function WorkerLoad() {
  const headingRef = usePageTitle("Worker load | CarePlan Scheduler");
  const { state } = useAgency();
  const tenantId = state.tenantId ?? "";
  const agencyName = state.tenant?.name ?? "";

  const [participants, setParticipants] = useState<ParticipantAlias[] | null>(null);
  const [results, setResults] = useState<ValidationResult[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setProblem(null);
    setBusy(true);
    try {
      const aliases = await listParticipants(tenantId);
      const visits = await listVisits(tenantId, aliases.map((participant) => participant.id));
      setParticipants(aliases);
      setResults(workerLoadResults(visits, toWeekday(state.tenant?.workweekStart)));
    } catch (error) {
      setProblem(errorMessage(error) ?? "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }, [tenantId, state.tenant?.workweekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  if (participants === null || results === null) {
    if (problem) {
      return (
        <div className="mx-auto grid w-full max-w-[720px] gap-4 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
          <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
            We couldn't check worker load
          </h1>
          <p role="alert" className="text-ink-2">
            {problem}
          </p>
          <div>
            <Button busy={busy} onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </div>
      );
    }
    return <PageLoading />;
  }

  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
          Worker load
        </h1>
        <p className="mt-1 max-w-[64ch] text-ink-2">
          A worker in two visits at once is a must-fix. A worker over 40 hours in the workweek is a check, across every
          participant in {agencyName || "your agency"}.
        </p>
      </div>

      <section aria-labelledby="participants-heading" className="grid gap-3">
        <h2 id="participants-heading" className="text-[17px] font-bold text-ink">
          Participants
        </h2>
        {participants.length === 0 ? (
          <p className="text-ink-2">No participants yet.</p>
        ) : (
          <ul className="grid gap-1">
            {participants.map((participant) => (
              <li key={participant.id} className="rounded-sm border border-line px-3 py-2 text-ink">
                {participant.displayName}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="findings-heading" className="grid gap-3">
        <h2 id="findings-heading" className="text-[17px] font-bold text-ink">
          Findings
        </h2>
        {results.length === 0 ? (
          <p className="text-ink-2">No double-bookings or 40-hour weeks.</p>
        ) : (
          <ul className="grid gap-2">
            {results.map((result, index) => (
              <li
                key={`${result.ruleId}-${index}`}
                className="flex items-start gap-3 rounded-sm border border-line px-3 py-2.5"
              >
                <SeverityPill severity={result.severity} />
                <span className="text-ink">{result.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
