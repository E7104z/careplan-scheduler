import { Lock } from "lucide-react";
import { niceDate } from "../../lib/format";
import { PaneSection } from "./PaneSection";
import type { QuickModel, QuickState } from "./types";

/** APP-SPEC 5.2, from Fusion: the plan's service and dates, read-only. */
export function FusionPlanSection({ state, model }: { state: QuickState; model: QuickModel }) {
  return (
    <PaneSection title="Care plan">
      <dl className="flex flex-wrap gap-x-7 gap-y-2">
        <div className="grid">
          <dt className="text-[13px] text-ink-3">Service</dt>
          <dd className="text-ink">{model.svc.name}</dd>
        </div>
        <div className="grid">
          <dt className="text-[13px] text-ink-3">Plan</dt>
          <dd className="text-ink">{`${niceDate(state.plan.start)} to ${niceDate(state.plan.end)}`}</dd>
        </div>
      </dl>
      <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
        <Lock className="h-3.5 w-3.5 flex-none text-ink-3" aria-hidden="true" />
        Minutes and days come from Fusion and can't be changed here.
      </p>
    </PaneSection>
  );
}
