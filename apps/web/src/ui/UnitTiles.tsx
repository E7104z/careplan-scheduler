import { dayUnits } from "@careplan/engine";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export interface UnitTilesProps {
  dayTotals: number[];
  /** Care days, Sunday first. A day that isn't a care day and has no minutes shows "Off". */
  activeDays?: boolean[];
}

/**
 * The Day total row: one column per weekday with a stack of 10px unit squares
 * (4 per row) plus a partial square filled bottom-up for the remainder. The
 * squares are decorative; the minutes and units are visible text.
 */
export function UnitTiles({ dayTotals, activeDays }: UnitTilesProps) {
  return (
    <ol className="grid grid-cols-7 gap-2">
      {dayTotals.map((minutes, weekday) => {
        const { units, remainder } = dayUnits(minutes);
        const off = activeDays !== undefined && activeDays[weekday] !== true && minutes === 0;
        return (
          <li
            key={weekday}
            className="flex flex-col items-center gap-1.5 rounded-md bg-sunk p-2"
          >
            <span className="text-[13px] font-medium text-ink-2">{DAY_LABELS[weekday]}</span>
            {off ? (
              <span className="text-[13px] text-ink-2">Off</span>
            ) : (
              <>
                <span aria-hidden="true" className="grid grid-cols-4 gap-0.5">
                  {Array.from({ length: units }, (_, index) => (
                    <span key={index} className="h-2.5 w-2.5 rounded-[2px] bg-tile" />
                  ))}
                  {remainder > 0 ? (
                    <span className="flex h-2.5 w-2.5 items-end overflow-hidden rounded-[2px] bg-tile-empty">
                      <span
                        className="block w-full bg-tile"
                        style={{ height: `${(remainder / 15) * 100}%` }}
                      />
                    </span>
                  ) : null}
                </span>
                <span className="text-sm font-semibold text-ink">{minutes} min</span>
                <span className="text-[13px] text-ink-2">
                  {units} unit{units === 1 ? "" : "s"}
                  {remainder > 0 ? ` + ${remainder} min` : ""}
                </span>
                {remainder > 0 ? <span className="text-[13px] font-medium text-brand">+{remainder} min accrues</span> : null}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
