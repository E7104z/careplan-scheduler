import { DateTime } from "luxon";

const ZONE = "America/Chicago";

/** SCH-15: real elapsed minutes between two local datetimes in America/Chicago. */
export function elapsedMinutes(startLocal: string, endLocal: string): number {
  const start = DateTime.fromISO(startLocal, { zone: ZONE });
  const end = DateTime.fromISO(endLocal, { zone: ZONE });
  return Math.round(end.diff(start, "minutes").minutes);
}

/** SCH-15: split a visit by calendar date using real elapsed time (DST-safe). */
export function splitByDate(startLocal: string, endLocal: string): Record<string, number> {
  const start = DateTime.fromISO(startLocal, { zone: ZONE });
  const end = DateTime.fromISO(endLocal, { zone: ZONE });
  const result: Record<string, number> = {};

  let cursor = start;
  while (cursor < end) {
    const nextMidnight = cursor.plus({ days: 1 }).startOf("day");
    const segmentEnd = nextMidnight > end ? end : nextMidnight;
    const minutes = Math.round(segmentEnd.diff(cursor, "minutes").minutes);
    const dateKey = cursor.toFormat("yyyy-MM-dd");
    result[dateKey] = (result[dateKey] ?? 0) + minutes;
    cursor = nextMidnight;
  }

  return result;
}
