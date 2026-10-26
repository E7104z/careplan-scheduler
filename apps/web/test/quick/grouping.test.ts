import { describe, expect, it } from "vitest";
import { MO_2026_07, type ScheduleValidationResult, type Severity } from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { fromFusion } from "../../src/features/import/fromFusion";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { contextFor, groupResults, monthsContext } from "../../src/features/quick-schedule/grouping";
import fixtureE from "@fixtures/fusion/E-care-plan-report-229.txt?raw";

/** Before fixture E's plan (Apr 1, 2026 to Jan 31, 2027) starts, so all 10 months are scheduled. */
const BEFORE_E = new Date("2026-03-15T12:00:00-05:00");

function result(ruleId: string, severity: Severity, taskId?: string): ScheduleValidationResult {
  return { ruleId, severity, message: "message", refs: taskId ? { taskId } : {}, rulePackVersion: "mo-2026-07" };
}

describe("Quick Schedule grouping", () => {
  it("groups by ruleId + severity + taskId and orders BLOCK, REVIEW, WARN, INFO", () => {
    const groups = groupResults([
      result("SCH-03", "WARN"),
      result("AUTH-12", "BLOCK"),
      result("SCH-12", "REVIEW"),
      result("SCH-03", "WARN"),
      result("AUTH-05", "INFO"),
    ]);
    expect(groups.map((g) => `${g.ruleId}/${g.severity}`)).toEqual([
      "AUTH-12/BLOCK",
      "SCH-12/REVIEW",
      "SCH-03/WARN",
      "AUTH-05/INFO",
    ]);
    expect(groups.find((g) => g.ruleId === "SCH-03")!.messages).toHaveLength(2);
  });

  it("groups task-level results separately from service-level ones", () => {
    const groups = groupResults([
      result("SCH-08", "BLOCK"),
      result("SCH-08", "BLOCK", "t1"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.taskId === "t1")?.ruleId).toBe("SCH-08");
  });

  it("reports the AUTH-07 REVIEW in 2 of 10 months for E with two months' figures changed", () => {
    const text = fixtureE
      .replace("06/30/2026	T1019	229", "06/30/2026	T1019	200")
      .replace("09/30/2026	T1019	229", "09/30/2026	T1019	240");
    const state = fromFusion(parseFusionText(text, MO_2026_07), 0, BEFORE_E);
    const model = buildQuickModel(state, MO_2026_07);
    const groups = groupResults(model.results as ScheduleValidationResult[]);
    const auth07 = groups.find((g) => g.ruleId === "AUTH-07" && g.severity === "REVIEW");
    expect(auth07).toBeDefined();
    expect(auth07!.months).toEqual(["2026-06", "2026-09"]);
    expect(monthsContext(auth07!.months, model.months.length)).toBe("2 of 10 months");
    expect(contextFor(auth07!, "Bathing", model.months.length)).toBe("Bathing, 2 of 10 months");
  });

  it("formats single months and every-month contexts", () => {
    expect(monthsContext(["2025-12"], 11)).toBe("December 2025");
    expect(monthsContext([], 11)).toBeNull();
    expect(
      monthsContext(
        ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
        11,
      ),
    ).toBe("every month of the plan");
  });
});
