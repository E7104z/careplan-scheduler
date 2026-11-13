import { cn } from "../../lib/cn";
import { formatUnits, monthName, niceDate } from "../../lib/format";
import { monthBalance } from "./model";
import type { MonthFigures, QuickModel } from "./types";

/** "Fusion: 455 units", "Fusion, for a 31-day month: 469 units" or "Calculated: 181 units". */
export function authorizedLabel(figures: MonthFigures): string {
  if (figures.source !== "fusion") return `Calculated: ${figures.calculatedUnits} units`;
  return figures.proratedDays !== null
    ? `Fusion, for a ${figures.proratedDays}-day month: ${figures.authorizedUnits} units`
    : `Fusion: ${figures.authorizedUnits} units`;
}

/** Each trimmed date with the tasks cut that day and their minutes, latest task cut first. */
function trimmedDays(model: QuickModel, figures: MonthFigures): { date: string; tasks: string }[] {
  const names = new Map(model.tasks.map((task) => [task.id, task.name]));
  const byDate = new Map<string, { name: string; minutes: number }[]>();
  for (const trim of figures.trims) {
    const list = byDate.get(trim.date) ?? [];
    list.push({ name: names.get(trim.taskId) ?? trim.taskId, minutes: -trim.minutesDelta });
    byDate.set(trim.date, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tasks]) => ({
      date,
      tasks: tasks
        .sort((a, b) => b.minutes - a.minutes)
        .map((task) => `${task.name} ${task.minutes} min`)
        .join(", "),
    }));
}

function Figure({ term, value, note, tone }: { term: string; value: string; note: string; tone?: "block" }) {
  return (
    <div className="grid content-start">
      <dt className="text-[13px] text-ink-3">{term}</dt>
      <dd className={cn("text-[17px] font-bold text-ink", tone === "block" && "text-block")}>{value}</dd>
      <dd className="text-[13px] text-ink-2">{note}</dd>
    </div>
  );
}

/**
 * APP-SPEC 5.4 month balance: authorized, scheduled and left for the viewed month (so the cap on
 * billing is visible), the meter, and, when the month's units run out, exactly which tasks are cut
 * on which dates and what to do about it (INFO 09-25-02).
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
  const firstTrim = figures.trims.length ? figures.trims.map((trim) => trim.date).sort()[0] : null;
  const days = trimmedDays(model, figures);
  const monthOnly = monthName(month).split(" ")[0];

  return (
    <div className="grid gap-3 rounded-md border border-line bg-surface p-4">
      <dl aria-label={`Units in ${monthName(month)}`} className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <Figure
          term="Authorized"
          value={`${figures.authorizedUnits} units`}
          note={figures.source === "fusion" ? (figures.proratedDays !== null ? `Fusion, for ${figures.proratedDays} days` : "Fusion") : "Calculated from the tasks"}
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
          note={leftMinutes >= 0 ? "Not scheduled, not billed" : "See Checks below"}
          tone={leftMinutes < 0 ? "block" : undefined}
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
        {figures.over ? <div className="h-full bg-block" style={{ flexBasis: `${overPct}%` }} /> : null}
      </div>
      {figures.trimmedMinutes && firstTrim ? (
        <div className="grid gap-1.5 text-[13px] text-ink">
          <p className="text-warn">
            This month's tasks need more than Fusion's {figures.authorizedUnits} units, so the schedule stops{" "}
            {figures.trimmedMinutes} minutes early, starting {niceDate(firstTrim)}. Those days are marked below.
          </p>
          <p className="font-semibold">Cut at the end of {monthOnly}:</p>
          <ul className="grid list-disc gap-0.5 pl-[18px]">
            {days.map((day) => (
              <li key={day.date}>
                {niceDate(day.date)}: {day.tasks}
              </li>
            ))}
          </ul>
          <p className="text-ink-2">
            If the units run out every month, the care plan needs more than Fusion authorizes. DSDS says a consistent
            need to change a task should prompt a request to the care plan change team (INFO 09-25-02).
          </p>
        </div>
      ) : null}
      {figures.over ? (
        <p className="text-[13px] text-block">
          {figures.scheduledTaskMinutes - figures.taskBudgetMinutes} minutes over. See Checks below.
        </p>
      ) : null}
    </div>
  );
}
