import { beforeEach, describe, expect, it } from "vitest";
import { MO_2026_07, coverageBlockUnits } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { loadPlan, savePlan } from "../../src/features/quick-schedule/persistence";
import type { CarePlan } from "../../src/features/quick-schedule/types";
import { buildVisits } from "../../src/features/quick-schedule/visits";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-4: a Respite coverage block's span is its duration (Policy 3.50), fed into the visit check.
const PACK = MO_2026_07;

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
