/** The three DSDS worksheet forms: the HCBS-3c's two tabs and the HCBS-3a. */
export type StateParityForm = "3c-cds" | "3c-ilw" | "3a";

export interface GuidanceFrequency {
  perWeekLow: number;
  perWeekHigh: number;
}

/** One task row of a DSDS worksheet with the suggested time and frequency it prints. */
export interface GuidanceRow {
  form: StateParityForm;
  /** 3a only: the section the row is printed under. */
  section?: string;
  /** The row on DSDS's sheet. */
  row: number;
  /** DSDS's label with line breaks and repeated spaces collapsed. */
  label: string;
  /** The rule pack's task; null only for the 3a's "MED REL HC TASKS" box, which is not a task. */
  taskCode: string | null;
  time: string;
  freq: string | null;
  /** Read from a suggested time "N MIN" or "N-M MIN"; null for any other wording. */
  minLow: number | null;
  minHigh: number | null;
  /** Read from a suggested frequency "N X WK" or "N-M X WK"; null for any other wording. */
  frequency: GuidanceFrequency | null;
}

export const AVERAGE_PARTICIPANT_NOTE = "DSDS's suggested times and frequencies are for an average or typical participant.";

// Copied from docs/fixtures/state/worksheet-guidance.json (DSDS's two workbooks), row for row;
// test/guidance.test.ts compares them field for field (W-1).
const ROWS_CDS: readonly GuidanceRow[] = [
  { form: "3c-cds", row: 11, label: "Asst. Transfer Device", taskCode: "ASSISTIVE_TRANSFER_DEVICE",
    time: "15 MIN", freq: "PER TRANSFER", minLow: 15, minHigh: 15, frequency: null },
  { form: "3c-cds", row: 14, label: "Asst. with Toileting", taskCode: "ASSISTANCE_WITH_TOILETING",
    time: "5-10 MIN", freq: "AS NEEDED", minLow: 5, minHigh: 10, frequency: null },
  { form: "3c-cds", row: 17, label: "Bathing", taskCode: "BATHING",
    time: "30-45 MIN", freq: "1-7 X WK", minLow: 30, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-cds", row: 20, label: "Bowel/Bladder Routine", taskCode: "BOWEL_BLADDER_ROUTINE",
    time: "15 MIN", freq: "AS ORDERED", minLow: 15, minHigh: 15, frequency: null },
  { form: "3c-cds", row: 23, label: "Catheter Hygiene", taskCode: "CATHETER_HYGIENE",
    time: "15 MIN", freq: "1-7 X WK", minLow: 15, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-cds", row: 26, label: "Change Linens", taskCode: "CHANGE_LINENS",
    time: "10 MIN", freq: "AS NEEDED", minLow: 10, minHigh: 10, frequency: null },
  { form: "3c-cds", row: 29, label: "Clean Bath", taskCode: "CLEAN_BATH",
    time: "30-45 MIN", freq: "1 X WK", minLow: 30, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-cds", row: 32, label: "Clean Floors", taskCode: "CLEAN_FLOORS",
    time: "30-45 MIN", freq: "1 X WK", minLow: 30, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-cds", row: 35, label: "Clean Kitchen", taskCode: "CLEAN_KITCHEN",
    time: "30-45 MIN", freq: "1 X WK", minLow: 30, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-cds", row: 38, label: "Clean/Maintain Equipment", taskCode: "CLEAN_MAINTAIN_EQUIPMENT",
    time: "AS NECESSARY", freq: "AS NECESSARY", minLow: null, minHigh: null, frequency: null },
  { form: "3c-cds", row: 41, label: "Dressing/Grooming", taskCode: "DRESSING_GROOMING",
    time: "15 MIN", freq: "1-7 X WK", minLow: 15, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-cds", row: 44, label: "Essential Correspondence", taskCode: "ESSENTIAL_CORRESPONDENCE",
    time: "30 MIN", freq: "1 X WK", minLow: 30, minHigh: 30, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-cds", row: 47, label: "Laundry (Home)", taskCode: "LAUNDRY_HOME",
    time: "30-60 MIN", freq: "1 X WK", minLow: 30, minHigh: 60, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-cds", row: 50, label: "Laundry (Off Site)", taskCode: "LAUNDRY_OFF_SITE",
    time: "150 MIN", freq: "1 X WK", minLow: 150, minHigh: 150, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-cds", row: 53, label: "Make Bed", taskCode: "MAKE_BED",
    time: "5 MIN", freq: "AS NEEDED", minLow: 5, minHigh: 5, frequency: null },
  { form: "3c-cds", row: 56, label: "Meal Prep/Eating", taskCode: "MEAL_PREP_EATING",
    time: "10-60 MIN", freq: "1-7 X WK", minLow: 10, minHigh: 60, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-cds", row: 59, label: "Medications", taskCode: "MEDICATIONS",
    time: "3-5 MIN", freq: "AS NEEDED", minLow: 3, minHigh: 5, frequency: null },
  { form: "3c-cds", row: 62, label: "Mobility/Transfer", taskCode: "MOBILITY_TRANSFER",
    time: "5-10 MIN", freq: "AS NEEDED", minLow: 5, minHigh: 10, frequency: null },
  { form: "3c-cds", row: 65, label: "Ostomy Hygiene", taskCode: "OSTOMY_HYGIENE",
    time: "15 MIN", freq: "1-7 X WK", minLow: 15, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-cds", row: 68, label: "Passive ROM", taskCode: "PASSIVE_ROM",
    time: "15 MIN", freq: "AS ORDERED", minLow: 15, minHigh: 15, frequency: null },
  { form: "3c-cds", row: 71, label: "Tidy and Dust", taskCode: "TIDY_AND_DUST",
    time: "10-15 MIN", freq: "1 X WK", minLow: 10, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-cds", row: 74, label: "Trash", taskCode: "TRASH",
    time: "5 MIN", freq: "1 X WK", minLow: 5, minHigh: 5, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-cds", row: 77, label: "Treatments", taskCode: "TREATMENTS",
    time: "15 MIN", freq: "AS ORDERED", minLow: 15, minHigh: 15, frequency: null },
  { form: "3c-cds", row: 80, label: "Turning/Positioning", taskCode: "TURNING_POSITIONING",
    time: "5-10 MIN", freq: "AS NEEDED", minLow: 5, minHigh: 10, frequency: null },
  { form: "3c-cds", row: 83, label: "Wash Dishes", taskCode: "WASH_DISHES",
    time: "10-30 MIN", freq: "1-7 X WK", minLow: 10, minHigh: 30, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-cds", row: 86, label: "ESSENTIAL TRANSPORTATION", taskCode: "ESSENTIAL_TRANSPORTATION",
    time: "60-120 MIN", freq: "1 - 2 X WK", minLow: 60, minHigh: 120, frequency: { perWeekLow: 1, perWeekHigh: 2 } },
];

const ROWS_ILW: readonly GuidanceRow[] = [
  { form: "3c-ilw", row: 11, label: "Asst. Transfer Device", taskCode: "ASSISTIVE_TRANSFER_DEVICE",
    time: "15 MIN", freq: "PER TRANSFER", minLow: 15, minHigh: 15, frequency: null },
  { form: "3c-ilw", row: 14, label: "Asst. with Toileting", taskCode: "ASSISTANCE_WITH_TOILETING",
    time: "5-10 MIN", freq: "AS NEEDED", minLow: 5, minHigh: 10, frequency: null },
  { form: "3c-ilw", row: 17, label: "Bathing", taskCode: "BATHING",
    time: "30-45 MIN", freq: "1-7 X WK", minLow: 30, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-ilw", row: 20, label: "Bowel/Bladder Routine", taskCode: "BOWEL_BLADDER_ROUTINE",
    time: "15 MIN", freq: "AS ORDERED", minLow: 15, minHigh: 15, frequency: null },
  { form: "3c-ilw", row: 23, label: "Catheter Hygiene", taskCode: "CATHETER_HYGIENE",
    time: "15 MIN", freq: "1-7 X WK", minLow: 15, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-ilw", row: 26, label: "Change Linens", taskCode: "CHANGE_LINENS",
    time: "10 MIN", freq: "AS NEEDED", minLow: 10, minHigh: 10, frequency: null },
  { form: "3c-ilw", row: 29, label: "Clean Bath", taskCode: "CLEAN_BATH",
    time: "30-45 MIN", freq: "1 X WK", minLow: 30, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-ilw", row: 32, label: "Clean Floors", taskCode: "CLEAN_FLOORS",
    time: "30-45 MIN", freq: "1 X WK", minLow: 30, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-ilw", row: 35, label: "Clean Kitchen", taskCode: "CLEAN_KITCHEN",
    time: "30-45 MIN", freq: "1 X WK", minLow: 30, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-ilw", row: 38, label: "Clean/Maintain Equipment", taskCode: "CLEAN_MAINTAIN_EQUIPMENT",
    time: "AS NECESSARY", freq: "AS NECESSARY", minLow: null, minHigh: null, frequency: null },
  { form: "3c-ilw", row: 41, label: "Dressing/Grooming", taskCode: "DRESSING_GROOMING",
    time: "15 MIN", freq: "1-7 X WK", minLow: 15, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-ilw", row: 44, label: "Essential Correspondence", taskCode: "ESSENTIAL_CORRESPONDENCE",
    time: "30 MIN", freq: "1 X WK", minLow: 30, minHigh: 30, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-ilw", row: 47, label: "Laundry (Home)", taskCode: "LAUNDRY_HOME",
    time: "30-60 MIN", freq: "1 X WK", minLow: 30, minHigh: 60, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-ilw", row: 50, label: "Laundry (Off Site)", taskCode: "LAUNDRY_OFF_SITE",
    time: "150 MIN", freq: "1 X WK", minLow: 150, minHigh: 150, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-ilw", row: 53, label: "Make Bed", taskCode: "MAKE_BED",
    time: "5 MIN", freq: "AS NEEDED", minLow: 5, minHigh: 5, frequency: null },
  { form: "3c-ilw", row: 56, label: "Meal Prep/Eating", taskCode: "MEAL_PREP_EATING",
    time: "10-60 MIN", freq: "1-7 X WK", minLow: 10, minHigh: 60, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-ilw", row: 59, label: "Medications", taskCode: "MEDICATIONS",
    time: "3-5 MIN", freq: "AS NEEDED", minLow: 3, minHigh: 5, frequency: null },
  { form: "3c-ilw", row: 62, label: "Mobility/Transfer", taskCode: "MOBILITY_TRANSFER",
    time: "5-10 MIN", freq: "AS NEEDED", minLow: 5, minHigh: 10, frequency: null },
  { form: "3c-ilw", row: 65, label: "Ostomy Hygiene", taskCode: "OSTOMY_HYGIENE",
    time: "15 MIN", freq: "1-7 X WK", minLow: 15, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-ilw", row: 68, label: "Passive ROM", taskCode: "PASSIVE_ROM",
    time: "15 MIN", freq: "AS ORDERED", minLow: 15, minHigh: 15, frequency: null },
  { form: "3c-ilw", row: 71, label: "Tidy and Dust", taskCode: "TIDY_AND_DUST",
    time: "10-15 MIN", freq: "1 X WK", minLow: 10, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-ilw", row: 74, label: "Trash", taskCode: "TRASH",
    time: "5 MIN", freq: "1 X WK", minLow: 5, minHigh: 5, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3c-ilw", row: 77, label: "Treatments", taskCode: "TREATMENTS",
    time: "15 MIN", freq: "AS ORDERED", minLow: 15, minHigh: 15, frequency: null },
  { form: "3c-ilw", row: 80, label: "Turning/Positioning", taskCode: "TURNING_POSITIONING",
    time: "5-10 MIN", freq: "AS NEEDED", minLow: 5, minHigh: 10, frequency: null },
  { form: "3c-ilw", row: 83, label: "Wash Dishes", taskCode: "WASH_DISHES",
    time: "10-30 MIN", freq: "1-7 X WK", minLow: 10, minHigh: 30, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3c-ilw", row: 86, label: "ESSENTIAL TRANSPORTATION", taskCode: "ESSENTIAL_TRANSPORTATION",
    time: "60-120 MIN", freq: "1 - 2 X WK", minLow: 60, minHigh: 120, frequency: { perWeekLow: 1, perWeekHigh: 2 } },
];

const ROWS_3A: readonly GuidanceRow[] = [
  { form: "3a", section: "PERSONAL CARE", row: 11, label: "BATHING", taskCode: "BATHING",
    time: "30-45 MIN", freq: "1-7 X WK", minLow: 30, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3a", section: "PERSONAL CARE", row: 14, label: "DIETARY", taskCode: "DIETARY",
    time: "10-60 MIN", freq: "1-7 X WK", minLow: 10, minHigh: 60, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3a", section: "PERSONAL CARE", row: 17, label: "DRESSING/ GROOMING", taskCode: "DRESSING_GROOMING",
    time: "15 MIN", freq: "1-7 X WK", minLow: 15, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3a", section: "PERSONAL CARE", row: 20, label: "MOBILITY/ TRANSFER/ POSITION", taskCode: "MOBILITY_TRANSFER_POSITION",
    time: "5-10 MIN", freq: "AS NEEDED", minLow: 5, minHigh: 10, frequency: null },
  { form: "3a", section: "PERSONAL CARE", row: 23, label: "SELF ADMIN OF MEDICATIONS", taskCode: "SELF_ADMIN_OF_MEDICATIONS",
    time: "3-5 MIN", freq: "AS NEEDED", minLow: 3, minHigh: 5, frequency: null },
  { form: "3a", section: "PERSONAL CARE", row: 26, label: "TOILETING", taskCode: "TOILETING",
    time: "5-10 MIN", freq: "AS NEEDED", minLow: 5, minHigh: 10, frequency: null },
  { form: "3a", section: "PERSONAL CARE", row: 29, label: "MED REL HC TASKS", taskCode: null,
    time: "USE HC SECTION FOR TASKS/TIMES", freq: null, minLow: null, minHigh: null, frequency: null },
  { form: "3a", section: "HOMEMAKER", row: 33, label: "CLEAN BATH", taskCode: "CLEAN_BATH",
    time: "30-45 MIN", freq: "1 X WK", minLow: 30, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3a", section: "HOMEMAKER", row: 36, label: "CLEAN KITCHEN", taskCode: "CLEAN_KITCHEN",
    time: "30-45 MIN", freq: "1 X WK", minLow: 30, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3a", section: "HOMEMAKER", row: 39, label: "CLEAN LIVING AREA", taskCode: "CLEAN_LIVING_AREA",
    time: "10-45 MIN", freq: "1 X WK", minLow: 10, minHigh: 45, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3a", section: "HOMEMAKER", row: 42, label: "ESSENTIAL CORRESPOND", taskCode: "ESSENTIAL_CORRESPONDENCE",
    time: "30 MIN", freq: "1 X WK", minLow: 30, minHigh: 30, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3a", section: "HOMEMAKER", row: 45, label: "IRON/MEND", taskCode: "IRON_MEND",
    time: "10-15 MIN", freq: "1 X WK", minLow: 10, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3a", section: "HOMEMAKER", row: 48, label: "LAUNDRY (HOME/OFF SITE)", taskCode: "LAUNDRY",
    time: "30-150 MIN", freq: "1 X WK", minLow: 30, minHigh: 150, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3a", section: "HOMEMAKER", row: 51, label: "MAKE BED/ CHANGE LINENS", taskCode: "MAKE_BED_CHANGE_LINENS",
    time: "10 MIN", freq: "AS NEEDED", minLow: 10, minHigh: 10, frequency: null },
  { form: "3a", section: "HOMEMAKER", row: 54, label: "MEALS/DISHES", taskCode: "MEALS_DISHES",
    time: "10-60 MIN", freq: "1-7 X WK", minLow: 10, minHigh: 60, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3a", section: "HOMEMAKER", row: 57, label: "SHOPPING/ ERRANDS", taskCode: "SHOPPING_ERRANDS",
    time: "60-120 min", freq: "1-2 X WK", minLow: 60, minHigh: 120, frequency: { perWeekLow: 1, perWeekHigh: 2 } },
  { form: "3a", section: "HOMEMAKER", row: 60, label: "TRASH", taskCode: "TRASH",
    time: "5 MIN", freq: "1 X WK", minLow: 5, minHigh: 5, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3a", section: "HOMEMAKER", row: 63, label: "WASH WINDOWS/ BLINDS", taskCode: "WASH_WINDOWS_BLINDS",
    time: "10-15 MIN", freq: "1 X WK", minLow: 10, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 1 } },
  { form: "3a", section: "ADVANCED PERSONAL CARE", row: 69, label: "ASEPTIC DRESSINGS", taskCode: "ASEPTIC_DRESSINGS",
    time: "15 MIN", freq: "AS ORDERED", minLow: 15, minHigh: 15, frequency: null },
  { form: "3a", section: "ADVANCED PERSONAL CARE", row: 72, label: "ASST TRANS DEVICE", taskCode: "ASSISTIVE_TRANSFER_DEVICE",
    time: "15 MIN", freq: "PER TRANSFER", minLow: 15, minHigh: 15, frequency: null },
  { form: "3a", section: "ADVANCED PERSONAL CARE", row: 75, label: "BOWEL PROGRAM", taskCode: "BOWEL_PROGRAM",
    time: "15 MIN", freq: "AS ORDERED", minLow: 15, minHigh: 15, frequency: null },
  { form: "3a", section: "ADVANCED PERSONAL CARE", row: 78, label: "CATHETER HYGIENE", taskCode: "CATHETER_HYGIENE",
    time: "15 MIN", freq: "1-7 X WK", minLow: 15, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3a", section: "ADVANCED PERSONAL CARE", row: 81, label: "NON-INJECTABLE MEDS", taskCode: "NON_INJECTABLE_MEDS",
    time: "15 MIN", freq: "AS ORDERED", minLow: 15, minHigh: 15, frequency: null },
  { form: "3a", section: "ADVANCED PERSONAL CARE", row: 84, label: "OSTOMY HYGIENE", taskCode: "OSTOMY_HYGIENE",
    time: "15 MIN", freq: "1-7 X WK", minLow: 15, minHigh: 15, frequency: { perWeekLow: 1, perWeekHigh: 7 } },
  { form: "3a", section: "ADVANCED PERSONAL CARE", row: 87, label: "PASSIVE ROM", taskCode: "PASSIVE_ROM",
    time: "15 MIN", freq: "AS ORDERED", minLow: 15, minHigh: 15, frequency: null },
];

/** Every task row of each form, in the order DSDS prints them. */
export const GUIDANCE: Record<StateParityForm, readonly GuidanceRow[]> = { "3c-cds": ROWS_CDS, "3c-ilw": ROWS_ILW, "3a": ROWS_3A };

/** The row of a form for a DSDS label (spacing and case ignored). */
export function guidanceByLabel(form: StateParityForm, label: string): GuidanceRow | undefined {
  const wanted = label.replace(/\s+/g, " ").trim().toLowerCase();
  return GUIDANCE[form].find((row) => row.label.toLowerCase() === wanted);
}

/** The first row of a form for a task (the 3a lists some household tasks only under Homemaker). */
export function guidanceForTask(form: StateParityForm, taskCode: string): GuidanceRow | undefined {
  return GUIDANCE[form].find((row) => row.taskCode === taskCode);
}
