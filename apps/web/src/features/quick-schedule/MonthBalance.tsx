import { cn } from "../../lib/cn";
import { formatUnits, monthName } from "../../lib/format";
import { monthBalance } from "./model";
import { SHORTFALL_CONSECUTIVE_MONTHS, recurringShortfall } from "./shortfall";
import type { MonthFigures, QuickModel } from "./types";

/** "Fusion: 455 units" or "Calculated: 181 units". */
export function authorizedLabel(figures: MonthFigures): string {
  return figures.source === "fusion"
    ? `Fusion: ${figures.authorizedUnits} units`
    : `Calculated: ${figures.calculatedUnits} units`;
}

function Figure({ term, value, note, tone }: { term: string; value: string; note: string; tone?: "warn" }) {
  return (
    <div className="grid content-start">
      <dt className="text-[13px] text-ink-3">{term}</dt>
      <dd className={cn("text-[17px] font-bold text-ink", tone === "warn" && "text-warn")}>{value}</dd>
      <dd className="text-[13px] text-ink-2">{note}</dd>
    </div>
  );
}

/**
 * APP-SPEC 5.4 month balance: authorized, scheduled and left for the viewed month (so the cap on
 * billing is visible), the meter, and, when a month's tasks need more than its authorization, a
 * warning to make reasonable scheduling adjustments (DSDS Nov 24, 2026) rather than stop visits.
 */
export function MonthBalance({
  model,
  month,
  figures,
  combinedRespite,
}: {
  model: QuickModel;
  month: string;
  figures: MonthFigures;
  /** The combined Basic + Advanced figure (engine AUTH-09), shown only on a respite service. */
  combinedRespite?: { units: number; ceiling: number } | null;
}) {
  const available = figures.authorizedUnits - figures.transportUnits;
  const cap = Math.max(figures.taskBudgetMinutes, figures.scheduledTaskMinutes, 1);
  const fill = (Math.min(figures.scheduledTaskMinutes, figures.taskBudgetMinutes) / cap) * 100;
  const overPct = figures.over ? ((figures.scheduledTaskMinutes - figures.taskBudgetMinutes) / cap) * 100 : 0;
  const { scheduledMinutes, leftMinutes } = monthBalance(figures);
  const recurring = recurringShortfall(model);

  return (
    <div className="grid gap-3 rounded-md border border-line bg-surface p-4">
      <dl aria-label={`Units in ${monthName(month)}`} className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <Figure
          term="Authorized"
          value={`${figures.authorizedUnits} units`}
          note={figures.source === "fusion" ? "Fusion" : "Calculated from the tasks"}
        />
        <Figure
          term="Scheduled"
          value={formatUnits(scheduledMinutes)}
          note={
            figures.transportUnits
              ? `${formatUnits(figures.scheduledTaskMinutes)} for tasks, ${figures.transportUnits} for transportation`
              : "All for tasks"
          }
        />
        <Figure
          term="Left"
          value={leftMinutes >= 0 ? formatUnits(leftMinutes) : `${-leftMinutes} min over`}
          note={leftMinutes >= 0 ? "Not scheduled, not billed" : "More than authorized"}
          tone={leftMinutes < 0 ? "warn" : undefined}
        />
      </dl>
      {combinedRespite != null && model.svc.combinedCeilingGroup === "RESPITE" ? (
        <p className="text-sm text-ink">
          Combined respite (Basic + Advanced):{" "}
          <strong className="font-bold">
            {combinedRespite.units} of {combinedRespite.ceiling} units
          </strong>
        </p>
      ) : null}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-ink">
          <strong className="font-bold">{formatUnits(figures.scheduledTaskMinutes)}</strong> scheduled for tasks of{" "}
          {available} available
        </p>
        <span className="text-[13px] text-ink-3">
          {authorizedLabel(figures)}
          {figures.transportUnits ? ` − ${figures.transportUnits} transportation` : ""}
        </span>
      </div>
      <div
        role="img"
        aria-label={figures.over ? "Over the month's authorization" : "Within the month's authorization"}
        className="flex h-3 w-full overflow-hidden rounded-full bg-sunk"
      >
        <div className="h-full bg-tile" style={{ flexBasis: `${fill}%` }} />
        {figures.over ? <div className="h-full bg-warn" style={{ flexBasis: `${overPct}%` }} /> : null}
      </div>
      {figures.over ? (
        <p className="text-[13px] text-warn">
          This month's tasks need {figures.scheduledTaskMinutes - figures.taskBudgetMinutes} minutes more than{" "}
          {figures.source === "fusion" ? "Fusion authorizes" : "the tasks add up to"}. Make reasonable scheduling
          adjustments to stay within the authorized units while still meeting the participant's needs — don't simply
          stop visits when units run out.
        </p>
      ) : null}
      {recurring ? (
        <p className="text-[13px] text-warn">
          These tasks have needed more than the authorization for {SHORTFALL_CONSECUTIVE_MONTHS} months in a row (our
          default threshold). The units may be consistently insufficient: notify DSDS and request a review, and ask for
          a care plan change.
        </p>
      ) : null}
    </div>
  );
}
