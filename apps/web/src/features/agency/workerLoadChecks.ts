import {
  ruleCON04CaregiverOverlap,
  ruleCON05CaregiverHours,
  type ValidationResult,
  type Visit,
  type Weekday,
} from "@careplan/engine";

/**
 * CP4-9: the agency's cross-participant worker-load checks, on the union of its
 * participants' visits. CON-04 double-bookings are BLOCK; CON-05 40-hour weeks are
 * WARN, using the tenant's workweek start (an FLSA workweek is the employer's to fix).
 */
export function workerLoadResults(visits: Visit[], workweekStart: Weekday): ValidationResult[] {
  return [...ruleCON04CaregiverOverlap(visits), ...ruleCON05CaregiverHours(visits, workweekStart)];
}

/** The tenant's workweek start day, read defensively: Sunday (0) when it isn't a valid day. */
export function toWeekday(value: number | undefined): Weekday {
  return value !== undefined && Number.isInteger(value) && value >= 0 && value <= 6 ? (value as Weekday) : 0;
}
