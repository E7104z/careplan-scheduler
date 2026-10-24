import type { QuickChecksum } from "./types.js";

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
  if (checksum.matches) {
    return {
      lead: "Every task read.",
      detail: `Our total from these tasks matches Fusion's ${checksum.fusion} units a month.`,
    };
  }
  const figures = Object.entries(checksum.byMonthLength)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([length, units]) => `${units} in a ${length}-day month`)
    .join(", ");
  return {
    lead: `Our total doesn't match Fusion's ${checksum.fusion} units.`,
    detail:
      `From these tasks we get ${figures}. ` +
      "Check that every row came through; Fusion's figure is the one we schedule against.",
  };
}
