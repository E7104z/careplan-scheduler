import { elapsedMinutes } from "../calendar/time.js";
import type { CoverageBlock } from "../types.js";

/**
 * Whole 15-minute units in a respite coverage block, from its start/end span of care. Uses real
 * elapsed time (SCH-15, DST-safe) and floors to whole units, the same floor as transport units
 * ({@link ../math/units.js monthTransportUnits}); a block shorter than 15 minutes is 0 units.
 */
export function coverageBlockUnits(block: CoverageBlock): number {
  const minutes = elapsedMinutes(block.start, block.end);
  return Math.floor(Math.max(0, minutes) / 15);
}