import type { RulePack, StateParity3aPack } from "../rulepacks/types.js";
import {
  DAYS_ISSUE, MINUTES_ISSUE, dollars, isDaysPerWeek, isWholeMinutes, rowMath, wholeNumber, type StateParityRowMath,
} from "./rowMath.js";

/** The 3a's sections with task rows (minutes a day and days a week). */
export type StateParity3aSection =
  | "personalCare" | "homemaker" | "apc"
  | "respiteBasic" | "respiteAdvanced" | "adultDayCare" | "adultDayCareWaiver" | "chore";

/** The 8 nurse task boxes and the 6 chore task boxes: recorded, never calculated with (WS-A25, WS-A26). */
export type NurseTask =
  | "FILL_INSULIN_SYRINGES" | "EVAL_APC_PLAN" | "MONITOR_SKIN_COND" | "TRAIN_APC"
  | "OTHER" | "GENERAL_HEALTH_EVALUATION" | "MED_SETUP" | "NAIL_CARE";
export type ChoreTask =
  | "CLEAN_CLOSETS_BASEMENT_ATTICS" | "AIR_MATTRESSES_BEDDING" | "RODENT_CONTROL"
  | "WASH_WALLS_AND_WOODWORK" | "SPRAY_FOR_INSECTS" | "SHAMPOO_RUGS";

/** The boxes' labels as DSDS's workbook prints them (test/stateparity-3a-sheet.test.ts reads them from it). */
export const NURSE_TASK_LABELS: Record<NurseTask, string> = {
  FILL_INSULIN_SYRINGES: "FILL INSULIN SYRINGES", EVAL_APC_PLAN: "EVAL APC PLAN", MONITOR_SKIN_COND: "MONITOR SKIN COND",
  TRAIN_APC: "TRAIN APC", OTHER: "OTHER (SEE BELOW)", GENERAL_HEALTH_EVALUATION: "GENERAL HEALTH EVALUATION",
  MED_SETUP: "MED SETUP", NAIL_CARE: "NAIL CARE",
};
export const CHORE_TASK_LABELS: Record<ChoreTask, string> = {
  CLEAN_CLOSETS_BASEMENT_ATTICS: "CLEAN CLOSETS/BASEMENT & ATTICS", AIR_MATTRESSES_BEDDING: "AIR MATTRESSES/BEDDING",
  RODENT_CONTROL: "PROVIDE RODENT CONTROL WITHIN HOME USING OTC", WASH_WALLS_AND_WOODWORK: "WASH WALLS AND WOODWORK",
  SPRAY_FOR_INSECTS: "SPRAY FOR INSECTS WITHIN HOME USING OTC", SHAMPOO_RUGS: "SHAMPOO RUGS",
};

export interface StateParity3aFlags {
  personalCareRcfAlf: boolean;
  apcRcfAlf: boolean;
  nurseRcfAlf: boolean;
  /** The "Medically Related Household tasks" box: Homemaker units count as Personal Care (WS-A23). */
  medRelHousehold: boolean;
  /** Recorded only: the manual asks for it, the workbook has no such box and no rate for it. */
  homemakerRcfAlf: boolean;
  /** The CDS box (WS-H11). Recorded only. */
  cdsBox: boolean;
}

export interface StateParity3aRowInput {
  section: StateParity3aSection;
  /** The task, for Personal Care, Homemaker and Advanced Personal Care rows. */
  taskCode?: string;
  minPerDay: number | null;
  daysPerWeek: number | null;
  description?: string;
}

export interface StateParity3aInput {
  flags: StateParity3aFlags;
  rows: StateParity3aRowInput[];
  hdm: { unitsPerDay: number | null; daysPerWeek: number | null; description?: string } | null;
  nurse: { visitsPerMonth: number | null; firstMonthVisits?: number | null; tasks: NurseTask[]; comments: string } | null;
  chore: { tasks: ChoreTask[] };
  /** The 3a is part of an ILW request: Description of needs is then required (WS-R02). */
  ilwRequest?: boolean;
}

export interface StateParity3aRowResult extends StateParityRowMath {
  section: StateParity3aSection;
  taskCode?: string;
  minPerDay: number | null;
  daysPerWeek: number | null;
  /** The 3a's MIN/WK column: Min/Day × Days/Wk. */
  minPerWeek: number;
}

export type StateParity3aCostLine =
  | "personalCare" | "homemaker" | "apc" | "nurseVisits" | "respiteBasic" | "respiteAdvanced"
  | "homeDeliveredMeals" | "adultDayCare" | "adultDayCareWaiver" | "chore";

export interface StateParity3aIssue { field: string; rowIndex?: number; message: string }

export interface StateParity3aResult {
  edition: string;
  rows: StateParity3aRowResult[];
  hdm: (StateParityRowMath & { unitsPerDayEntered: number | null; daysPerWeek: number | null }) | null;
  /** N29 (Homemaker units counted as Personal Care), N30, N66, N90. */
  subtotals: { medRelHouseholdUnits: number; personalCareUnits: number; homemakerUnits: number; apcUnits: number };
  /** Units of the one-row lines; null where the line has no Days/Wk. */
  lineUnits: Record<"respiteBasic" | "respiteAdvanced" | "adultDayCare" | "adultDayCareWaiver" | "chore", number | null>;
  /** Each cost cell in cents; null where the sheet shows nothing. */
  costs: Record<StateParity3aCostLine, number | null>;
  costText: Record<StateParity3aCostLine, string | null>;
  /** O122: the sum of the line costs. */
  totalCostCents: number;
  respiteUnits: number;
  issues: StateParity3aIssue[];
}

export const NURSE_VISITS_ISSUE = "Enter whole visits from 0 to 31.";
export const MEALS_ISSUE = "Enter whole meals a day, 0 or more.";

const LINE_SECTIONS = ["respiteBasic", "respiteAdvanced", "adultDayCare", "adultDayCareWaiver", "chore"] as const;

export function stateParity3aPack(pack: RulePack): StateParity3aPack {
  if (!pack.stateParity3a) throw new RangeError(`Rule pack ${pack.id} has no HCBS-3a worksheet data`);
  return pack.stateParity3a;
}

function costOf(units: number | null, cents: number, what: string): { cents: number | null; text: string | null } {
  if (units === null) return { cents: null, text: null };
  const total = units * cents;
  return { cents: total, text: `${wholeNumber(units)} ${what} × ${dollars(cents)} = ${dollars(total)}` };
}

/**
 * Every number on DSDS's HCBS-3a worksheet (ENGINE-SPEC Amendment C), as its workbook calculates
 * it: task rows with the 3c's arithmetic, Home Delivered Meals from meals a day, nurse visits by the
 * visit, the subtotals N29/N30/N66/N90, each line's cost at the rate sheet's rates, and the total
 * cost O122. The workbook's unused cells and boxes are not modelled (Amendment C, quirks).
 */
export function calculate3a(input: StateParity3aInput, pack: RulePack): StateParity3aResult {
  const sheet = stateParity3aPack(pack);
  const rates = sheet.rates;
  const issues: StateParity3aIssue[] = [];

  const rows = input.rows.map((row, rowIndex): StateParity3aRowResult => {
    let min = row.minPerDay;
    let days = row.daysPerWeek;
    if (min !== null && !isWholeMinutes(min)) {
      issues.push({ field: "minPerDay", rowIndex, message: MINUTES_ISSUE });
      min = null;
      days = null;
    }
    if (days !== null && !isDaysPerWeek(days)) {
      issues.push({ field: "daysPerWeek", rowIndex, message: DAYS_ISSUE });
      days = null;
    }
    const math = rowMath(min, days !== null && isDaysPerWeek(days) ? days : null, pack);
    return {
      section: row.section, ...(row.taskCode === undefined ? {} : { taskCode: row.taskCode }),
      minPerDay: row.minPerDay, daysPerWeek: row.daysPerWeek, minPerWeek: (min ?? 0) * (days ?? 0), ...math,
    };
  });
  const sum = (section: StateParity3aSection): number => rows.filter((r) => r.section === section).reduce((t, r) => t + (r.totalUnits ?? 0), 0);
  const line = (section: StateParity3aSection): number | null =>
    rows.some((r) => r.section === section && r.totalUnits !== null) ? sum(section) : null;

  const homemaker = sum("homemaker");
  const medRelHouseholdUnits = input.flags.medRelHousehold ? homemaker : 0;
  const subtotals = {
    medRelHouseholdUnits,
    personalCareUnits: sum("personalCare") + medRelHouseholdUnits,
    homemakerUnits: input.flags.medRelHousehold ? 0 : homemaker,
    apcUnits: sum("apc"),
  };
  const lineUnits = Object.fromEntries(LINE_SECTIONS.map((s) => [s, line(s)])) as StateParity3aResult["lineUnits"];

  let hdm: StateParity3aResult["hdm"] = null;
  if (input.hdm) {
    let meals = input.hdm.unitsPerDay;
    let days = input.hdm.daysPerWeek;
    if (meals !== null && !(Number.isSafeInteger(meals) && meals >= 0)) {
      issues.push({ field: "hdm.unitsPerDay", message: MEALS_ISSUE });
      meals = null;
    }
    if (days !== null && !isDaysPerWeek(days)) {
      issues.push({ field: "hdm.daysPerWeek", message: DAYS_ISSUE });
      days = null;
    }
    // N106 is blank without meals a day; the sheet errors on days with no meals, so that counts nothing.
    const math = rowMath(meals, meals === null || days === null || !isDaysPerWeek(days) ? null : days, pack, "units");
    hdm = { ...math, unitsPerDayEntered: input.hdm.unitsPerDay, daysPerWeek: input.hdm.daysPerWeek };
  }

  let visits = input.nurse?.visitsPerMonth ?? null;
  // At most one nurse visit a day (CON-10), so at most the longest month's days.
  if (visits !== null && !(Number.isInteger(visits) && visits >= 0 && visits <= pack.daysPerMonthFactor[7])) {
    issues.push({ field: "nurse.visitsPerMonth", message: NURSE_VISITS_ISSUE });
    visits = null;
  }

  const priced = {
    personalCare: costOf(subtotals.personalCareUnits > 0 ? subtotals.personalCareUnits : null, input.flags.personalCareRcfAlf ? rates.personalCareRcfAlf : rates.personalCare, "units"),
    homemaker: costOf(subtotals.homemakerUnits > 0 ? subtotals.homemakerUnits : null, rates.homemakerChore, "units"),
    apc: costOf(subtotals.apcUnits > 0 ? subtotals.apcUnits : null, input.flags.apcRcfAlf ? rates.apcRcfAlf : rates.apc, "units"),
    nurseVisits: costOf(visits !== null && visits >= 1 ? visits : null, input.flags.nurseRcfAlf ? rates.nurseVisitRcfAlf : rates.nurseVisit, "visits"),
    respiteBasic: costOf(lineUnits.respiteBasic, rates.respiteBasic, "units"),
    respiteAdvanced: costOf(lineUnits.respiteAdvanced, rates.respiteAdvanced, "units"),
    homeDeliveredMeals: costOf(hdm?.totalUnits ?? null, rates.homeDeliveredMeals, "meals"),
    adultDayCare: costOf(lineUnits.adultDayCare, rates.adultDayCare, "units"),
    adultDayCareWaiver: costOf(lineUnits.adultDayCareWaiver, rates.adultDayCare, "units"),
    chore: costOf(lineUnits.chore, rates.homemakerChore, "units"),
  } satisfies Record<StateParity3aCostLine, { cents: number | null; text: string | null }>;
  const lines = Object.keys(priced) as StateParity3aCostLine[];
  const costs = Object.fromEntries(lines.map((l) => [l, priced[l].cents])) as StateParity3aResult["costs"];
  const costText = Object.fromEntries(lines.map((l) => [l, priced[l].text])) as StateParity3aResult["costText"];

  return {
    edition: sheet.edition,
    rows,
    hdm,
    subtotals,
    lineUnits,
    costs,
    costText,
    totalCostCents: lines.reduce((total, l) => total + (costs[l] ?? 0), 0),
    respiteUnits: (lineUnits.respiteBasic ?? 0) + (lineUnits.respiteAdvanced ?? 0),
    issues,
  };
}
