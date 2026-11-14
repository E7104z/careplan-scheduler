import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { singlePlan } from "../../src/features/quick-schedule/carePlan";
import { addCoverageBlock } from "../../src/features/quick-schedule/coverage";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { copyFor } from "../../src/features/quick-schedule/ruleCopy";
import { manualState, reduce, type ReducerResult } from "../../src/features/quick-schedule/state";
import type { CarePlan, QuickState } from "../../src/features/quick-schedule/types";
import { planVisitResults } from "../../src/features/quick-schedule/visits";

// CP4-6: the 49-hour week (ILW and respite) stays under review until DHSS defines it (audit E-02).
const PACK = MO_2026_07;
const TODAY = new Date("2026-10-21T12:00:00-05:00");

/** ILW by hand with three daily tasks. */
function ilwByHand(): QuickState {
  let state = reduce(manualState(TODAY), { type: "setService", code: "T1019U6" }, PACK).state;
  for (const [taskCode, name] of [["BATHING", "Bathing"], ["MEAL_PREP_EATING", "Meal Prep/Eating"], ["MOBILITY_TRANSFER", "Mobility/Transfer"]]) {
    state = reduce(state, { type: "addTask", taskCode: taskCode!, name: name! }, PACK).state;
  }
  return state;
}

function setAll(state: QuickState, minutes: number[]): ReducerResult {
  let result: ReducerResult = { state };
  state.tasks.forEach((task, index) => {
    if (result.refusal === undefined) result = reduce(result.state, { type: "setMinutes", taskId: task.id, minutes: minutes[index]! }, PACK);
  });
  return result;
}

function respite(code: "S5150" | "S5150TF"): QuickState {
  return reduce(manualState(TODAY), { type: "setService", code }, PACK).state;
}

/** Coverage blocks from `from` to `to` on every day of November 2026, `days` days from the 1st. */
function withBlocks(state: QuickState, from: string, to: string, days: number): QuickState {
  const coverage = Array.from({ length: days }, (_, index) => {
    const date = `2026-11-${String(index + 1).padStart(2, "0")}`;
    return { id: `${state.id}-cb-${date}`, serviceAuthId: state.id, start: `${date}T${from}`, end: `${date}T${to}` };
  });
  return { ...state, coverage };
}

function con09(plan: CarePlan) {
  const models = plan.services.map((state) => buildQuickModel(state, PACK));
  return planVisitResults(plan, models, PACK).filter((r) => r.ruleId === "CON-09");
}

describe("CP4-6: CON-09 on ILW (the weekly pattern)", () => {
  it("ILW-02: exactly 49 hours a week still shows one REVIEW with the open question, never a pass", () => {
    const { state, refusal } = setAll(ilwByHand(), [140, 140, 140]);
    expect(refusal).toBeUndefined();
    const weekly = buildQuickModel(state, PACK).results.filter((r) => r.ruleId === "CON-09");
    expect(weekly.map((r) => r.severity)).toEqual(["REVIEW"]);
    expect(weekly[0]!.message).toContain("Highest Sunday-Saturday week 49 h");
    expect(weekly[0]!.message).toContain("highest 7-day stretch 49 h");
    expect(copyFor("CON-09", "REVIEW", weekly[0]!.refs)?.whatToDo).toBe(
      "DHSS hasn't confirmed which seven days make the week for the 49-hour limit. Check the care plan.",
    );
  });

  it("a change that puts ILW over 49 hours however the week is counted is refused, and nothing changes", () => {
    const before = setAll(ilwByHand(), [140, 140, 140]).state;
    const third = before.tasks[2]!;
    const result = reduce(before, { type: "setMinutes", taskId: third.id, minutes: 150 }, PACK);
    expect(result.refusal).toBe(`${copyFor("CON-09", "BLOCK", {})!.title}.`);
    expect(result.state).toBe(before);
  });
});

describe("CP4-6: CON-09 on respite (the coverage blocks)", () => {
  it("one coverage block shows the REVIEW", () => {
    const plan = singlePlan(withBlocks(respite("S5150"), "10:00", "16:00", 1));
    expect(con09(plan).map((r) => [r.severity, r.message])).toEqual([
      ["REVIEW", "Highest Sunday-Saturday week 6 h (week of 2026-11-01); highest 7-day stretch 6 h (2026-11-01 to 2026-11-07)"],
    ]);
  });

  it("Basic and Advanced combine: 4 h of each every day is 56 h a week however it is counted, so BLOCK and REVIEW", () => {
    const basic = withBlocks(respite("S5150"), "08:00", "12:00", 30);
    const advanced = withBlocks(respite("S5150TF"), "13:00", "17:00", 30);
    const plan: CarePlan = { ...singlePlan(basic), services: [basic, advanced] };
    expect(con09(plan).map((r) => r.severity).sort()).toEqual(["BLOCK", "REVIEW"]);
    // Either one alone is 28 h a week: the REVIEW only.
    expect(con09(singlePlan(basic)).map((r) => r.severity)).toEqual(["REVIEW"]);
  });

  it("the block that would put respite over 49 hours however the week is counted is refused, and nothing changes", () => {
    // 8 h every day from Nov 1 to Nov 13, 2026, except Nov 7: no seven days hold more than 48 h.
    const state = respite("S5150");
    const coverage = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13].map((day) => {
      const date = `2026-11-${String(day).padStart(2, "0")}`;
      return { id: `cb-${day}`, serviceAuthId: state.id, start: `${date}T08:00`, end: `${date}T16:00` };
    });
    const plan = singlePlan({ ...state, coverage });
    const models = plan.services.map((service) => buildQuickModel(service, PACK));
    expect(con09(plan).map((r) => r.severity)).toEqual(["REVIEW"]);
    // Nov 7 makes every seven days from Nov 1 to Nov 13 hold 56 h, whichever day they start.
    const added = addCoverageBlock(plan, 0, "2026-11-07", "08:00", "16:00", PACK, models);
    expect(added.plan).toBe(plan);
    expect(added.refusal).toBe(`Not changed. ${copyFor("CON-09", "BLOCK", {})!.title}. ${copyFor("CON-09", "BLOCK", {})!.whatToDo}`);
    // One hour that day makes those seven days 49 h, which is not over the limit, so it is accepted.
    expect(addCoverageBlock(plan, 0, "2026-11-07", "08:00", "09:00", PACK, models).refusal).toBeUndefined();
  });

  it("no respite blocks: no CON-09", () => {
    expect(con09(singlePlan(respite("S5150")))).toEqual([]);
  });
});
