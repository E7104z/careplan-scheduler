import { beforeEach, describe, expect, it } from "vitest";
import { MO_2026_07, coverageBlockUnits } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { singlePlan } from "../../src/features/quick-schedule/carePlan";
import { addCoverageBlock, coverageEntryError, isCoverageShift, removeCoverageBlock } from "../../src/features/quick-schedule/coverage";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { loadPlan, savePlan } from "../../src/features/quick-schedule/persistence";
import { manualState, reduce } from "../../src/features/quick-schedule/state";
import type { CarePlan } from "../../src/features/quick-schedule/types";
import { buildVisits } from "../../src/features/quick-schedule/visits";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-4: a Respite coverage block's span is its duration (Policy 3.50), fed into the visit check.
const PACK = MO_2026_07;

const TODAY = new Date("2026-10-21T12:00:00-05:00");

function respiteState(code: "S5150" | "S5150TF" = "S5150") {
  return reduce(manualState(TODAY), { type: "setService", code }, PACK).state;
}

function planF(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), PACK, new Date("2026-04-15T12:00:00-05:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture F should build");
  return outcome.plan;
}

const modelsOf = (plan: CarePlan) => plan.services.map((state) => buildQuickModel(state, PACK));

function withBlock(plan: CarePlan): CarePlan {
  const block = { id: "cb-1", serviceAuthId: plan.services[0]!.id, start: "2026-05-11T10:00", end: "2026-05-11T16:00" };
  return { ...plan, services: plan.services.map((state, index) => (index === 0 ? { ...state, coverage: [block] } : state)) };
}

beforeEach(() => sessionStorage.clear());

describe("CP4-4: coverage blocks", () => {
  it("a coverage block's span is the visit, and a six-hour span is 24 units", () => {
    const plan = withBlock(planF());
    const visit = buildVisits(plan, modelsOf(plan), PACK).find((v) => v.id === "cb-1")!;
    expect(visit).toMatchObject({ start: "2026-05-11T10:00", end: "2026-05-11T16:00", taskIds: [] });
    // The span is 24 unit-equivalents; the block carries no tasks, so nothing adds to it.
    expect(coverageBlockUnits({ id: "cb-1", serviceAuthId: plan.services[0]!.id, start: "2026-05-11T10:00", end: "2026-05-11T16:00" })).toBe(24);
  });

  it("round-trips through storage with no name or DCN", () => {
    const plan = withBlock(planF());
    savePlan(plan);
    expect(sessionStorage.getItem("cps.quick.v3")).not.toMatch(/SAMPLE PARTICIPANT|10000006/);
    expect(loadPlan()!.services[0]!.coverage).toEqual(plan.services[0]!.coverage);
  });
});

describe("CP4-4: coverage block entry", () => {
  it("isCoverageShift names only the two respite services", () => {
    expect(isCoverageShift(buildQuickModel(respiteState("S5150"), PACK))).toBe(true);
    expect(isCoverageShift(buildQuickModel(respiteState("S5150TF"), PACK))).toBe(true);
    expect(
      isCoverageShift(buildQuickModel(reduce(manualState(TODAY), { type: "setService", code: "T1019" }, PACK).state, PACK)),
    ).toBe(false);
  });

  it("accepts a same-day span inside the plan, and refuses a bad entry with its own words", () => {
    const state = respiteState();
    expect(coverageEntryError(state, "2026-11-05", "09:00", "15:00")).toBeNull();
    expect(coverageEntryError(state, "2026-11-05", "15:00", "09:00")).toBe("The end time must be after the start time.");
    expect(coverageEntryError(state, "2026-11-05", "09:00", "09:00")).toBe("The end time must be after the start time.");
    expect(coverageEntryError(state, "", "09:00", "15:00")).toBe("Enter the date.");
    expect(coverageEntryError(state, "2026-10-30", "09:00", "15:00")).toBe("Oct 30, 2026 is outside the plan's dates.");
    expect(coverageEntryError(state, "2026-11-05", "9am", "15:00")).toBe("Enter the start and end times as hours and minutes, like 9:00 AM.");
  });

  it("adds a block to its service, then takes it off again", () => {
    const plan = singlePlan(respiteState());
    const models = plan.services.map((state) => buildQuickModel(state, PACK));
    const added = addCoverageBlock(plan, 0, "2026-11-05", "09:00", "15:00", PACK, models);
    expect(added.refusal).toBeUndefined();
    expect(added.plan.services[0]!.coverage).toHaveLength(1);
    expect(added.plan.services[0]!.coverage![0]).toMatchObject({
      start: "2026-11-05T09:00",
      end: "2026-11-05T15:00",
      serviceAuthId: plan.services[0]!.id,
    });

    const blockId = added.plan.services[0]!.coverage![0]!.id;
    expect(removeCoverageBlock(added.plan, 0, blockId).plan.services[0]!.coverage).toEqual([]);
    expect(removeCoverageBlock(added.plan, 0, "not-a-block").plan.services[0]!.coverage).toHaveLength(1);
  });

  it("refuses an end before the start through the guard, leaving the plan unchanged", () => {
    const plan = singlePlan(respiteState());
    const models = plan.services.map((state) => buildQuickModel(state, PACK));
    const refused = addCoverageBlock(plan, 0, "2026-11-05", "15:00", "09:00", PACK, models);
    expect(refused.plan).toBe(plan);
    expect(refused.refusal).toBe("Not changed. The end time must be after the start time.");
  });

  it("adds a block to only the chosen service of a two-service plan", () => {
    const plan: CarePlan = { services: [respiteState("S5150"), respiteState("S5150TF")], visits: [], notes: [], view: "plan" };
    const models = plan.services.map((state) => buildQuickModel(state, PACK));
    const added = addCoverageBlock(plan, 0, "2026-11-05", "09:00", "15:00", PACK, models);
    expect(added.refusal).toBeUndefined();
    expect(added.plan.services[0]!.coverage).toHaveLength(1);
    expect(added.plan.services[1]!.coverage ?? []).toHaveLength(0);
  });
});

