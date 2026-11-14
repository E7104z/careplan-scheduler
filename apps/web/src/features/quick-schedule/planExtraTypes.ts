import type { CalendarException, OtherProgram } from "@careplan/engine";

/** How much a missed task matters (CP4-8 backup coverage), as the person enters it; never guessed. */
export type CoopPriority = "HIGH" | "MEDIUM" | "LOW";

/** Dates a caregiver can't give care (CP4-8), as the person marked them. Stores the id, never a name. */
export interface Unavailability {
  id: string;
  caregiverId: string;
  /** YYYY-MM-DD, first day away. */
  start: string;
  /** YYYY-MM-DD, last day away. */
  end: string;
}

/**
 * Backup and emergency coverage (CP4-8, Manual 4.15 and 4.20): who is away, the replacements the
 * person chose (each a `CalendarException` of kind "substitute"; the authorization is never
 * changed) and the priority entered for each task that would be missed, by task id.
 */
export interface PlanBackup {
  unavailable: Unavailability[];
  substitutes: CalendarException[];
  priorities: Record<string, CoopPriority>;
}

/** A program outside DSDS the participant is in (CP4-7: PACE, a DMH program), as the person entered it. */
export interface PlanProgram {
  program: OtherProgram;
  /** YYYY-MM-DD the enrollment begins. */
  start: string;
  /** YYYY-MM-DD the enrollment ends. */
  end: string;
}
