import type { QuickChecksum } from "./types.js";

/**
 * "455 a month", or "455 for a 30-day month" when Fusion's one figure is for one month length
 * and our total for the others differs (IMP-10).
 */
export function fusionUnitsText(checksum: QuickChecksum | null, units: number): string {
  if (!checksum?.matches) return `${units} a month`;
  const values = Object.entries(checksum.byMonthLength);
  const matched = values.filter(([, total]) => total === units);
  return matched.length === 1 && values.length > 1 ? `${units} for a ${matched[0]![0]}-day month` : `${units} a month`;
}

/** The checksum line, with its bold lead sentence separate from the rest. */
export interface ChecksumLines {
  lead: string;
  detail: string;
}

/**
 * IMP-15 / APP-SPEC 5.1: whether our total from the tasks read matches Fusion's monthly units,
 * and if not, what we get for each month length in the plan (shortest month first).
 */
export function checksumLines(checksum: QuickChecksum): ChecksumLines {
  const lengths = Object.entries(checksum.byMonthLength).sort(([a], [b]) => Number(b) - Number(a));
  if (checksum.matches) {
    // IMP-10: Fusion's one figure is for one month length; it prorates daily tasks to the others.
    const matched = lengths.filter(([, units]) => units === checksum.fusion);
    const others = lengths.filter(([, units]) => units !== checksum.fusion);
    if (others.length === 0 || matched.length !== 1) {
      return {
        lead: "Every task read.",
        detail: `Our total from these tasks matches Fusion's ${checksum.fusion} units a month.`,
      };
    }
    // "a 31-day month has 469 and a 28-day month 434"
    const list = others
      .map(([length, units], index) => `a ${length}-day month ${index === 0 ? "has " : ""}${units}`)
      .join(" and ");
    return {
      lead: "Every task read.",
      detail:
        `Our total from these tasks matches Fusion's ${checksum.fusion} units for a ${matched[0]![0]}-day month. ` +
        `Fusion counts the days in each month for daily tasks, so ${list}.`,
    };
  }
  const figures = [...lengths]
    .reverse()
    .map(([length, units]) => `${units} in a ${length}-day month`)
    .join(", ");
  return {
    lead: `Our total doesn't match Fusion's ${checksum.fusion} units.`,
    detail:
      `From these tasks we get ${figures}. Check that every row came through. We schedule against Fusion's figure, ` +
      "lowered in shorter months by what the daily tasks lose there.",
  };
}
