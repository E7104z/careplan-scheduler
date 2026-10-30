import { describe, expect, it } from "vitest";
import {
  DAYS_ISSUE, MEALS_ISSUE, MINUTES_ISSUE, MO_2026_07, NURSE_VISITS_ISSUE, calculate3a,
  type StateParity3aFlags, type StateParity3aInput,
} from "../src/index.js";

const OFF: StateParity3aFlags = { personalCareRcfAlf: false, apcRcfAlf: false, nurseRcfAlf: false, medRelHousehold: false, homemakerRcfAlf: false, cdsBox: false };

function plan(extra: Partial<StateParity3aInput> = {}): StateParity3aInput {
  return {
    flags: OFF,
    rows: [
      { section: "personalCare", taskCode: "BATHING", minPerDay: 45, daysPerWeek: 3 },
      { section: "homemaker", taskCode: "CLEAN_KITCHEN", minPerDay: 30, daysPerWeek: 1 },
      { section: "apc", taskCode: "CATHETER_HYGIENE", minPerDay: 15, daysPerWeek: 7 },
    ],
    hdm: null, nurse: null, chore: { tasks: [] },
    ...extra,
  };
}

describe("calculate3a", () => {
  it("prices each section's subtotal at its rate and adds the line costs", () => {
    const result = calculate3a(plan(), MO_2026_07);
    expect(result.subtotals).toEqual({ medRelHouseholdUnits: 0, personalCareUnits: 45, homemakerUnits: 10, apcUnits: 31 });
    expect(result.costs).toMatchObject({ personalCare: 45 * 814, homemaker: 10 * 814, apc: 31 * 817, nurseVisits: null, chore: null });
    expect(result.totalCostCents).toBe(45 * 814 + 10 * 814 + 31 * 817);
    expect(result.costText.personalCare).toBe("45 units × $8.14 = $366.30");
    expect(result.rows[2]?.minPerWeek).toBe(105);
    expect(result.edition).toBe("DSDS-HCBS-3a (07/26)");
  });

  it("lists bad entries as issues and counts them as nothing", () => {
    const result = calculate3a(plan({
      rows: [{ section: "personalCare", taskCode: "BATHING", minPerDay: 2000, daysPerWeek: 3 }, { section: "chore", minPerDay: 30, daysPerWeek: 9 }],
      hdm: { unitsPerDay: 1.5, daysPerWeek: 7 },
      nurse: { visitsPerMonth: 40, tasks: [], comments: "" },
    }), MO_2026_07);
    expect(result.issues.map((issue) => issue.message)).toEqual([MINUTES_ISSUE, DAYS_ISSUE, MEALS_ISSUE, NURSE_VISITS_ISSUE]);
    expect([result.subtotals.personalCareUnits, result.lineUnits.chore, result.hdm?.totalUnits, result.costs.nurseVisits]).toEqual([0, null, null, null]);
    expect(result.totalCostCents).toBe(0);
  });
});

describe("WS-A01 RCF/ALF boxes", () => {
  it("Personal Care, Advanced Personal Care and Nurse Visits switch to the RCF/ALF rate", () => {
    const result = calculate3a(plan({
      flags: { ...OFF, personalCareRcfAlf: true, apcRcfAlf: true, nurseRcfAlf: true },
      nurse: { visitsPerMonth: 2, tasks: [], comments: "" },
    }), MO_2026_07);
    expect(result.costs).toMatchObject({ personalCare: 45 * 766, apc: 31 * 768, nurseVisits: 2 * 5718, homemaker: 10 * 814 });
  });

  it("the Homemaker box is recorded and changes nothing (the workbook has no such box or rate)", () => {
    expect(calculate3a(plan({ flags: { ...OFF, homemakerRcfAlf: true, cdsBox: true } }), MO_2026_07)).toEqual(calculate3a(plan(), MO_2026_07));
  });
});

describe("WS-A03 the Medically Related Household tasks box", () => {
  it("moves Homemaker's units into Personal Care, priced at the Personal Care rate", () => {
    const result = calculate3a(plan({ flags: { ...OFF, medRelHousehold: true } }), MO_2026_07);
    expect(result.subtotals).toEqual({ medRelHouseholdUnits: 10, personalCareUnits: 55, homemakerUnits: 0, apcUnits: 31 });
    expect(result.costs).toMatchObject({ personalCare: 55 * 814, homemaker: null });
  });
});

describe("WS-A08 Authorized Nurse Visits", () => {
  it("takes visits a month (one input, no days a week), priced per visit from 1 visit", () => {
    expect(calculate3a(plan({ nurse: { visitsPerMonth: 2, tasks: ["GENERAL_HEALTH_EVALUATION"], comments: "January and July" } }), MO_2026_07).costs.nurseVisits).toBe(2 * 6099);
    expect(calculate3a(plan({ nurse: { visitsPerMonth: 0, tasks: [], comments: "" } }), MO_2026_07).costs.nurseVisits).toBeNull();
    expect(calculate3a(plan({ nurse: { visitsPerMonth: 31, tasks: [], comments: "" } }), MO_2026_07).issues).toEqual([]);
  });
});

describe("WS-A17 Units/Day is entered only for Home Delivered Meals", () => {
  it("task rows compute it from minutes; meals take it as entered", () => {
    const result = calculate3a(plan({ hdm: { unitsPerDay: 2, daysPerWeek: 5 } }), MO_2026_07);
    expect(result.rows[0]?.unitsPerDayDisplay).toBe("3.0");
    expect(result.hdm).toMatchObject({ unitsPerDayEntered: 2, maxDaysPerMonth: 23, totalUnits: 46 });
    expect(result.costs.homeDeliveredMeals).toBe(46 * 1099);
    expect(result.costText.homeDeliveredMeals).toBe("46 meals × $10.99 = $505.54");
  });

  it("meals with no days, or days with no meals, count nothing", () => {
    expect(calculate3a(plan({ hdm: { unitsPerDay: 2, daysPerWeek: null } }), MO_2026_07).costs.homeDeliveredMeals).toBeNull();
    expect(calculate3a(plan({ hdm: { unitsPerDay: null, daysPerWeek: 5 } }), MO_2026_07).costs.homeDeliveredMeals).toBeNull();
  });
});

describe("WS-A25 chore: its own row, and task boxes recorded with no effect", () => {
  it("prices chore at the Homemaker/Chore rate; the boxes change nothing", () => {
    const withChore = plan({ rows: [{ section: "chore", minPerDay: 60, daysPerWeek: 1 }] });
    const result = calculate3a(withChore, MO_2026_07);
    expect([result.lineUnits.chore, result.costs.chore]).toEqual([20, 20 * 814]);
    expect(calculate3a({ ...withChore, chore: { tasks: ["SHAMPOO_RUGS", "RODENT_CONTROL"] } }, MO_2026_07)).toEqual(result);
  });
});

describe("WS-A26 nurse task boxes are recorded with no effect", () => {
  it("checking every box changes no number", () => {
    const nurse = { visitsPerMonth: 1, tasks: [], comments: "" };
    const all = ["FILL_INSULIN_SYRINGES", "EVAL_APC_PLAN", "MONITOR_SKIN_COND", "TRAIN_APC", "OTHER", "GENERAL_HEALTH_EVALUATION", "MED_SETUP", "NAIL_CARE"] as const;
    expect(calculate3a(plan({ nurse: { ...nurse, tasks: [...all] } }), MO_2026_07)).toEqual(calculate3a(plan({ nurse }), MO_2026_07));
  });
});

describe("one-row lines", () => {
  it("cost 0, not blank, with days and no minutes, as the sheet's IF(J>0, …) does", () => {
    const result = calculate3a(plan({ rows: [{ section: "adultDayCare", minPerDay: null, daysPerWeek: 2 }] }), MO_2026_07);
    expect([result.lineUnits.adultDayCare, result.costs.adultDayCare]).toEqual([0, 0]);
  });
});
