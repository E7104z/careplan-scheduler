import type { RulePack } from "../rulepacks/types.js";
import type { Severity, ValidationResult } from "../types.js";
import type { ScheduleValidationResult } from "../validate.js";
import { calculate3c, type Worksheet3cInput } from "./calc3c.js";
import { guidanceForTask } from "./guidance.js";
import { ruleWSR01OutsideSuggestedRange, ruleWSR02IlwDescription, ruleWSR03ConsiderIlw } from "./rules.js";

const SEVERITY_ORDER: Record<Severity, number> = { BLOCK: 0, REVIEW: 1, WARN: 2, INFO: 3 };

/** Stamp each result with the rule-pack version and order them BLOCK, REVIEW, WARN, INFO, as `validatePlan` does. */
export function stampWorksheetResults(results: ValidationResult[], pack: RulePack): ScheduleValidationResult[] {
  return results
    .map((result) => ({ ...result, rulePackVersion: pack.id }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/**
 * The worksheet rules for an HCBS-3c (Amendment C): WS-R01 to WS-R03, stamped with the
 * rule-pack version. Never called by `validatePlan` or `validateSchedule` (W-7).
 */
export function validateWorksheet3c(input: Worksheet3cInput, pack: RulePack): ScheduleValidationResult[] {
  const result = calculate3c(input, pack);
  const form = input.tab === "CDS" ? "3c-cds" : "3c-ilw";
  const rows = input.rows.map((row, i) => ({
    taskCode: row.taskCode,
    minPerDay: result.rows[i]!.totalUnits === null ? null : row.minPerDay,
    totalUnits: result.rows[i]!.totalUnits,
    ...(row.description === undefined ? {} : { description: row.description }),
    guidance: guidanceForTask(form, row.taskCode),
  }));
  return stampWorksheetResults([
    ...ruleWSR01OutsideSuggestedRange(rows),
    ...ruleWSR02IlwDescription(rows, input.tab === "ILW"),
    ...ruleWSR03ConsiderIlw(input.tab, result.totalUnits, result.ceiling),
  ], pack);
}
