import type { ValidationResult } from "../types.js";
import type { NurseTask } from "./calc3a.js";
import type { GuidanceRow } from "./guidance.js";

/** What the worksheet rules read about one task row (or one 3a line, which has no task). */
export interface StateParityRuleRow {
  taskCode: string;
  /** A 3a line with no task ("adultDayCare", "hdm", …); results then name the line. */
  line?: string;
  minPerDay: number | null;
  totalUnits: number | null;
  description?: string;
  /** The form's row for this task, with its suggested time; undefined when the task isn't on the form. */
  guidance: GuidanceRow | undefined;
}

/**
 * A task's Min/Day is outside the form's suggested time. Below the low end is always flagged.
 * Above the high end is flagged only for a task with a weekly frequency ("1-7 X WK"): the
 * suggested time is for one occurrence, and a task done "as needed", "per transfer" or "as ordered"
 * can happen several times a day. Rows whose suggested time is not minutes are skipped.
 * @rule WS-R01
 * @source HCBS-3c (10/26) and HCBS-3a (07/26) suggested time columns
 */
export function ruleWSR01OutsideSuggestedRange(rows: readonly StateParityRuleRow[]): ValidationResult[] {
  return rows.flatMap((row): ValidationResult[] => {
    const guidance = row.guidance;
    if (!guidance || guidance.minLow === null || guidance.minHigh === null) return [];
    if (row.minPerDay === null || row.totalUnits === null) return [];
    const below = row.minPerDay < guidance.minLow;
    const above = guidance.frequency !== null && row.minPerDay > guidance.minHigh;
    if (!below && !above) return [];
    return [{
      ruleId: "WS-R01", severity: "INFO",
      message: `Outside DSDS's suggested range of ${guidance.time}. Describe the need.`,
      refs: { taskCode: row.taskCode },
    }];
  });
}

/**
 * An ILW request (the 3c's ILW tab, or a 3a marked as part of an ILW request) with a task that has
 * units and no Description of needs. The manual says "all ILW requests"; it is applied per task.
 * @rule WS-R02
 * @source HCBS Manual 4.00 Appendix 4 (rev. Jul 2026) and Appendix 3 (rev. May 2025): Description of Needs is required for ILW requests
 */
export function ruleWSR02IlwDescription(rows: readonly StateParityRuleRow[], ilwRequest: boolean): ValidationResult[] {
  if (!ilwRequest) return [];
  return rows
    .filter((row) => (row.totalUnits ?? 0) > 0 && !row.description?.trim())
    .map((row): ValidationResult => ({
      ruleId: "WS-R02", severity: "REVIEW",
      message: "Describe why this task is needed and why this time is right.",
      refs: row.line ? { line: row.line } : { taskCode: row.taskCode },
    }));
}

/**
 * The CDS tab's total is above the State Plan maximum (the sheet turns it red): the manual says a
 * participant needing more should be considered for the Independent Living Waiver.
 * @rule WS-R03
 * @source HCBS Manual 4.00 Appendix 4 (rev. Jul 2026)
 */
export function ruleWSR03ConsiderIlw(tab: "CDS" | "ILW", totalUnits: number, ceiling: number): ValidationResult[] {
  if (tab !== "CDS" || totalUnits <= ceiling) return [];
  return [{
    ruleId: "WS-R03", severity: "INFO",
    message: "Needs more than the State Plan maximum. The manual says to consider the Independent Living Waiver.",
    refs: {},
  }];
}

/**
 * Advanced Personal Care with exactly one task that has units: its minutes must be in 15-minute steps.
 * @rule WS-R04
 * @source HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care
 */
export function ruleWSR04ApcSingleTask(apcRows: readonly StateParityRuleRow[], step: number): ValidationResult[] {
  const withUnits = apcRows.filter((row) => (row.totalUnits ?? 0) > 0);
  const only = withUnits.length === 1 ? withUnits[0]! : null;
  if (!only || (only.minPerDay ?? 0) % step === 0) return [];
  return [{
    ruleId: "WS-R04", severity: "BLOCK",
    message: `With one Advanced Personal Care task, enter its minutes in ${step}-minute steps.`,
    refs: { taskCode: only.taskCode },
  }];
}

/**
 * Advanced Personal Care needs two nurse visits in its first month (to help build the care plan and
 * train the aide), unless the plan already has ongoing nurse visits.
 * @rule WS-R05
 * @source HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care
 */
export function ruleWSR05ApcFirstMonthNurse(apcUnits: number, visitsPerMonth: number | null, firstMonthVisits: number | null): ValidationResult[] {
  if (apcUnits <= 0 || (visitsPerMonth ?? 0) >= 1 || (firstMonthVisits ?? 0) >= 2) return [];
  return [{
    ruleId: "WS-R05", severity: "REVIEW",
    message: "Advanced Personal Care needs two nurse visits in its first month, unless the plan has ongoing nurse visits.",
    refs: { line: "nurse" },
  }];
}

const MONTH_NAME = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/i;

/**
 * General Health Evaluation is checked and the Comments name no month.
 * @rule WS-R06
 * @source HCBS Manual 4.00 Appendix 3 (rev. May 2025), Authorized Nurse Visits and Comments
 */
export function ruleWSR06GeneralHealthEvaluation(tasks: readonly NurseTask[], comments: string): ValidationResult[] {
  if (!tasks.includes("GENERAL_HEALTH_EVALUATION") || MONTH_NAME.test(comments)) return [];
  return [{
    ruleId: "WS-R06", severity: "WARN",
    message: "Check this only for semi-annual visits and name the months in Comments.",
    refs: { line: "nurse" },
  }];
}

/**
 * The nurse task "Other" (venipuncture, physician-ordered injections and the like) is checked.
 * @rule WS-R07
 * @source HCBS Manual 4.00 Appendix 3 (rev. May 2025), Authorized Nurse Visits
 */
export function ruleWSR07NurseOther(tasks: readonly NurseTask[]): ValidationResult[] {
  if (!tasks.includes("OTHER")) return [];
  return [{
    ruleId: "WS-R07", severity: "INFO",
    message: "Needs prior approval and authorization from DSDS or its designee.",
    refs: { line: "nurse" },
  }];
}

/** One adult day care line as the rule reads it. */
export interface AdultDayCareRow {
  line: "adultDayCare" | "adultDayCareWaiver";
  minPerDay: number | null;
  daysPerWeek: number | null;
}

/**
 * Adult Day Care (63+) and Adult Day Care Waiver (18–62): minutes in multiples of 15, at most
 * 10 hours a day, at most 5 days a week. The workbook itself only checks 1–7 days.
 * @rule WS-R08
 * @source HCBS Manual 4.00 Appendix 3 (rev. May 2025), Adult Day Care
 */
export function ruleWSR08AdultDayCare(
  rows: readonly AdultDayCareRow[],
  limits: { minuteStep: number; maxMinutesPerDay: number; maxDaysPerWeek: number },
): ValidationResult[] {
  return rows
    .filter(({ minPerDay, daysPerWeek }) =>
      (minPerDay !== null && (minPerDay % limits.minuteStep !== 0 || minPerDay > limits.maxMinutesPerDay)) ||
      (daysPerWeek !== null && daysPerWeek > limits.maxDaysPerWeek))
    .map(({ line }): ValidationResult => ({
      ruleId: "WS-R08", severity: "BLOCK",
      message: `Enter adult day care in ${limits.minuteStep}-minute steps, at most ${limits.maxMinutesPerDay / 60} hours a day and ${limits.maxDaysPerWeek} days a week.`,
      refs: { line },
    }));
}

/**
 * More than 2 Home Delivered Meals a day. "Max 2/day" is printed beside the meals rate on the 3a's
 * rate sheet; no manual text states it, so this is a question for DSDS (PARTIAL).
 * @rule WS-R09
 * @source HCBS-3a (07/26) rate sheet cell G14: "Max 2/day"
 */
export function ruleWSR09HdmUnits(unitsPerDay: number | null, max: number): ValidationResult[] {
  if (unitsPerDay === null || unitsPerDay <= max) return [];
  return [{
    ruleId: "WS-R09", severity: "REVIEW",
    message: `More than ${max} meals a day. DSDS's rate sheet notes a maximum of ${max} a day.`,
    refs: { line: "hdm" },
  }];
}
