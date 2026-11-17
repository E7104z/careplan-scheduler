import { Info } from "lucide-react";
import { Link } from "react-router";
import { GATE_COPY, type StorageGate } from "./storageGate";

/** Why saving to the agency is closed, and the one thing that opens it (PHASE-3-SPEC section 6). */
export function StorageNotice({ gate, isOwner }: { gate: StorageGate; isOwner: boolean }) {
  if (gate === "open" || gate === "loading") return null;
  const copy = GATE_COPY[gate];
  return (
    <div role="note" className="flex items-start gap-2.5 rounded-sm bg-info-bg px-3.5 py-3 text-sm text-ink">
      <Info className="mt-0.5 h-4 w-4 flex-none text-info" aria-hidden="true" />
      <div className="grid gap-1">
        <p className="font-semibold">{copy.title}</p>
        <p>{copy.detail}</p>
        {gate === "needs-baa" && isOwner ? (
          <p>
            <Link to="/app/agency/baa" className="rounded-sm font-semibold text-brand underline hover:text-brand-hover">
              Review and accept the agreement
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
