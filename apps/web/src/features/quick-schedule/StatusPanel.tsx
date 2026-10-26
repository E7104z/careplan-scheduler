import { CircleCheck, OctagonX } from "lucide-react";
import { cn } from "../../lib/cn";
import { monthName } from "../../lib/format";
import { scheduleStatus } from "./status";
import type { QuickModel, QuickState } from "./types";

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <p className="grid">
      <span className="text-[22px] font-bold leading-tight text-ink">{value}</span>
      <span className="text-[13px] text-ink-2">{label}</span>
    </p>
  );
}

/**
 * APP-SPEC 5.4 Status: whether the schedule is ready to use, from the grouped check results
 * (one group = one card in Checks), with the week's minutes, the viewed month's units and the
 * care days. Announced politely when it changes.
 */
export function StatusPanel({ state, model }: { state: QuickState; model: QuickModel }) {
  const box = "flex flex-wrap items-center gap-x-7 gap-y-4 rounded-md border border-line bg-surface px-5 py-4 max-sm:px-4";
  const { title, detail, blocked, weekMinutes, monthUnits, careDays } = scheduleStatus(state, model);

  if (model.tasks.length === 0) {
    return (
      <div role="status" aria-live="polite" aria-label="Schedule status" className={box}>
        <div>
          <p className="text-[17px] font-bold text-ink">{title}</p>
          <p className="text-sm text-ink-2">{detail}</p>
        </div>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" aria-label="Schedule status" className={box}>
      <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-10 w-10 flex-none place-items-center rounded-full",
            blocked ? "bg-block-bg text-block" : "bg-brand-tint text-brand",
          )}
        >
          {blocked ? <OctagonX className="h-5 w-5" /> : <CircleCheck className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-bold text-ink">{title}</p>
          <p className="text-sm text-ink-2">{detail}</p>
        </div>
      </div>
      <Figure value={weekMinutes} label="minutes a week" />
      <Figure value={monthUnits} label={`units in ${monthName(state.viewMonth).split(" ")[0]}`} />
      <Figure value={careDays} label="care days a week" />
    </div>
  );
}
