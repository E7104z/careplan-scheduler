import type { ProgramCode, ServiceCode } from "../types.js";

export interface ServiceDef {
  code: ServiceCode;
  program: ProgramCode;
  name: string;
  unit: "15min" | "visit";
  monthlyCeiling: number | null;
  combinedCeilingGroup?: "RESPITE";
  weeklyHourLimit?: number;
  perDayMax?: number;
  perSixMonthMax?: number;
  requiresApproval?: boolean;
  source: string;
}

export interface TaskDef {
  taskCode: string;
  name: string;
  aliases: string[];
  programs: ProgramCode[];
  isTransport?: boolean;
}

export type OverlapRule = "allowed" | "prohibited" | "unknown";

export interface Worksheet3cTab {
  edition: string;
  ceiling: number;
}

/** What DSDS's HCBS-3c workbook prints and calculates with (ENGINE-SPEC Amendment C). */
export interface Worksheet3cPack {
  tabs: { CDS: Worksheet3cTab; ILW: Worksheet3cTab };
  unitRateCents: number;
  unitRateStatus: "PARTIAL";
  unitRateSource: string;
  ilwExtras: { fmsRateCents: number; caseManagementCents: number; smsCents: number; smeCents: number; eaaCents: number };
  ilwExtrasSource: string;
  ceilingSource: string;
  daysBasis: 31;
}

/** Unit rates on the HCBS-3a's rate sheet (Sheet2), in cents per unit (per visit for the nurse). */
export interface Worksheet3aRates {
  personalCare: number; personalCareRcfAlf: number;
  apc: number; apcRcfAlf: number;
  nurseVisit: number; nurseVisitRcfAlf: number;
  respiteBasic: number; respiteAdvanced: number;
  adultDayCare: number; homemakerChore: number; homeDeliveredMeals: number;
}

/** What DSDS's HCBS-3a workbook and its manual page set (ENGINE-SPEC Amendment C). */
export interface Worksheet3aPack {
  edition: string;
  rates: Worksheet3aRates;
  ratesStatus: "PARTIAL";
  ratesSource: string;
  /** "Max 2/day", printed beside the meals rate on the rate sheet (WS-R09, PARTIAL). */
  hdmMaxUnitsPerDayNote: number;
  hdmSource: string;
  /** Advanced Personal Care with one task: its minutes in steps of this many (WS-R04). */
  apcSingleTaskStep: number;
  adultDayCare: { minuteStep: number; maxMinutesPerDay: number; maxDaysPerWeek: number };
  limitsSource: string;
}

export interface RulePack {
  id: string;
  effectiveDate: string;
  daysPerMonthFactor: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, number>;
  services: ServiceDef[];
  tasks: TaskDef[];
  overlap(a: ProgramCode, b: ProgramCode): OverlapRule;
  sources: string[];
  worksheet3c?: Worksheet3cPack;
  worksheet3a?: Worksheet3aPack;
}
