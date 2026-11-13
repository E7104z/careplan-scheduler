import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { groupResults } from "../../src/features/quick-schedule/grouping";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { planEvents } from "../../src/features/quick-schedule/planEvents";
import { copyFor } from "../../src/features/quick-schedule/ruleCopy";
import { scheduleStatus } from "../../src/features/quick-schedule/status";
import type { CarePlan, PlanVisit } from "../../src/features/quick-schedule/types";
import fixtureP from "@fixtures/fusion/P-TEST-APC-PC-4DAY.txt?raw";

// CP3-3 (RN-03): the made-up APC + PC-Agency plan, Feb 1 to Oct 31, 2026.
const PACK = MO_2026_07;

function planP(today: string): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureP), PACK, new Date(today));
  if (outcome.kind !== "ready") throw new Error("Fixture P should build");
  return outcome.plan;
}

function apcOf(plan: CarePlan) {
  const state = plan.services.find((service) => service.serviceCode === "T1019TF")!;
  return { state, model: buildQuickModel(state, PACK) };
}

describe("NUR-01: Advanced Personal Care in its first month", () => {
  it("a schedule built in the authorization's first month shows the review, for that month only", () => {
    const { model } = apcOf(planP("2026-02-10T12:00:00-06:00"));
    const reviews = model.results.filter((result) => result.ruleId === "NUR-01");
    expect(reviews.map((result) => [result.severity, result.refs.month])).toEqual([["REVIEW", "2026-02"]]);
    expect(reviews[0]!.message).toBe(
      "A new Advanced Personal Care authorization is expected to have two nurse visits in its first month unless an ongoing nurse visit covers it. Check the care plan.",
    );
  });

  it("a schedule built in a later month doesn't show it: the first month has passed", () => {
    const { model } = apcOf(planP("2026-03-10T12:00:00-06:00"));
    expect(model.results.filter((result) => result.ruleId === "NUR-01")).toEqual([]);
  });

  it("never reads as passing: it sits under Needs review and the status says there is something to look at", () => {
    const { state, model } = apcOf(planP("2026-02-10T12:00:00-06:00"));
    const group = groupResults(model.results).find((candidate) => candidate.ruleId === "NUR-01")!;
    expect(group.severity).toBe("REVIEW");
    expect(copyFor("NUR-01", "REVIEW")?.title).toBe("Advanced Personal Care: check the first month's nurse visits");
    const status = scheduleStatus(state, model);
    expect(status.title).toBe("Ready to use");
    expect(status.detail).toMatch(/worth a look in Checks\.$/);
    expect(status.detail).not.toMatch(/^Follows every rule we check, for/);
  });

  it("creates no visit and no event: the app offers a date only for a visit Fusion authorized", () => {
    const plan = planP("2026-02-10T12:00:00-06:00");
    expect(plan.visits).toEqual([]);
    expect(planEvents(plan)).toEqual([]);
  });

  it("with an ongoing authorized nurse visit in the plan, the visit is shown and the review still stands", () => {
    const base = planP("2026-02-10T12:00:00-06:00");
    const ongoing: PlanVisit = {
      id: "visit-rn", label: "RN", serviceCode: "T1001", name: "Authorized Nurse Visit", provider: null,
      start: "2026-02-01", end: "2026-02-28", units: 2, pa: null,
    };
    const plan: CarePlan = { ...base, visits: [ongoing] };
    expect(plan.visits).toHaveLength(1);
    expect(apcOf(plan).model.results.some((result) => result.ruleId === "NUR-01" && result.severity === "REVIEW")).toBe(true);
  });

  it("the other service in the plan (PC - Agency) doesn't raise it", () => {
    const plan = planP("2026-02-10T12:00:00-06:00");
    const other = plan.services.find((service) => service.serviceCode !== "T1019TF")!;
    expect(buildQuickModel(other, PACK).results.filter((result) => result.ruleId === "NUR-01")).toEqual([]);
  });
});
