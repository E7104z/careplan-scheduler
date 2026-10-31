import type { ServiceCode } from "../types.js";

export type Appendix1Program = "STATE_PLAN" | "ADW" | "ILW" | "ADCW" | "SFCW";
export type Appendix1Unit = "15min" | "visit" | "meal" | "month" | "actual_cost" | "day";

/**
 * How the app treats a service (blueprint section 0). Software designations, not DHSS terms:
 * AUTO is scheduled from its tasks, APPOINTMENT needs dates someone chooses, CONTEXT is an
 * authorization with no caregiver time.
 */
export type ScheduleClass = "AUTO" | "APPOINTMENT" | "CONTEXT";
export type ScheduleMode =
  | "TASK_VISIT" | "FACILITY_TASK" | "ONE_TIME_INTERMITTENT" | "COVERAGE_SHIFT"
  | "VISIT_COUNT" | "ATTENDANCE" | "DELIVERY_COUNT" | "DAY_COVERAGE"
  | "ADMIN_MONTH" | "COST_CONTEXT";

export interface Appendix1Service {
  id: string;
  program: Appendix1Program;
  /** As DHSS's table names it. */
  name: string;
  /** As DHSS's table prints it, space included ("T1019U3 TF"). */
  code: string;
  unit: Appendix1Unit;
  /** The table's limit, as printed; null when it states none. */
  limit: string | null;
  scheduleClass: ScheduleClass;
  mode: ScheduleMode;
  /** The engine service Quick Schedule schedules it as; null when the schedule doesn't place it yet. */
  engineCode: ServiceCode | null;
  /** The policy page for the service. */
  source: string;
}

export const APPENDIX_1_SOURCE = "3.00 Appendix 1 (rev. Jul 2026), https://health.mo.gov/book/export/html/3116";

const MANUAL = "https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/";

function s(
  id: string, program: Appendix1Program, name: string, code: string, unit: Appendix1Unit, limit: string | null,
  scheduleClass: ScheduleClass, mode: ScheduleMode, engineCode: ServiceCode | null, page: string,
): Appendix1Service {
  return { id, program, name, code, unit, limit, scheduleClass, mode, engineCode, source: `${MANUAL}${page}` };
}

/**
 * Every row of 3.00 Appendix 1 (rev. Jul 2026), in the table's order: 21 services. Codes, units
 * and limits are copied from the table, checked Oct 31, 2026; test/appendix1.test.ts compares
 * them with the owner's registry (docs/All Schedules/CarePlan_Service_Registry_2026-10-31.json).
 */
export const APPENDIX_1: readonly Appendix1Service[] = [
  // State Plan
  s("MO_APC_AGENCY", "STATE_PLAN", "Advanced Personal Care", "T1019TF", "15min", null,
    "AUTO", "TASK_VISIT", "T1019TF", "300-available-home-and-community-based-1"),
  s("MO_APC_RCF", "STATE_PLAN", "Advanced Personal Care – RCF/ALF", "T1019U3 TF", "15min", null,
    "AUTO", "FACILITY_TASK", null, "300-available-home-and-community-based-3"),
  s("MO_RN_AGENCY", "STATE_PLAN", "Authorized Nurse Visits", "T1001", "visit", "1 visit/day",
    "APPOINTMENT", "VISIT_COUNT", "T1001", "300-available-home-and-community-based-2"),
  s("MO_RN_RCF", "STATE_PLAN", "Authorized Nurse Visits – RCF/ALF", "T1001U3", "visit", "1 visit/day",
    "APPOINTMENT", "VISIT_COUNT", null, "300-available-home-and-community-based-2"),
  s("MO_PC_AGENCY", "STATE_PLAN", "Basic Personal Care – Agency Model", "T1019", "15min", "412 units/mo",
    "AUTO", "TASK_VISIT", "T1019", "300-available-home-and-community-based-0"),
  s("MO_PC_RCF", "STATE_PLAN", "Basic Personal Care – RCF/ALF", "T1019U3", "15min", "438 units/mo",
    "AUTO", "FACILITY_TASK", null, "300-available-home-and-community-based-3"),
  s("MO_CDS", "STATE_PLAN", "Personal Care Assistance – Consumer Directed Model", "T1019U2", "15min", "641 units/mo",
    "AUTO", "TASK_VISIT", "T1019U2", "300-available-home-and-community-based-4"),
  // Aged and Disabled Waiver
  s("MO_ADW_ADC", "ADW", "Adult Day Care", "S5100HC", "15min", "1-40 units (10 hrs/day), 5 days per week",
    "APPOINTMENT", "ATTENDANCE", null, "300-available-home-and-community-based-6"),
  s("MO_ADW_HC", "ADW", "Homemaker", "S5130", "15min", null,
    "AUTO", "TASK_VISIT", "S5130", "300-available-home-and-community-20"),
  s("MO_ADW_CHORE", "ADW", "Chore", "S5120", "15min", null,
    "AUTO", "ONE_TIME_INTERMITTENT", "S5120", "300-available-home-and-community-12"),
  s("MO_ADW_HDM", "ADW", "Home Delivered Meals", "S5170", "meal", "2/day",
    "APPOINTMENT", "DELIVERY_COUNT", null, "300-available-home-and-community-19"),
  s("MO_ADW_RESP_BASIC", "ADW", "Respite - Basic", "S5150", "15min", "868 units/mo",
    "AUTO", "COVERAGE_SHIFT", "S5150", "300-available-home-and-community-based-5"),
  s("MO_ADW_RESP_ADV", "ADW", "Respite - Advanced", "S5150TF", "15min", "868 units/mo",
    "AUTO", "COVERAGE_SHIFT", "S5150TF", "300-available-home-and-community-based-5"),
  // Independent Living Waiver
  s("MO_ILW_PCA", "ILW", "Personal Care Assistance", "T1019U6", "15min", "868 units/mo",
    "AUTO", "TASK_VISIT", "T1019U6", "300-available-home-and-community-based-7"),
  s("MO_ILW_CM", "ILW", "Case Management", "T2024U6", "month", null,
    "CONTEXT", "ADMIN_MONTH", null, "300-available-home-and-community-based-7"),
  s("MO_ILW_FMS", "ILW", "Financial Management Service", "T2040U6", "month", null,
    "CONTEXT", "ADMIN_MONTH", null, "300-available-home-and-community-based-7"),
  s("MO_ILW_SME", "ILW", "Specialized Medical Equipment", "T2029U6", "actual_cost", null,
    "CONTEXT", "COST_CONTEXT", null, "300-available-home-and-community-based-7"),
  s("MO_ILW_SMS", "ILW", "Specialized Medical Supplies", "T2028U6", "actual_cost", null,
    "CONTEXT", "COST_CONTEXT", null, "300-available-home-and-community-based-7"),
  s("MO_ILW_EAA", "ILW", "Env. Accessibility Adaptations", "S5165U6", "actual_cost", null,
    "CONTEXT", "COST_CONTEXT", null, "300-available-home-and-community-based-7"),
  // Adult Day Care Waiver
  s("MO_ADCW_ADC", "ADCW", "Adult Day Care", "S5100HB", "15min", "1-40 units (10 hrs/day), 5 days per week",
    "APPOINTMENT", "ATTENDANCE", null, "300-available-home-and-community-11"),
  // Structured Family Caregiver Waiver
  s("MO_SFC", "SFCW", "Structured Family Caregiver", "S5126HB", "day", "1 unit/day",
    "APPOINTMENT", "DAY_COVERAGE", null, "300-available-home-and-community-based-8"),
];

/** A procedure code compared without case or spaces: "t1019u3 tf" and "T1019U3TF" are the same. */
export function normalizeProcedureCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * The Appendix 1 service a procedure code names, or undefined for a code outside its 21 services.
 * A code says which service only when its label agrees: Fusion prints T1019 for CDS too, so
 * callers never identify a service by code alone.
 */
export function findAppendix1(rawCode: string): Appendix1Service | undefined {
  const code = normalizeProcedureCode(rawCode);
  return APPENDIX_1.find((service) => normalizeProcedureCode(service.code) === code);
}
