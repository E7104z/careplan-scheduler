/**
 * Read-only projected accruals (ACC-01 through ACC-06): where a schedule's leftover
 * minutes (the part of each day that doesn't make a whole 15-minute unit) build up through
 * a month into further whole units. Pure: it takes the expanded month map and returns the
 * projection. It never changes a schedule, an authorization or any care-plan minutes.
 *
 * @source vendor-sourced; official MO HealthNet bulletin pending (HHAeXchange Missouri EVV
 * configuration notice for reason code 280; Sandata Missouri Accrued Minutes Visits article;
 * 13 CSR 70-91.010 on not billing under one unit)
 */

/** The dates whose leftover minutes supplied part of a unit. */
export interface AccrualContribution {
  /** The date (YYYY-MM-DD) whose leftover minutes supplied part of a unit. */
  date: string;
  /** How many of that date's leftover minutes went into the unit. */
  minutes: number;
}

/** One date's place in the monthly projection. */
export interface AccrualDay {
  date: string;
  /** The date's scheduled task minutes for one service. */
  dayMinutes: number;
  /** Whole units the date's minutes make on their own. */
  dayUnits: number;
  /** The part of the date's minutes left after whole units (0 to 14). */
  remainder: number;
  /** The running monthly balance of leftover minutes after this date. */
  balanceAfter: number;
  /** How many accrued units became available on this date (0 or 1). */
  unitsAvailable: number;
}

/** One accrued unit and the dates that supplied its 15 minutes. */
export interface AccrualUnit {
  /** 1-based unit number within the month. */
  number: number;
  /** The date the unit became available. */
  availableOn: string;
  /** The dates that supplied the unit's 15 minutes, first in first out. */
  contributions: AccrualContribution[];
}

/** The whole month's read-only accrual projection. */
export interface AccrualProjection {
  days: AccrualDay[];
  units: AccrualUnit[];
  /** All leftover minutes in the month. */
  accruedMinutes: number;
  /** Whole units the leftover minutes make: floor(accruedMinutes / 15). */
  potentialAmvUnits: number;
  /** Leftover minutes that never make a unit (accruedMinutes % 15). */
  remainingMinutes: number;
  /** The dates those remaining minutes came from. */
  remainingContributions: AccrualContribution[];
}

/** Sum the minutes still waiting in the FIFO queue. */
function queueMinutes(queue: AccrualContribution[]): number {
  let total = 0;
  for (const chunk of queue) total += chunk.minutes;
  return total;
}

/**
 * ACC-01..ACC-06: project one month's accrual from the engine's expanded map
 * (Record<date, Record<taskId, minutes>>). Dates are read in order; each day's remainder is
 * added to a running balance, and each time the balance reaches 15 a unit becomes available
 * on that date. A day's remainder can be split across two units, first in first out.
 */
export function projectAccrual(expanded: Record<string, Record<string, number>>): AccrualProjection {
  const days: AccrualDay[] = [];
  const units: AccrualUnit[] = [];
  // FIFO queue of leftover minutes still waiting to make a unit.
  let queue: AccrualContribution[] = [];
  let accruedMinutes = 0;

  for (const date of Object.keys(expanded).sort()) {
    let dayMinutes = 0;
    for (const minutes of Object.values(expanded[date] ?? {})) dayMinutes += minutes;
    const dayUnits = Math.floor(dayMinutes / 15);
    const remainder = dayMinutes % 15;
    accruedMinutes += remainder;
    if (remainder > 0) queue.push({ date, minutes: remainder });

    let available = 0;
    while (queueMinutes(queue) >= 15) {
      const unit: AccrualUnit = { number: units.length + 1, availableOn: date, contributions: [] };
      let need = 15;
      const next: AccrualContribution[] = [];
      for (const chunk of queue) {
        if (need === 0) {
          next.push(chunk);
          continue;
        }
        const take = Math.min(chunk.minutes, need);
        unit.contributions.push({ date: chunk.date, minutes: take });
        need -= take;
        if (take < chunk.minutes) next.push({ date: chunk.date, minutes: chunk.minutes - take });
      }
      queue = next;
      units.push(unit);
      available += 1;
    }

    days.push({
      date,
      dayMinutes,
      dayUnits,
      remainder,
      balanceAfter: queueMinutes(queue),
      unitsAvailable: available,
    });
  }

  return {
    days,
    units,
    accruedMinutes,
    potentialAmvUnits: units.length,
    remainingMinutes: queueMinutes(queue),
    remainingContributions: queue,
  };
}
