import { monthTransportUnits } from "../math/units.js";
import { expandMonth, monthTaskMinutes } from "../calendar/expand.js";
import type { CalendarException, MonthlyAuthorization, ScheduleTemplate, ServiceAuthorization } from "../types.js";

/**
 * Trim each month with an imported Fusion figure down to that figure, from the last scheduled
 * date backward. Returns `kind: "fit"` exceptions and emits no results; validateSchedule does
 * not call it (the app passes its result in as exceptions).
 * @rule SCH-17
 * @source Product decision approved Oct 21, 2026 (schedules never exceed SCH-08)
 */
export function fitToAuthorization(
  template: ScheduleTemplate,
  auth: ServiceAuthorization,
  monthlyAuthorizations: MonthlyAuthorization[],
  months: string[],
): CalendarException[] {
  const daysPerWeek = new Map(auth.tasks.map((task) => [task.id, task.daysPerWeek]));
  const trims: CalendarException[] = [];
  for (const month of months) {
    // Months without a Fusion figure use derived units, which fit by construction.
    const imported = monthlyAuthorizations.find(
      (ma) => ma.source === "fusion" && ma.serviceAuthId === auth.id && ma.month === month,
    );
    if (!imported) continue;
    const [yearStr, monthStr] = month.split("-");
    const expanded = expandMonth(template, [], Number(yearStr), Number(monthStr), auth.start, auth.end);
    const budget = Math.max(0, imported.units - monthTransportUnits(auth)) * 15;
    const scheduled = Object.values(monthTaskMinutes(expanded)).reduce((sum, minutes) => sum + minutes, 0);
    let over = scheduled - budget;

    const dates = Object.keys(expanded).sort();
    for (let i = dates.length - 1; i >= 0 && over > 0; i--) {
      const date = dates[i]!;
      // Daily (7-day) tasks first, then longer occurrences, then task id.
      const entries = Object.entries(expanded[date] ?? {})
        .filter(([, minutes]) => minutes > 0)
        .sort(
          ([idA, minA], [idB, minB]) =>
            (daysPerWeek.get(idB) ?? 0) - (daysPerWeek.get(idA) ?? 0) ||
            minB - minA ||
            (idA < idB ? -1 : idA > idB ? 1 : 0),
        );
      for (const [taskId, minutes] of entries) {
        if (over <= 0) break;
        const cut = Math.min(over, minutes);
        trims.push({
          id: `fit-${date}-${taskId}`,
          participantId: auth.participantId,
          date,
          taskId,
          minutesDelta: -cut,
          reason: "Units for the month run out",
          author: "CarePlan Scheduler",
          createdAt: "",
          kind: "fit",
        });
        over -= cut;
      }
    }
  }
  return trims;
}
