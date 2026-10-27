import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MO_2026_07, guidanceForTask, ruleWSR01OutsideSuggestedRange, ruleWSR02IlwDescription, ruleWSR03ConsiderIlw,
  validateWorksheet3c, type Worksheet3cInput, type WorksheetRuleRow,
} from "../src/index.js";

function row(taskCode: string, minPerDay: number, extra: Partial<WorksheetRuleRow> = {}): WorksheetRuleRow {
  return { taskCode, minPerDay, totalUnits: 10, guidance: guidanceForTask("3c-cds", taskCode), ...extra };
}

describe("WS-R01 outside DSDS's suggested range", () => {
  it("passes a time inside the range, at either end", () => {
    expect(ruleWSR01OutsideSuggestedRange([row("BATHING", 30), row("BATHING", 45), row("TRASH", 5)])).toEqual([]);
  });

  it("flags a time below the range, or above it for a task with a weekly frequency", () => {
    expect(ruleWSR01OutsideSuggestedRange([row("BATHING", 25), row("BATHING", 60)])).toEqual([
      { ruleId: "WS-R01", severity: "INFO", message: "Outside DSDS's suggested range of 30-45 MIN. Describe the need.", refs: { taskCode: "BATHING" } },
      { ruleId: "WS-R01", severity: "INFO", message: "Outside DSDS's suggested range of 30-45 MIN. Describe the need.", refs: { taskCode: "BATHING" } },
    ]);
    // A single suggested value: only that value passes.
    expect(ruleWSR01OutsideSuggestedRange([row("TRASH", 10)]).map((r) => r.message)).toEqual(["Outside DSDS's suggested range of 5 MIN. Describe the need."]);
  });

  it("does not flag several occurrences a day of a task done as needed or per transfer", () => {
    expect(ruleWSR01OutsideSuggestedRange([row("ASSISTANCE_WITH_TOILETING", 40), row("ASSISTIVE_TRANSFER_DEVICE", 60)])).toEqual([]);
    expect(ruleWSR01OutsideSuggestedRange([row("ASSISTANCE_WITH_TOILETING", 3)])).toHaveLength(1);
  });

  it("skips rows with no minutes range, no units, or not on the form", () => {
    expect(ruleWSR01OutsideSuggestedRange([
      row("CLEAN_MAINTAIN_EQUIPMENT", 120),
      row("BATHING", 90, { totalUnits: null }),
      row("DIETARY", 90),
      { taskCode: "MED_REL", minPerDay: 90, totalUnits: 10, guidance: { ...guidanceForTask("3c-cds", "BATHING")!, minLow: null, minHigh: null } },
    ])).toEqual([]);
  });
});

describe("WS-R02 an ILW request needs a Description of needs", () => {
  it("passes when every task with units is described, and outside an ILW request", () => {
    expect(ruleWSR02IlwDescription([row("BATHING", 30, { description: "Needs help in and out of the tub." })], true)).toEqual([]);
    expect(ruleWSR02IlwDescription([row("BATHING", 30)], false)).toEqual([]);
    expect(ruleWSR02IlwDescription([row("BATHING", 30, { totalUnits: 0 }), row("TRASH", 5, { totalUnits: null })], true)).toEqual([]);
  });

  it("asks for a description on each task with units and none (blank counts as none)", () => {
    expect(ruleWSR02IlwDescription([row("BATHING", 30), row("TRASH", 5, { description: "   " })], true)).toEqual([
      { ruleId: "WS-R02", severity: "REVIEW", message: "Describe why this task is needed and why this time is right.", refs: { taskCode: "BATHING" } },
      { ruleId: "WS-R02", severity: "REVIEW", message: "Describe why this task is needed and why this time is right.", refs: { taskCode: "TRASH" } },
    ]);
  });
});

describe("WS-R03 consider the Independent Living Waiver", () => {
  it("passes at the CDS maximum and on the ILW tab", () => {
    expect(ruleWSR03ConsiderIlw("CDS", 641, 641)).toEqual([]);
    expect(ruleWSR03ConsiderIlw("ILW", 900, 868)).toEqual([]);
  });

  it("points to the ILW above the CDS maximum", () => {
    expect(ruleWSR03ConsiderIlw("CDS", 642, 641)).toEqual([{
      ruleId: "WS-R03", severity: "INFO",
      message: "Needs more than the State Plan maximum. The manual says to consider the Independent Living Waiver.", refs: {},
    }]);
  });
});

describe("validateWorksheet3c", () => {
  const plan = (tab: "CDS" | "ILW", minPerDay: number, description?: string): Worksheet3cInput => ({
    tab, transportMinutesPerMonth: null,
    rows: [{ taskCode: "BATHING", minPerDay, daysPerWeek: 7, ...(description === undefined ? {} : { description }) }],
  });

  it("WS-C18 shows a task's units with its suggested range check", () => {
    expect(validateWorksheet3c(plan("CDS", 60), MO_2026_07).map((r) => [r.ruleId, r.severity, r.rulePackVersion])).toEqual([["WS-R01", "INFO", "mo-2026-07"]]);
    expect(validateWorksheet3c(plan("CDS", 45), MO_2026_07)).toEqual([]);
  });

  it("WS-I06 asks for a Description of needs on the ILW tab only", () => {
    expect(validateWorksheet3c(plan("ILW", 45), MO_2026_07).map((r) => r.ruleId)).toEqual(["WS-R02"]);
    expect(validateWorksheet3c(plan("ILW", 45, "Bathes daily after therapy."), MO_2026_07)).toEqual([]);
  });

  it("WS-I08 suggests the ILW when the CDS total is above the maximum, ordered after REVIEW", () => {
    const results = validateWorksheet3c(plan("CDS", 320), MO_2026_07);
    expect(results.map((r) => [r.ruleId, r.severity])).toEqual([["WS-R01", "INFO"], ["WS-R03", "INFO"]]);
    const ilw = validateWorksheet3c(plan("ILW", 320), MO_2026_07);
    expect(ilw.map((r) => r.ruleId)).toEqual(["WS-R02", "WS-R01"]);
    // Above the ILW tab's own maximum (450 min daily = 930 units > 868): already the ILW, so no WS-R03.
    expect(validateWorksheet3c(plan("ILW", 450, "Needs two people for transfers."), MO_2026_07).map((r) => r.ruleId)).toEqual(["WS-R01"]);
  });

  it("is never run by validatePlan or validateSchedule (W-7)", () => {
    const source = readFileSync(fileURLToPath(new URL("../src/validate.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/worksheet\//);
  });
});
