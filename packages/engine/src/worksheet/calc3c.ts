import type { RulePack, Worksheet3cPack } from "../rulepacks/types.js";
import {
  DAYS_ISSUE, MINUTES_ISSUE, dollars, isDaysPerWeek, isWholeMinutes, rowMath, wholeNumber, type WorksheetRowMath,
} from "./rowMath.js";

export type Worksheet3cTabName = "CDS" | "ILW";

export interface Worksheet3cRowInput {
  taskCode: string;
  minPerDay: number | null;
  daysPerWeek: number | null;
  /** "Description of needs" for the row (WS-C16). Memory-only in the app (W-4). */
  description?: string;
}

/** Units typed into the ILW tab's service lines (cells O96–O100); null = left blank. */
export interface Worksheet3cIlwExtrasInput {
  fmsUnits: number | null;
  caseManagementUnits: number | null;
  smsUnits: number | null;
  smeUnits: number | null;
  eaaUnits: number | null;
}

export interface Worksheet3cInput {
  tab: Worksheet3cTabName;
  rows: Worksheet3cRowInput[];
  transportMinutesPerMonth: number | null;
  ilwExtras?: Worksheet3cIlwExtrasInput;
}

export interface Worksheet3cRowResult extends WorksheetRowMath {
  taskCode: string;
  minPerDay: number | null;
  daysPerWeek: number | null;
}

export interface Worksheet3cTransport {
  minutesPerMonth: number;
  units: number;
  /** Minutes the sheet drops when it rounds down (it doesn't show them; we do). */
  unallocatedMinutes: number;
  formulaText: string;
}

/** Amounts of the ILW tab's service lines (cells Q96–Q100), in cents; null where the sheet shows nothing. */
export interface Worksheet3cIlwExtrasResult {
  fmsCents: number;
  caseManagementCents: number | null;
  smsCents: number;
  smeCents: number;
  eaaCents: number;
}

export interface Worksheet3cIssue {
  field: "minPerDay" | "daysPerWeek" | "transportMinutesPerMonth" | "ilwExtras";
  /** Index into `input.rows` for a row's field. */
  rowIndex?: number;
  taskCode?: string;
  message: string;
}

export interface Worksheet3cResult {
  tab: Worksheet3cTabName;
  edition: string;
  rows: Worksheet3cRowResult[];
  transport: Worksheet3cTransport;
  totalUnits: number;
  costCents: number;
  /** The cost in words: "72 units × $5.23 = $376.56". */
  costText: string;
  ceiling: number;
  overCeiling: boolean;
  ilwExtras: Worksheet3cIlwExtrasResult | null;
  issues: Worksheet3cIssue[];
}

export const NO_ILW_EXTRAS: Worksheet3cIlwExtrasInput = {
  fmsUnits: null, caseManagementUnits: null, smsUnits: null, smeUnits: null, eaaUnits: null,
};

export const TRANSPORT_ISSUE = "Enter whole minutes, 0 or more.";
export const UNITS_ISSUE = "Enter a whole number of units, 0 or more.";

export function worksheet3cPack(pack: RulePack): Worksheet3cPack {
  if (!pack.worksheet3c) throw new RangeError(`Rule pack ${pack.id} has no HCBS-3c worksheet data`);
  return pack.worksheet3c;
}

function isWholeCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function transportOf(minutes: number): Worksheet3cTransport {
  const units = Math.floor(minutes / 15);
  const unallocatedMinutes = minutes - units * 15;
  const rounded = unallocatedMinutes === 0 ? "" : `, rounded down (${unallocatedMinutes} ${unallocatedMinutes === 1 ? "minute" : "minutes"} left over)`;
  return {
    minutesPerMonth: minutes, units, unallocatedMinutes,
    formulaText: `${wholeNumber(minutes)} min a month ÷ 15 = ${wholeNumber(units)} ${units === 1 ? "unit" : "units"}${rounded}`,
  };
}

function ilwExtrasOf(input: Worksheet3cIlwExtrasInput, sheet: Worksheet3cPack, issues: Worksheet3cIssue[]): Worksheet3cIlwExtrasResult {
  const units = (value: number | null): number | null => {
    if (value === null) return null;
    if (isWholeCount(value)) return value;
    issues.push({ field: "ilwExtras", message: UNITS_ISSUE });
    return null;
  };
  const rates = sheet.ilwExtras;
  const times = (value: number | null, cents: number): number => (units(value) ?? 0) * cents;
  return {
    fmsCents: times(input.fmsUnits, rates.fmsRateCents),
    // Q97 is IF(O97="","",458.09): any entry, 0 included, gives the flat amount.
    caseManagementCents: units(input.caseManagementUnits) === null ? null : rates.caseManagementCents,
    smsCents: times(input.smsUnits, rates.smsCents),
    smeCents: times(input.smeUnits, rates.smeCents),
    eaaCents: times(input.eaaUnits, rates.eaaCents),
  };
}

/**
 * Every number on DSDS's HCBS-3c worksheet (ENGINE-SPEC Amendment C), exactly as the workbook
 * calculates it: per task Units/Day, Max Days/Mo, Units/Wk and Total Units; transportation units;
 * Total Units/Mo; cost; the ceiling flag; and on the ILW tab the service lines Q96–Q100.
 * Separate from `validatePlan`. Invalid entries are listed in `issues` and count nothing.
 */
export function calculate3c(input: Worksheet3cInput, pack: RulePack): Worksheet3cResult {
  const sheet = worksheet3cPack(pack);
  const tab = sheet.tabs[input.tab];
  const issues: Worksheet3cIssue[] = [];
  const rows = input.rows.map((row, rowIndex): Worksheet3cRowResult => {
    let minPerDay = row.minPerDay;
    let days = row.daysPerWeek;
    if (minPerDay !== null && !isWholeMinutes(minPerDay)) {
      issues.push({ field: "minPerDay", rowIndex, taskCode: row.taskCode, message: MINUTES_ISSUE });
      minPerDay = null;
      days = null;
    }
    if (days !== null && !isDaysPerWeek(days)) {
      issues.push({ field: "daysPerWeek", rowIndex, taskCode: row.taskCode, message: DAYS_ISSUE });
      days = null;
    }
    const math = rowMath(minPerDay, days !== null && isDaysPerWeek(days) ? days : null, pack);
    return { taskCode: row.taskCode, minPerDay: row.minPerDay, daysPerWeek: row.daysPerWeek, ...math };
  });

  let transportMinutes = input.transportMinutesPerMonth ?? 0;
  if (!isWholeCount(transportMinutes)) {
    issues.push({ field: "transportMinutesPerMonth", message: TRANSPORT_ISSUE });
    transportMinutes = 0;
  }
  const transport = transportOf(transportMinutes);
  const totalUnits = rows.reduce((sum, row) => sum + (row.totalUnits ?? 0), transport.units);
  const ilwExtras = input.tab === "ILW" ? ilwExtrasOf(input.ilwExtras ?? NO_ILW_EXTRAS, sheet, issues) : null;
  return {
    tab: input.tab,
    edition: tab.edition,
    rows,
    transport,
    totalUnits,
    costCents: totalUnits * sheet.unitRateCents,
    costText: `${wholeNumber(totalUnits)} ${totalUnits === 1 ? "unit" : "units"} × ${dollars(sheet.unitRateCents)} = ${dollars(totalUnits * sheet.unitRateCents)}`,
    ceiling: tab.ceiling,
    overCeiling: totalUnits > tab.ceiling,
    ilwExtras,
    issues,
  };
}
