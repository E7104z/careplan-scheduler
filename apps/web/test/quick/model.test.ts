import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { fromFusion } from "../../src/features/import/fromFusion";
import { buildQuickModel, monthFigures } from "../../src/features/quick-schedule/model";
import { manualState, reduce } from "../../src/features/quick-schedule/state";
import type { QuickState } from "../../src/features/quick-schedule/types";
import fixtureA from "@fixtures/fusion/A-run-together-5day-466.txt?raw";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";
import fixtureC from "@fixtures/fusion/C-rows-only-older-plan-402.txt?raw";
import fixtureE from "@fixtures/fusion/E-care-plan-report-229.txt?raw";

const TODAY = new Date("2026-10-21T12:00:00-05:00");

function modelFor(fixture: string) {
  return buildQuickModel(fromFusion(parseFusionText(fixture, MO_2026_07), 0, TODAY), MO_2026_07);
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

  it("IMP-T17: B has zero BLOCK and trims only the three 31-day month ends", () => {
    const model = modelFor(fixtureB);
    expect(model.results.filter((r) => r.severity === "BLOCK")).toHaveLength(0);
    expect(model.results.filter((r) => r.ruleId === "SCH-11")).toHaveLength(0);

    const mealPrep = model.tasks.find((t) => t.name === "Meal Prep/Eating")!.id;
    const bathing = model.tasks.find((t) => t.name === "Bathing")!.id;
    const byDate: Record<string, Record<string, number>> = {};
    for (const trim of model.trims) {
      (byDate[trim.date] ??= {})[trim.taskId] = -trim.minutesDelta;
    }
    expect(byDate).toEqual({
      "2025-12-31": { [mealPrep]: 60, [bathing]: 35 },
      "2026-03-31": { [mealPrep]: 60, [bathing]: 15 },
      "2026-08-31": { [mealPrep]: 55 },
    });
  });

  it("IMP-T18: A has Mon–Fri care days, Friday transport, and the expected day totals", () => {
    const state = fromFusion(parseFusionText(fixtureA, MO_2026_07), 0, TODAY);
    expect(state.activeDays).toEqual([false, true, true, true, true, true, false]);
    expect(state.transport.day).toBe(5);

    const model = buildQuickModel(state, MO_2026_07);
    expect(model.allowance?.weeklyMinutes).toBe(150);
    expect(dayTotals(model)).toEqual([0, 290, 285, 275, 270, 195, 0]);
    expect(model.results.filter((r) => r.severity === "BLOCK" || r.severity === "REVIEW")).toHaveLength(0);
  });

  it("IMP-T25: E, Fusion's care plan report: each month's own figure, a matching checksum, no BLOCK", () => {
    const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"];
    const state = fromFusion(parseFusionText(fixtureE, MO_2026_07), 0, TODAY);
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
    const model = modelFor(fixtureE.replace("06/30/2026	T1019	229", "06/30/2026	T1019	200"));
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
      nextId: 6,
      activeDays: [true, true, true, true, true, true, true],
      transport: { minPerTrip: 0, tripsPerWeek: 1, day: 1 },
      edits: {},
      fusion: {},
      viewMonth: "2026-01",
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

  it("builds fixture B in under 50 ms", () => {
    const state = fromFusion(parseFusionText(fixtureB, MO_2026_07), 0, TODAY);
    const start = Date.now();
    buildQuickModel(state, MO_2026_07);
    expect(Date.now() - start).toBeLessThan(50);
  });
});
