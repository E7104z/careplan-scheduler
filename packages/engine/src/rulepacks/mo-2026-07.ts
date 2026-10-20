import type { ProgramCode } from "../types.js";
import type { OverlapRule, RulePack, ServiceDef, TaskDef } from "./types.js";

const SRC_APPENDIX = "3.00 Appendix 1 (rev. Jul 2026)";
const SRC_POLICY = "Policy 3.50 (rev. Jul 2026)";
const SRC_HCBS = "HCBS 06-26-01";

const services: ServiceDef[] = [
  {
    code: "T1019U2", program: "CDS", name: "CDS Personal Care Assistance (State Plan)",
    unit: "15min", monthlyCeiling: 641, source: SRC_APPENDIX,
  },
  {
    code: "T1019U6", program: "ILW", name: "ILW Personal Care Assistance",
    unit: "15min", monthlyCeiling: 868, weeklyHourLimit: 49, requiresApproval: true,
    source: SRC_APPENDIX,
  },
  {
    code: "T1019", program: "AGENCY_PC", name: "Basic Personal Care – Agency",
    unit: "15min", monthlyCeiling: 412, source: SRC_APPENDIX,
  },
  {
    code: "T1019TF", program: "APC", name: "Advanced Personal Care",
    unit: "15min", monthlyCeiling: null, source: SRC_APPENDIX,
  },
  {
    code: "T1001", program: "NURSE", name: "Authorized Nurse Visits",
    unit: "visit", monthlyCeiling: null, perDayMax: 1, perSixMonthMax: 26, source: SRC_HCBS,
  },
  {
    code: "S5130", program: "HOMEMAKER", name: "Homemaker (ADW)",
    unit: "15min", monthlyCeiling: null, source: SRC_APPENDIX,
  },
  {
    code: "S5120", program: "CHORE", name: "Chore (ADW)",
    unit: "15min", monthlyCeiling: null, source: SRC_APPENDIX,
  },
  {
    code: "S5150", program: "RESPITE", name: "Respite – Basic (ADW)",
    unit: "15min", monthlyCeiling: 868, combinedCeilingGroup: "RESPITE",
    weeklyHourLimit: 49, source: SRC_POLICY,
  },
  {
    code: "S5150TF", program: "RESPITE", name: "Respite – Advanced (ADW)",
    unit: "15min", monthlyCeiling: 868, combinedCeilingGroup: "RESPITE",
    weeklyHourLimit: 49, source: SRC_POLICY,
  },
];

function t(taskCode: string, name: string, aliases: string[], programs: ProgramCode[], isTransport = false): TaskDef {
  return { taskCode, name, aliases, programs, isTransport };
}

const tasks: TaskDef[] = [
  // CDS / ILW (shared names merged with agency model where identical)
  t("ASSISTIVE_TRANSFER_DEVICE", "Assistive Transfer Device", ["Asst. Transfer Device"], ["CDS", "ILW", "APC"]),
  t("ASSISTANCE_WITH_TOILETING", "Assistance with Toileting", ["Asstance with Toileting", "Asst. with Toileting"], ["CDS", "ILW"]),
  t("BATHING", "Bathing", [], ["CDS", "ILW", "AGENCY_PC"]),
  t("BOWEL_BLADDER_ROUTINE", "Bowel/Bladder Routine", [], ["CDS", "ILW"]),
  t("CATHETER_HYGIENE", "Catheter Hygiene", [], ["CDS", "ILW", "APC"]),
  t("CHANGE_LINENS", "Change Linens", [], ["CDS", "ILW"]),
  t("CLEAN_BATH", "Clean Bath", [], ["CDS", "ILW", "HOMEMAKER"]),
  t("CLEAN_FLOORS", "Clean Floors", [], ["CDS", "ILW"]),
  t("CLEAN_KITCHEN", "Clean Kitchen", [], ["CDS", "ILW", "HOMEMAKER"]),
  t("CLEAN_MAINTAIN_EQUIPMENT", "Clean/Maintain Equipment", [], ["CDS", "ILW"]),
  t("DRESSING_GROOMING", "Dressing/Grooming", [], ["CDS", "ILW", "AGENCY_PC"]),
  t("ESSENTIAL_CORRESPONDENCE", "Essential Correspondence", [], ["CDS", "ILW", "HOMEMAKER"]),
  t("LAUNDRY_HOME", "Laundry (Home)", [], ["CDS", "ILW"]),
  t("LAUNDRY_OFF_SITE", "Laundry (Off Site)", [], ["CDS", "ILW"]),
  t("MAKE_BED", "Make Bed", [], ["CDS", "ILW"]),
  t("MEAL_PREP_EATING", "Meal Prep/Eating", [], ["CDS", "ILW"]),
  t("MEDICATIONS", "Medications", [], ["CDS", "ILW"]),
  t("MOBILITY_TRANSFER", "Mobility/Transfer", [], ["CDS", "ILW"]),
  t("OSTOMY_HYGIENE", "Ostomy Hygiene", [], ["CDS", "ILW", "APC"]),
  t("PASSIVE_ROM", "Passive ROM", [], ["CDS", "ILW", "APC"]),
  t("TIDY_AND_DUST", "Tidy and Dust", [], ["CDS", "ILW"]),
  t("TRASH", "Trash", [], ["CDS", "ILW", "HOMEMAKER"]),
  t("TREATMENTS", "Treatments", [], ["CDS", "ILW"]),
  t("TURNING_POSITIONING", "Turning/Positioning", [], ["CDS", "ILW"]),
  t("WASH_DISHES", "Wash Dishes", [], ["CDS", "ILW"]),
  t("ESSENTIAL_TRANSPORTATION", "Essential Transportation", [], ["CDS", "ILW"], true),

  // Basic PC (agency model)
  t("DIETARY", "Dietary", [], ["AGENCY_PC"]),
  t("MOBILITY_TRANSFER_POSITION", "Mobility/Transfer/Position", [], ["AGENCY_PC"]),
  t("SELF_ADMIN_OF_MEDICATIONS", "Self-Admin of Medications", [], ["AGENCY_PC"]),
  t("TOILETING", "Toileting", [], ["AGENCY_PC"]),

  // Homemaker (agency model)
  t("CLEAN_LIVING_AREA", "Clean Living Area", [], ["HOMEMAKER"]),
  t("IRON_MEND", "Iron/Mend", [], ["HOMEMAKER"]),
  t("LAUNDRY", "Laundry", [], ["HOMEMAKER"]),
  t("MAKE_BED_CHANGE_LINENS", "Make Bed/Change Linens", [], ["HOMEMAKER"]),
  t("MEALS_DISHES", "Meals/Dishes", [], ["HOMEMAKER"]),
  t("SHOPPING_ERRANDS", "Shopping/Errands", [], ["HOMEMAKER"]),
  t("WASH_WINDOWS_BLINDS", "Wash Windows/Blinds", [], ["HOMEMAKER"]),

  // APC (agency model)
  t("ASEPTIC_DRESSINGS", "Aseptic Dressings", [], ["APC"]),
  t("BOWEL_PROGRAM", "Bowel Program", [], ["APC"]),
  t("NON_INJECTABLE_MEDS", "Non-Injectable Meds", [], ["APC"]),

  // Respite
  t("BASIC_RESPITE", "Basic Respite", [], ["RESPITE"]),
  t("ADVANCED_RESPITE", "Advanced Respite", [], ["RESPITE"]),
];

export const MO_2026_07: RulePack = {
  id: "mo-2026-07",
  effectiveDate: "2026-07-01",
  daysPerMonthFactor: { 1: 5, 2: 10, 3: 15, 4: 19, 5: 23, 6: 27, 7: 31 },
  services,
  tasks,
  sources: [SRC_APPENDIX, SRC_POLICY, SRC_HCBS],
  overlap(a: ProgramCode, b: ProgramCode): OverlapRule {
    if (a === b) return "prohibited";
    if ((a === "CDS" && b === "NURSE") || (a === "NURSE" && b === "CDS")) return "allowed";
    if (a === "RESPITE" || b === "RESPITE") return "prohibited";
    return "unknown";
  },
};
