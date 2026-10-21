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

export interface RulePack {
  id: string;
  effectiveDate: string;
  daysPerMonthFactor: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, number>;
  services: ServiceDef[];
  tasks: TaskDef[];
  overlap(a: ProgramCode, b: ProgramCode): OverlapRule;
  sources: string[];
}
