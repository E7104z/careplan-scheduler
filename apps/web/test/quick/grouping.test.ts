import { describe, expect, it } from "vitest";
import { MO_2026_07, type ScheduleValidationResult, type Severity } from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { fromFusion } from "../../src/features/import/fromFusion";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { contextFor, groupResults, monthsContext } from "../../src/features/quick-schedule/grouping";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";

const TODAY = new Date("2026-10-21T12:00:00-05:00");

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

  it("reports the AUTH-07 REVIEW across 8 of 11 months for fixture B", () => {
    const state = fromFusion(parseFusionText(fixtureB, MO_2026_07), 0, TODAY);
    const model = buildQuickModel(state, MO_2026_07);
    const groups = groupResults(model.results as ScheduleValidationResult[]);
    const auth07 = groups.find((g) => g.ruleId === "AUTH-07" && g.severity === "REVIEW");
    expect(auth07).toBeDefined();
    expect(auth07!.months).toHaveLength(8);
    expect(monthsContext(auth07!.months, model.months.length)).toBe("8 of 11 months");
    expect(contextFor(auth07!, "Bathing", model.months.length)).toBe("Bathing, 8 of 11 months");
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
