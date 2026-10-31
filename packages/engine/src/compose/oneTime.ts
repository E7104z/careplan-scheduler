import { monthTransportUnits } from "../math/units.js";
import type { DatedOccurrence, MonthlyAuthorization, ServiceAuthorization } from "../types.js";

/** An occurrence after the month's balance was drawn down and capped. */
export interface PlacedOccurrence extends DatedOccurrence {
  /** Minutes cut off by the month's cap; 0 when the occurrence fit in full. */
  trimmedMinutes: number;
}

/** One month's balance after placing its occurrences. */
export interface OneTimeMonthBalance {
  month: string;
  /** The Fusion figure for the month; 0 when there is none. */
  authorizedUnits: number;
  /** Minutes the occurrences may draw down; null = no figure, so nothing is capped. */
  budgetMinutes: number | null;
  scheduledMinutes: number;
  /** Budget left after placement; null when there is no figure to draw down. */
  remainingMinutes: number | null;
}

/** The dated occurrences, each capped to its month's balance, and the per-month balances. */
export interface OneTimePlacement {
  placed: PlacedOccurrence[];
  byMonth: OneTimeMonthBalance[];
}

function requireWholeMinutes(minutes: number): void {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new RangeError(`Chore occurrence minutes must be a whole number >= 0, got ${minutes}`);
  }
}

/**
 * Place dated one-time/intermittent occurrences against their authorization's monthly
 * figures (ADW-05). Occurrences are placed in date order within each month; a month with an
 * imported Fusion figure caps its total at that figure in minutes, trimming the occurrence
 * that crosses the cap and dropping the rest. A month with no imported figure has no cap:
 * its occurrences stay exactly as entered, an editable record. Occurrences outside the
 * authorization period or during a suspension are left out.
 *
 * This is placement math like {@link ./composeWeek.js composeWeek} and
 * {@link ../rules/fit.js fitToAuthorization}; it emits no validation results.
 * @rule ADW-05
 * @source Policy 3.35 (Apr 2011); 3.00 Appendix 1 (rev. Jul 2026), Chore S5120
 */
export function placeOneTimeOccurrences(
  auth: ServiceAuthorization,
  occurrences: DatedOccurrence[],
  monthlyAuthorizations: MonthlyAuthorization[],
): OneTimePlacement {
  const placed: PlacedOccurrence[] = [];
  const byMonth: OneTimeMonthBalance[] = [];

  const months = new Map<string, DatedOccurrence[]>();
  for (const occurrence of occurrences) {
    if (occurrence.serviceAuthId !== auth.id) continue;
    if (occurrence.date < auth.start || occurrence.date > auth.end) continue;
    if (auth.suspensions.some((s) => occurrence.date >= s.start && occurrence.date <= s.end)) continue;
    requireWholeMinutes(occurrence.minutes);
    const month = occurrence.date.slice(0, 7);
    const list = months.get(month) ?? [];
    list.push(occurrence);
    months.set(month, list);
  }

  for (const month of [...months.keys()].sort()) {
    const list = months.get(month)!;
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const imported = monthlyAuthorizations.find(
      (ma) => ma.source === "fusion" && ma.serviceAuthId === auth.id && ma.month === month,
    );
    const budget = imported ? Math.max(0, imported.units - monthTransportUnits(auth)) * 15 : null;

    let scheduledMinutes = 0;
    for (const occurrence of list) {
      let minutes = occurrence.minutes;
      let trimmedMinutes = 0;
      if (budget !== null) {
        const remaining = budget - scheduledMinutes;
        minutes = Math.max(0, Math.min(occurrence.minutes, remaining));
        trimmedMinutes = occurrence.minutes - minutes;
      }
      placed.push({ ...occurrence, minutes, trimmedMinutes });
      scheduledMinutes += minutes;
    }

    byMonth.push({
      month,
      authorizedUnits: imported?.units ?? 0,
      budgetMinutes: budget,
      scheduledMinutes,
      remainingMinutes: budget === null ? null : Math.max(0, budget - scheduledMinutes),
    });
  }

  return { placed, byMonth };
}
