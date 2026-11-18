import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { fromFusion, longestWithoutCare, SPREAD_DAYS, spreadSubset } from "../../src/features/import/fromFusion";
import { buildQuickModel, combinedRespiteFigure, monthFigures } from "../../src/features/quick-schedule/model";
import { manualState, reduce } from "../../src/features/quick-schedule/state";
import type { QuickState } from "../../src/features/quick-schedule/types";
import fixtureA from "@fixtures/fusion/A-run-together-5day-466.txt?raw";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";
import fixtureC from "@fixtures/fusion/C-rows-only-older-plan-402.txt?raw";
import fixtureE from "@fixtures/fusion/E-care-plan-report-229.txt?raw";

const TODAY = new Date("2026-10-21T12:00:00-05:00");
/** Before fixture B's plan starts (Dec 1, 2025), so all 11 months are still to come. */
const BEFORE_B = new Date("2025-11-20T12:00:00-06:00");
/** Before fixture E's plan starts (Apr 1, 2026), so all 10 months are still to come. */
const BEFORE_E = new Date("2026-03-15T12:00:00-05:00");

function modelAt(fixture: string, today: Date) {
  return buildQuickModel(fromFusion(parseFusionText(fixture, MO_2026_07), 0, today), MO_2026_07);
}

function modelFor(fixture: string) {
  return modelAt(fixture, TODAY);
}

function dayTotals(model: ReturnType<typeof modelFor>): number[] {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of model.entries) totals[entry.weekday] = (totals[entry.weekday] ?? 0) + entry.minutes;
  return totals;
}

describe("Quick Schedule model", () => {
  it("IMP-T16: checksum matches A and B, not C", () => {
    const a = modelFor(fixtureA).checksum;
    expect(a?.fusion).toBe(466);
    expect(a?.matches).toBe(true);

    const b = modelFor(fixtureB).checksum;
    expect(b?.fusion).toBe(455);
    expect(b?.byMonthLength).toEqual({ "30": 455, "31": 469, "28": 434 });
    expect(b?.matches).toBe(true);

    const c = modelFor(fixtureC).checksum;
    expect(c?.fusion).toBe(402);
    expect(c?.byMonthLength).toEqual({ "28": 374, "30": 391, "31": 401 });
    expect(c?.matches).toBe(false);
  });

  it("IMP-T17: B's figure is for a 30-day month; each month gets Fusion's proration, so nothing is cut", () => {
    const model = modelAt(fixtureB, BEFORE_B);
    expect(model.months).toHaveLength(11);
    expect(Object.fromEntries(model.monthlyAuthorizations.map((a) => [a.month, a.units]))).toMatchObject({
      "2025-12": 469, // 31 days
      "2026-02": 434, // 28 days
      "2026-04": 455, // 30 days, Fusion's figure
    });
    expect(model.trims).toEqual([]);
    expect(model.results.filter((r) => r.severity === "BLOCK" || r.ruleId === "AUTH-07")).toEqual([]);
    expect(monthFigures(model, "2025-12")).toMatchObject({ authorizedUnits: 469, source: "fusion", proratedDays: 31 });
  });

  it("SCH-17: with Fusion's figure below the tasks (B at 440), a month that needs more is cut to it at the end", () => {
    const model = modelAt(fixtureB.replaceAll("455 units", "440 units"), BEFORE_B);
    const units = Object.fromEntries(model.monthlyAuthorizations.map((a) => [a.month, a.units]));
    // Rows don't add up to Fusion's figure: never raised above it, lowered in February.
    expect(units).toMatchObject({ "2025-12": 440, "2026-02": 419, "2026-04": 440 });
    const cut: string[] = [];
    for (const month of model.months) {
      const figures = monthFigures(model, month);
      expect(figures.scheduledTaskMinutes, month).toBeLessThanOrEqual(figures.taskBudgetMinutes);
      if (figures.trimmedMinutes === 0) continue;
      cut.push(month);
      // Cut exactly to the figure, from the end of the month.
      expect(figures.scheduledTaskMinutes, month).toBe(figures.taskBudgetMinutes);
      expect(figures.trims.every((trim) => trim.date >= `${month}-25`), month).toBe(true);
    }
    // February and April fit: their once-a-week tasks come 4 times, against the factor's 5.
    expect(cut).toEqual(model.months.filter((month) => month !== "2026-02" && month !== "2026-04"));
    expect(model.results.filter((r) => r.ruleId === "AUTH-07").map((r) => r.refs.month)).toEqual(model.months);
    expect(model.results.filter((r) => r.severity === "BLOCK")).toEqual([]);
  });

  it("a plan that started before this month is scheduled from this month; its dates stay Fusion's", () => {
    const state = fromFusion(parseFusionText(fixtureB, MO_2026_07), 0, TODAY);
    const model = buildQuickModel(state, MO_2026_07);
    expect(state.plan).toEqual({ start: "2025-12-01", end: "2026-10-31" });
    expect(model.months).toEqual(["2026-10"]);
    expect(model.auth.start).toBe("2026-10-01");
    expect(state.viewMonth).toBe("2026-10");
  });

  // Nov 17, 2026 review: Mon–Thu left Friday to Sunday without bowel program, catheter care or
  // toileting. Care days now leave the participant the fewest days in a row without care.
  it("spreads the care days so no more days in a row go without care than the count needs", () => {
    expect(SPREAD_DAYS).toEqual({
      1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 3, 5, 6], 5: [1, 2, 4, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 0],
    });
    expect(longestWithoutCare([1, 3, 5, 6])).toBe(1);
    expect(longestWithoutCare([1, 2, 3, 4])).toBe(3);
    expect(longestWithoutCare([1, 2, 4, 5, 6])).toBe(1);
    expect(longestWithoutCare([1, 4])).toBe(3);
    // A service with fewer days takes the spread-out subset of the shared days, then the lightest.
    expect(spreadSubset([1, 3, 5, 6], 3, [])).toEqual([1, 3, 5]);
    expect(spreadSubset([1, 3, 5, 6], 2, [])).toEqual([1, 5]);
    expect(spreadSubset([1, 2, 3, 4, 5], 1, [0, 50, 10, 0, 0, 20, 0])).toEqual([3]);
  });

  // Nov 17, 2026: five days are spread (Monday, Tuesday, Thursday, Friday, Saturday), so no two
  // days in a row go without care; the same 1,315 minutes a week.
  it("IMP-T18: A has spread care days, Friday transport, and the expected day totals", () => {
    const state = fromFusion(parseFusionText(fixtureA, MO_2026_07), 0, TODAY);
    expect(state.activeDays).toEqual([false, true, true, false, true, true, true]);
    expect(state.transport.day).toBe(5);

    const model = buildQuickModel(state, MO_2026_07);
    expect(model.allowance?.weeklyMinutes).toBe(150);
    expect(dayTotals(model)).toEqual([0, 290, 285, 0, 275, 195, 270]);
    // The one thing to review is CDS-04 (CP4-7): A has CDS transportation, and NEMT trips can't be CDS time.
    expect(model.results.filter((r) => r.severity === "BLOCK" || r.severity === "REVIEW").map((r) => r.ruleId)).toEqual(["CDS-04"]);
  });

  it("IMP-T25: E, Fusion's care plan report: each month's own figure, a matching checksum, no BLOCK", () => {
    const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"];
    const state = fromFusion(parseFusionText(fixtureE, MO_2026_07), 0, BEFORE_E);
    expect(state.serviceCode).toBe("T1019");
    expect(state.headerUnits).toBe(229);
    expect(state.fusion).toEqual(Object.fromEntries(months.map((month) => [month, 229])));

    const model = buildQuickModel(state, MO_2026_07);
    expect(model.monthlyAuthorizations.map((a) => [a.month, a.units])).toEqual(months.map((month) => [month, 229]));
    expect(model.checksum).toEqual({ fusion: 229, byMonthLength: { "30": 229, "31": 229 }, matches: true });
    expect(model.results.filter((r) => r.severity === "BLOCK")).toHaveLength(0);
  });

  it("runs only the plan rules: E's agency plan has no referral date, and no visit to check one against", () => {
    const model = modelFor(fixtureE);
    expect(model.results.filter((r) => r.ruleId === "SCH-14" || r.ruleId.startsWith("CON-"))).toEqual([]);
    expect(model.results.filter((r) => r.severity === "REVIEW" || r.severity === "WARN")).toEqual([]);
  });

  it("IMP-T25: a month the report gives its own figure is checked against that figure", () => {
    const model = modelAt(fixtureE.replace("06/30/2026	T1019	229", "06/30/2026	T1019	200"), BEFORE_E);
    expect(monthFigures(model, "2026-06")).toMatchObject({ authorizedUnits: 200, source: "fusion" });
    expect(monthFigures(model, "2026-07")).toMatchObject({ authorizedUnits: 229, source: "fusion" });
  });

  it("AC-13: the TC-01 tasks by hand give the engine's day totals and month units", () => {
    const state: QuickState = {
      source: "manual",
      identity: null,
      provider: null,
      pa: null,
      serviceLabel: null,
      serviceCode: "T1019U2",
      plan: { start: "2026-01-01", end: "2026-12-31" },
      headerUnits: null,
      tasks: [
        { id: "t1", taskCode: "BATHING", name: "Bathing", minPerDay: 30, daysPerWeek: 3, pinned: null, locked: false },
        { id: "t2", taskCode: "TOILETING", name: "Toileting", minPerDay: 15, daysPerWeek: 7, pinned: null, locked: false },
        { id: "t3", taskCode: "MEALS", name: "Meals/Dishes", minPerDay: 45, daysPerWeek: 7, pinned: null, locked: false },
        { id: "t4", taskCode: "LAUNDRY", name: "Laundry", minPerDay: 30, daysPerWeek: 2, pinned: null, locked: false },
        { id: "t5", taskCode: "KITCHEN", name: "Clean Kitchen", minPerDay: 10, daysPerWeek: 2, pinned: null, locked: false },
      ],
      id: "auth-test-1",
      activeDays: [true, true, true, true, true, true, true],
      transport: { minPerTrip: 0, tripsPerWeek: 1, day: 1 },
      edits: {},
      fusion: {},
      fromMonth: "2026-01",
      viewMonth: "2026-01",
      reviewed: null,
      isExample: false,
      notes: [],
      rowsRead: 0,
    };
    const model = buildQuickModel(state, MO_2026_07);
    expect(dayTotals(model)).toEqual([70, 90, 90, 90, 90, 90, 70]);
    expect(monthFigures(model, "2026-01").calculatedUnits).toBe(181); // 31 days
    expect(monthFigures(model, "2026-09").calculatedUnits).toBe(177); // 30 days
    expect(monthFigures(model, "2026-02").calculatedUnits).toBe(169); // 28 days
  });

  it("AUTH-09: by hand, tasks above the service's monthly limit are worth checking in every month", () => {
    let state = manualState(TODAY);
    for (const [taskCode, name] of [["BATHING", "Bathing"], ["MEAL_PREP_EATING", "Meal Prep/Eating"], ["MOBILITY_TRANSFER", "Mobility/Transfer"]]) {
      state = reduce(state, { type: "addTask", taskCode: taskCode!, name: name! }, MO_2026_07).state;
    }
    expect(state.tasks).toHaveLength(3);
    expect(buildQuickModel(state, MO_2026_07).results.filter((r) => r.ruleId === "AUTH-09")).toEqual([]);

    // 120 minutes every day for three tasks: 720 to 744 units a month, over CDS's 641.
    for (const task of state.tasks) {
      state = reduce(state, { type: "setMinutes", taskId: task.id, minutes: 120 }, MO_2026_07).state;
    }
    const model = buildQuickModel(state, MO_2026_07);
    const ceiling = model.results.filter((r) => r.ruleId === "AUTH-09");
    expect(ceiling.map((r) => [r.severity, r.refs.month])).toEqual(model.months.map((month) => ["WARN", month]));
  });

  it("CON-09: by hand, ILW gets one plan-wide REVIEW (E-02), and over 49 hours every week is refused (the weekly pattern is checked)", () => {
    let state = reduce(manualState(TODAY), { type: "setService", code: "T1019U6" }, MO_2026_07).state;
    for (const [taskCode, name] of [["BATHING", "Bathing"], ["MEAL_PREP_EATING", "Meal Prep/Eating"], ["MOBILITY_TRANSFER", "Mobility/Transfer"]]) {
      state = reduce(state, { type: "addTask", taskCode: taskCode!, name: name! }, MO_2026_07).state;
    }
    // 140 minutes a day for each of three daily tasks: 49 hours a week, not over.
    for (const task of state.tasks) {
      state = reduce(state, { type: "setMinutes", taskId: task.id, minutes: 140 }, MO_2026_07).state;
    }
    const weekly = buildQuickModel(state, MO_2026_07).results.filter((r) => r.ruleId === "CON-09");
    expect(weekly.map((r) => [r.severity, r.refs.month])).toEqual([["REVIEW", undefined]]);
    // 150 for the last task would be 52 hours 30 minutes every week: refused.
    const refused = reduce(state, { type: "setMinutes", taskId: state.tasks[2]!.id, minutes: 150 }, MO_2026_07);
    expect(refused.refusal).toBeDefined();
    expect(refused.state).toBe(state);
  });

  it("builds fixture B in under 50 ms", () => {
    const state = fromFusion(parseFusionText(fixtureB, MO_2026_07), 0, TODAY);
    const start = Date.now();
    buildQuickModel(state, MO_2026_07);
    expect(Date.now() - start).toBeLessThan(50);
  });
});

describe("combinedRespiteFigure", () => {
  function respite(code: "S5150" | "S5150TF", month: string, units: number) {
    let state = reduce(manualState(TODAY), { type: "setService", code }, MO_2026_07).state;
    state = reduce(state, { type: "setFusionUnits", month, units }, MO_2026_07).state;
    return buildQuickModel(state, MO_2026_07);
  }

  it("combines Basic and Advanced into one figure with the shared 868 ceiling", () => {
    const basic = respite("S5150", "2026-11", 500);
    const advanced = respite("S5150TF", "2026-11", 500);
    expect(combinedRespiteFigure([basic, advanced], "2026-11")).toEqual({ units: 1000, ceiling: 868 });
  });

  it("is null when the plan has only one respite service", () => {
    expect(combinedRespiteFigure([respite("S5150", "2026-11", 500)], "2026-11")).toBeNull();
  });

  it("is null for a plan with no respite services", () => {
    const pc = buildQuickModel(
      reduce(manualState(TODAY), { type: "setService", code: "T1019" }, MO_2026_07).state,
      MO_2026_07,
    );
    expect(combinedRespiteFigure([pc], "2026-11")).toBeNull();
  });
});
