import type { ValidationResult } from "../types.js";
import type { GuidanceRow } from "./guidance.js";

/** What the worksheet rules read about one task row. */
export interface WorksheetRuleRow {
  taskCode: string;
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
export function ruleWSR01OutsideSuggestedRange(rows: readonly WorksheetRuleRow[]): ValidationResult[] {
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
export function ruleWSR02IlwDescription(rows: readonly WorksheetRuleRow[], ilwRequest: boolean): ValidationResult[] {
  if (!ilwRequest) return [];
  return rows
    .filter((row) => (row.totalUnits ?? 0) > 0 && !row.description?.trim())
    .map((row): ValidationResult => ({
      ruleId: "WS-R02", severity: "REVIEW",
      message: "Describe why this task is needed and why this time is right.",
      refs: { taskCode: row.taskCode },
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
