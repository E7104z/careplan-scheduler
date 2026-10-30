import { describe, expect, it } from "vitest";
import {
  MO_2026_07, STATE_PARITY_MONTH, ruleWSR04ApcSingleTask, ruleWSR05ApcFirstMonthNurse, ruleWSR06GeneralHealthEvaluation,
  ruleWSR07NurseOther, ruleWSR08AdultDayCare, ruleWSR09HdmUnits, validateStateParity3a,
  type StateParity3aFlags, type StateParity3aInput, type StateParityRuleRow,
} from "../src/index.js";

const OFF: StateParity3aFlags = { personalCareRcfAlf: false, apcRcfAlf: false, nurseRcfAlf: false, medRelHousehold: false, homemakerRcfAlf: false, cdsBox: false };
const LIMITS = MO_2026_07.stateParity3a!.adultDayCare;
const apc = (taskCode: string, minPerDay: number, totalUnits = 10): StateParityRuleRow => ({ taskCode, minPerDay, totalUnits, guidance: undefined });

function plan(extra: Partial<StateParity3aInput> = {}): StateParity3aInput {
  return { flags: OFF, rows: [], hdm: null, nurse: null, chore: { tasks: [] }, ...extra };
}

describe("WS-A06 APC with a single task: 15-minute increments (WS-R04)", () => {
  it("passes one task in 15-minute steps, and two tasks in any minutes", () => {
    expect(ruleWSR04ApcSingleTask([apc("BOWEL_PROGRAM", 30)], 15)).toEqual([]);
    expect(ruleWSR04ApcSingleTask([apc("BOWEL_PROGRAM", 20), apc("PASSIVE_ROM", 10)], 15)).toEqual([]);
    expect(ruleWSR04ApcSingleTask([apc("BOWEL_PROGRAM", 20), apc("PASSIVE_ROM", 10, 0)], 15)).toHaveLength(1);
  });

  it("blocks one task whose minutes aren't a multiple of 15", () => {
    expect(ruleWSR04ApcSingleTask([apc("BOWEL_PROGRAM", 20)], 15)).toEqual([{
      ruleId: "WS-R04", severity: "BLOCK", message: "With one Advanced Personal Care task, enter its minutes in 15-minute steps.", refs: { taskCode: "BOWEL_PROGRAM" },
    }]);
  });
});

describe("WS-A07 two nurse visits in APC's first month (WS-R05)", () => {
  it("passes with ongoing nurse visits, two first-month visits, or no APC", () => {
    expect(ruleWSR05ApcFirstMonthNurse(31, 1, null)).toEqual([]);
    expect(ruleWSR05ApcFirstMonthNurse(31, null, 2)).toEqual([]);
    expect(ruleWSR05ApcFirstMonthNurse(0, null, null)).toEqual([]);
  });

  it("asks for review with APC, no ongoing visits and fewer than two in the first month", () => {
    expect(ruleWSR05ApcFirstMonthNurse(31, 0, 1)).toEqual([{
      ruleId: "WS-R05", severity: "REVIEW",
      message: "Advanced Personal Care needs two nurse visits in its first month, unless the plan has ongoing nurse visits.", refs: { line: "nurse" },
    }]);
  });
});

describe("WS-A09 General Health Evaluation only for semi-annual visits (WS-R06)", () => {
  it("passes when the Comments name the months, or the box is clear", () => {
    expect(ruleWSR06GeneralHealthEvaluation(["GENERAL_HEALTH_EVALUATION"], "GHE in March and Sept.")).toEqual([]);
    expect(ruleWSR06GeneralHealthEvaluation(["MED_SETUP"], "")).toEqual([]);
  });

  it("warns when the box is checked and no month is named", () => {
    expect(ruleWSR06GeneralHealthEvaluation(["GENERAL_HEALTH_EVALUATION"], "Twice a year")).toEqual([{
      ruleId: "WS-R06", severity: "WARN", message: "Check this only for semi-annual visits and name the months in Comments.", refs: { line: "nurse" },
    }]);
  });
});

describe("WS-A10 nurse \"Other\" needs prior approval (WS-R07)", () => {
  it("is quiet without Other and says so with it", () => {
    expect(ruleWSR07NurseOther(["NAIL_CARE"])).toEqual([]);
    expect(ruleWSR07NurseOther(["OTHER"])).toEqual([{
      ruleId: "WS-R07", severity: "INFO", message: "Needs prior approval and authorization from DSDS or its designee.", refs: { line: "nurse" },
    }]);
  });
});

describe("WS-A14 and WS-A15 Adult Day Care and Adult Day Care Waiver limits (WS-R08)", () => {
  it("passes multiples of 15 up to 10 hours a day, 5 days a week", () => {
    expect(ruleWSR08AdultDayCare([{ line: "adultDayCare", minPerDay: 600, daysPerWeek: 5 }, { line: "adultDayCareWaiver", minPerDay: 15, daysPerWeek: 1 }], LIMITS)).toEqual([]);
  });

  it.each([
    ["minutes not a multiple of 15", 70, 3],
    ["more than 10 hours a day", 615, 3],
    ["more than 5 days a week", 60, 6],
  ])("blocks %s", (_what, minPerDay, daysPerWeek) => {
    expect(ruleWSR08AdultDayCare([{ line: "adultDayCareWaiver", minPerDay, daysPerWeek }], LIMITS)).toEqual([{
      ruleId: "WS-R08", severity: "BLOCK", message: "Enter adult day care in 15-minute steps, at most 10 hours a day and 5 days a week.", refs: { line: "adultDayCareWaiver" },
    }]);
  });
});

describe("Home Delivered Meals above 2 a day (WS-R09)", () => {
  it("passes 2 a day and asks for review above it", () => {
    expect(ruleWSR09HdmUnits(2, 2)).toEqual([]);
    expect(ruleWSR09HdmUnits(3, 2)).toEqual([{
      ruleId: "WS-R09", severity: "REVIEW", message: "More than 2 meals a day. DSDS's rate sheet notes a maximum of 2 a day.", refs: { line: "hdm" },
    }]);
  });
});

describe("validateStateParity3a", () => {
  it("WS-A12 runs AUTH-09's combined respite limit on the two respite lines (called, not copied)", () => {
    const over = validateStateParity3a(plan({ rows: [
      { section: "respiteBasic", minPerDay: 300, daysPerWeek: 7 },
      { section: "respiteAdvanced", minPerDay: 150, daysPerWeek: 7 },
    ] }), MO_2026_07);
    expect(over.map((r) => [r.ruleId, r.severity, r.refs.month])).toEqual([["AUTH-09", "BLOCK", STATE_PARITY_MONTH]]);
    expect(validateStateParity3a(plan({ rows: [{ section: "respiteBasic", minPerDay: 240, daysPerWeek: 7 }] }), MO_2026_07)).toEqual([]);
  });

  it("WS-A19 asks for Description of needs only when the 3a is part of an ILW request", () => {
    const rows: StateParity3aInput["rows"] = [{ section: "personalCare", taskCode: "BATHING", minPerDay: 45, daysPerWeek: 3 }, { section: "adultDayCare", minPerDay: 360, daysPerWeek: 2 }];
    expect(validateStateParity3a(plan({ rows }), MO_2026_07)).toEqual([]);
    expect(validateStateParity3a(plan({ rows, ilwRequest: true }), MO_2026_07).map((r) => [r.ruleId, r.refs])).toEqual([
      ["WS-R02", { taskCode: "BATHING" }], ["WS-R02", { line: "adultDayCare" }],
    ]);
  });

  it("WS-A20 reads the General Health Evaluation months from the Comments", () => {
    const nurse = { visitsPerMonth: 1, tasks: ["GENERAL_HEALTH_EVALUATION" as const], comments: "" };
    expect(validateStateParity3a(plan({ nurse }), MO_2026_07).map((r) => r.ruleId)).toEqual(["WS-R06"]);
    expect(validateStateParity3a(plan({ nurse: { ...nurse, comments: "January and July" } }), MO_2026_07)).toEqual([]);
  });

  it("checks suggested ranges on the 3a's own rows, and orders BLOCK first", () => {
    const results = validateStateParity3a(plan({
      rows: [{ section: "apc", taskCode: "BOWEL_PROGRAM", minPerDay: 20, daysPerWeek: 3 }, { section: "personalCare", taskCode: "BATHING", minPerDay: 90, daysPerWeek: 3 }],
      hdm: { unitsPerDay: 3, daysPerWeek: 7 },
    }), MO_2026_07);
    expect(results.map((r) => [r.ruleId, r.severity, r.rulePackVersion])).toEqual([
      ["WS-R04", "BLOCK", "mo-2026-07"], ["WS-R05", "REVIEW", "mo-2026-07"], ["WS-R09", "REVIEW", "mo-2026-07"],
      ["WS-R01", "INFO", "mo-2026-07"],
    ]);
  });
});
