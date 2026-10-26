import { useState } from "react";
import { cn } from "../../lib/cn";
import { formatUnits, monthName } from "../../lib/format";
import { Button } from "../../ui/Button";
import { monthFigures } from "./model";
import type { QuickModel } from "./types";

const TABLE_ID = "qs-month-table";

/**
 * APP-SPEC 5.4: every month of the schedule with its authorized, scheduled and left units and the
 * minutes cut at month end, so the cap on billing can be checked month by month. Shown on request,
 * always printed.
 */
export function MonthTable({ model }: { model: QuickModel }) {
  const [open, setOpen] = useState(false);
  const cell = "border-b border-line px-2.5 py-1.5";
  const number = cn(cell, "text-right");

  return (
    <div className="mt-4 grid gap-2">
      <div className="print:hidden">
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={open}
          aria-controls={open ? TABLE_ID : undefined}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide every month" : "Show every month"}
        </Button>
      </div>
      {/* On a phone the table scrolls sideways; with nothing focusable inside, the panel takes focus. */}
      <div
        role="region"
        aria-label="Units by month"
        tabIndex={open ? 0 : undefined}
        className={cn("relative overflow-x-auto", open ? "block" : "hidden", "print:block")}
      >
        <table id={TABLE_ID} className="w-full min-w-[520px] border-collapse text-left text-sm">
          <caption className="sr-only">Units by month</caption>
          <thead className="bg-sunk text-[13px] text-ink-2">
            <tr>
              <th scope="col" className={cn(cell, "font-semibold")}>Month</th>
              <th scope="col" className={cn(number, "font-semibold")}>Authorized</th>
              <th scope="col" className={cn(number, "font-semibold")}>Scheduled</th>
              <th scope="col" className={cn(number, "font-semibold")}>Left</th>
              <th scope="col" className={cn(number, "font-semibold")}>Cut at month end</th>
            </tr>
          </thead>
          <tbody>
            {model.months.map((month) => {
              const figures = monthFigures(model, month);
              const scheduled = figures.transportUnits * 15 + figures.scheduledTaskMinutes;
              const left = figures.authorizedUnits * 15 - scheduled;
              return (
                <tr key={month}>
                  <th scope="row" className={cn(cell, "font-normal")}>{monthName(month)}</th>
                  <td className={number}>{figures.authorizedUnits}</td>
                  <td className={number}>{formatUnits(scheduled)}</td>
                  <td className={cn(number, left < 0 && "text-block")}>
                    {left >= 0 ? formatUnits(left) : `${-left} min over`}
                  </td>
                  <td className={number}>{figures.trimmedMinutes ? `${figures.trimmedMinutes} min` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
