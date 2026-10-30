import { ruleAUTH09Ceiling } from "../rules/auth.js";
import type { RulePack } from "../rulepacks/types.js";
import type { MonthlyAuthorization, ServiceAuthorization, ServiceCode, Severity, ValidationResult } from "../types.js";
import type { ScheduleValidationResult } from "../validate.js";
import { calculate3a, stateParity3aPack, type StateParity3aInput, type StateParity3aSection } from "./calc3a.js";
import { calculate3c, type StateParity3cInput } from "./calc3c.js";
import { GUIDANCE, guidanceForTask } from "./guidance.js";
import {
  ruleWSR01OutsideSuggestedRange, ruleWSR02IlwDescription, ruleWSR03ConsiderIlw, ruleWSR04ApcSingleTask,
  ruleWSR05ApcFirstMonthNurse, ruleWSR06GeneralHealthEvaluation, ruleWSR07NurseOther, ruleWSR08AdultDayCare,
  ruleWSR09HdmUnits, type AdultDayCareRow, type StateParityRuleRow,
} from "./rules.js";

const SEVERITY_ORDER: Record<Severity, number> = { BLOCK: 0, REVIEW: 1, WARN: 2, INFO: 3 };

/** Stamp each result with the rule-pack version and order them BLOCK, REVIEW, WARN, INFO, as `validatePlan` does. */
export function stampStateParityResults(results: ValidationResult[], pack: RulePack): ScheduleValidationResult[] {
  return results
    .map((result) => ({ ...result, rulePackVersion: pack.id }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/**
 * The state parity rules for an HCBS-3c (Amendment C): WS-R01 to WS-R03, stamped with the
 * rule-pack version. Never called by `validatePlan` or `validateSchedule`.
 */
export function validateStateParity3c(input: StateParity3cInput, pack: RulePack): ScheduleValidationResult[] {
  const result = calculate3c(input, pack);
  const form = input.tab === "CDS" ? "3c-cds" : "3c-ilw";
  const rows = input.rows.map((row, i) => ({
    taskCode: row.taskCode,
    minPerDay: result.rows[i]!.totalUnits === null ? null : row.minPerDay,
    totalUnits: result.rows[i]!.totalUnits,
    ...(row.description === undefined ? {} : { description: row.description }),
    guidance: guidanceForTask(form, row.taskCode),
  }));
  return stampStateParityResults([
    ...ruleWSR01OutsideSuggestedRange(rows),
    ...ruleWSR02IlwDescription(rows, input.tab === "ILW"),
    ...ruleWSR03ConsiderIlw(input.tab, result.totalUnits, result.ceiling),
  ], pack);
}

const SECTION_HEADINGS: Partial<Record<StateParity3aSection, string>> = {
  personalCare: "PERSONAL CARE", homemaker: "HOMEMAKER", apc: "ADVANCED PERSONAL CARE",
};

/** The state parity month for AUTH-09: every 3a figure is for a 31-day month. */
export const STATE_PARITY_MONTH = "a 31-day month";

/** AUTH-09's combined respite limit, run on the 3a's two respite lines (not copied: called). */
function respiteCeiling(basic: number | null, advanced: number | null): ValidationResult[] {
  const lines: [ServiceCode, number | null][] = [["S5150", basic], ["S5150TF", advanced]];
  const authorizations: ServiceAuthorization[] = lines.map(([serviceCode]) => ({
    id: `stateparity-${serviceCode}`, participantId: "stateparity", program: "RESPITE", serviceCode, start: "", end: "",
    state: "active", suspensions: [], revision: 0, tasks: [],
  }));
  const monthly: MonthlyAuthorization[] = lines.flatMap(([serviceCode, units]) =>
    units === null ? [] : [{ serviceAuthId: `stateparity-${serviceCode}`, month: STATE_PARITY_MONTH, units, source: "derived", revision: 0 }]);
  return ruleAUTH09Ceiling(authorizations, monthly);
}

/**
 * The state parity rules for an HCBS-3a (Amendment C): WS-R01, WS-R02 (when the 3a is part of an ILW
 * request), WS-R04 to WS-R09, and AUTH-09's combined respite limit, stamped with the rule-pack
 * version. Never called by `validatePlan` or `validateSchedule`.
 */
export function validateStateParity3a(input: StateParity3aInput, pack: RulePack): ScheduleValidationResult[] {
  const sheet = stateParity3aPack(pack);
  const result = calculate3a(input, pack);
  const rows: (StateParityRuleRow & { section: StateParity3aSection })[] = input.rows.map((row, i) => {
    const heading = SECTION_HEADINGS[row.section];
    return {
      section: row.section,
      taskCode: row.taskCode ?? "",
      ...(row.taskCode === undefined ? { line: row.section } : {}),
      minPerDay: result.rows[i]!.totalUnits === null ? null : row.minPerDay,
      totalUnits: result.rows[i]!.totalUnits,
      ...(row.description === undefined ? {} : { description: row.description }),
      guidance: heading ? GUIDANCE["3a"].find((g) => g.section === heading && g.taskCode === row.taskCode) : undefined,
    };
  });
  const hdm: StateParityRuleRow[] = input.hdm && result.hdm?.totalUnits
    ? [{ taskCode: "", line: "hdm", minPerDay: null, totalUnits: result.hdm.totalUnits, ...(input.hdm.description === undefined ? {} : { description: input.hdm.description }), guidance: undefined }]
    : [];
  const adultDayCare: AdultDayCareRow[] = input.rows.flatMap((row) =>
    row.section === "adultDayCare" || row.section === "adultDayCareWaiver" ? [{ line: row.section, minPerDay: row.minPerDay, daysPerWeek: row.daysPerWeek }] : []);
  return stampStateParityResults([
    ...ruleWSR01OutsideSuggestedRange(rows),
    ...ruleWSR02IlwDescription([...rows, ...hdm], input.ilwRequest === true),
    ...ruleWSR04ApcSingleTask(rows.filter((row) => row.section === "apc"), sheet.apcSingleTaskStep),
    ...ruleWSR05ApcFirstMonthNurse(result.subtotals.apcUnits, input.nurse?.visitsPerMonth ?? null, input.nurse?.firstMonthVisits ?? null),
    ...ruleWSR06GeneralHealthEvaluation(input.nurse?.tasks ?? [], input.nurse?.comments ?? ""),
    ...ruleWSR07NurseOther(input.nurse?.tasks ?? []),
    ...ruleWSR08AdultDayCare(adultDayCare, sheet.adultDayCare),
    ...ruleWSR09HdmUnits(input.hdm?.unitsPerDay ?? null, sheet.hdmMaxUnitsPerDayNote),
    ...respiteCeiling(result.lineUnits.respiteBasic, result.lineUnits.respiteAdvanced),
  ], pack);
}
