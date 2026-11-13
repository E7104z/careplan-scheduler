import { beforeEach, describe, expect, it } from "vitest";
import { MO_2026_07, expandChainMonth, expandMonth } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import {
  amendedState,
  amendmentLines,
  amendmentResults,
  amendmentWhen,
  amendmentsOf,
  recordAmendment,
  removeAmendment,
  serviceChain,
  type AmendmentDraft,
} from "../../src/features/quick-schedule/amendments";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { loadPlan, PLAN_KEY, savePlan } from "../../src/features/quick-schedule/persistence";
import type { CarePlan, QuickState } from "../../src/features/quick-schedule/types";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";

// CP3-6 on fixture B (CDS, every day, Dec 1, 2025 to Oct 31, 2026), built before the plan starts.
const PACK = MO_2026_07;

function planB(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureB), PACK, new Date("2025-11-20T12:00:00-06:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture B should build");
  return outcome.plan;
}

function bathing(state: QuickState) {
  return state.tasks.find((task) => task.name === "Bathing")!;
}

function draft(state: QuickState, more: Partial<AmendmentDraft> & { minutes?: number }): AmendmentDraft {
  const task = bathing(state);
  return {
    direction: "increase", date: "2026-01-15", confirmed: false, units: null,
    tasks: { [task.id]: { minPerDay: more.minutes ?? 60, daysPerWeek: task.daysPerWeek } },
    ...more,
  };
}

function record(plan: CarePlan, more: Partial<AmendmentDraft> & { minutes?: number } = {}): CarePlan {
  const change = recordAmendment(plan, 0, draft(plan.services[0]!, more), PACK);
  expect(change.refusal).toBeUndefined();
  return change.plan;
}

function bathingOn(plan: CarePlan, date: string): { minutes: number; amendmentId: string | null } {
  const state = plan.services[0]!;
  const { chain } = serviceChain(state, buildQuickModel(state, PACK), PACK);
  const [year, month] = date.split("-").map(Number) as [number, number];
  const occurrence = expandChainMonth(chain, [], year, month).find((entry) => entry.date === date && entry.taskId === bathing(state).id)!;
  return { minutes: occurrence.minutes, amendmentId: occurrence.amendmentId };
}

beforeEach(() => sessionStorage.clear());

describe("recording a care plan change (Manual 4.20)", () => {
  it("an increase mid-month recalculates from that date and not before", () => {
    const plan = record(planB());
    const id = amendmentsOf(plan.services[0]!)[0]!.id;
    expect(bathingOn(plan, "2026-01-14")).toEqual({ minutes: 45, amendmentId: null });
    expect(bathingOn(plan, "2026-01-15")).toEqual({ minutes: 60, amendmentId: id });
    expect(bathingOn(plan, "2026-03-10")).toEqual({ minutes: 60, amendmentId: id });
    expect(amendmentWhen(amendmentsOf(plan.services[0]!)[0]!)).toBe("Takes effect Jan 15, 2026");
  });

  it("a decrease dated mid-month takes effect on the first of the next month", () => {
    const plan = record(planB(), { direction: "decrease", minutes: 30 });
    expect(bathingOn(plan, "2026-01-15").minutes).toBe(45);
    expect(bathingOn(plan, "2026-01-31").minutes).toBe(45);
    expect(bathingOn(plan, "2026-02-01").minutes).toBe(30);
    expect(amendmentWhen(amendmentsOf(plan.services[0]!)[0]!)).toBe(
      "Takes effect Feb 1, 2026 (entered Jan 15, 2026; a decrease starts on the first of a month)",
    );
  });

  it("a reduction the participant asked for takes effect on its date", () => {
    const plan = record(planB(), { direction: "reduction-immediate", minutes: 30 });
    expect(bathingOn(plan, "2026-01-14").minutes).toBe(45);
    expect(bathingOn(plan, "2026-01-15").minutes).toBe(30);
  });

  it("a month crossing a change shows both versions; the months before it are exactly as they were", () => {
    const base = planB();
    const state = base.services[0]!;
    const model = buildQuickModel(state, PACK);
    const plan = record(base);
    const { chain } = serviceChain(plan.services[0]!, buildQuickModel(plan.services[0]!, PACK), PACK);
    const january = expandChainMonth(chain, [], 2026, 1);
    expect(new Set(january.map((occurrence) => occurrence.amendmentId)).size).toBe(2);
    // December is untouched: what the chain gives is what the plan gave before the change.
    const before = expandMonth(model.template, [], 2025, 12, model.auth.start, model.auth.end);
    for (const occurrence of expandChainMonth(chain, [], 2025, 12)) {
      expect(occurrence.amendmentId).toBeNull();
      expect(occurrence.minutes).toBe(before[occurrence.date]![occurrence.taskId]);
    }
  });

  it("never edits what Fusion printed: the imported tasks, units and figures stay as read", () => {
    const base = planB();
    const plan = record(base, { units: 480 });
    const [before, after] = [base.services[0]!, plan.services[0]!];
    expect(after.tasks).toEqual(before.tasks);
    expect(after.headerUnits).toBe(455);
    expect(after.fusion).toEqual(before.fusion);
    expect(buildQuickModel(after, PACK).monthlyAuthorizations).toEqual(buildQuickModel(before, PACK).monthlyAuthorizations);
    // The new figure lives in the version, for its full months only.
    const amendment = amendmentsOf(after)[0]!;
    const variant = amendedState(after, amendment, "2026-01-15");
    expect(variant.fusion["2026-02"]).toBe(480);
    expect(variant.fusion["2026-01"]).toBeUndefined();
    expect(amendmentLines(after, amendment)).toEqual([
      "Bathing: 45 min a day, 7 days a week → 60 min a day, 7 days a week",
      "480 units a month from the change on",
    ]);
  });

  it("a plan with no recorded change is one version and raises nothing", () => {
    const state = planB().services[0]!;
    const model = buildQuickModel(state, PACK);
    expect(serviceChain(state, model, PACK).versions).toHaveLength(1);
    expect(amendmentResults(state, model, PACK)).toEqual([]);
  });

  it("stays under review until the person says the care plan shows the date (AMEND-01)", () => {
    const unconfirmed = record(planB()).services[0]!;
    expect(amendmentResults(unconfirmed, buildQuickModel(unconfirmed, PACK), PACK).map((result) => [result.ruleId, result.severity, result.refs.date])).toEqual([
      ["AMEND-01", "REVIEW", "2026-01-15"],
    ]);
    const confirmed = record(planB(), { confirmed: true }).services[0]!;
    expect(amendmentResults(confirmed, buildQuickModel(confirmed, PACK), PACK)).toEqual([]);
  });

  it("zero minutes takes a task out of the week from the change on, and only from then", () => {
    const plan = record(planB(), { direction: "reduction-immediate", minutes: 0 });
    const state = plan.services[0]!;
    const { chain } = serviceChain(state, buildQuickModel(state, PACK), PACK);
    const taskId = bathing(state).id;
    const january = expandChainMonth(chain, [], 2026, 1).filter((occurrence) => occurrence.taskId === taskId);
    expect(january.map((occurrence) => occurrence.date).at(-1)).toBe("2026-01-14");
    expect(amendmentLines(state, amendmentsOf(state)[0]!)).toEqual(["Bathing: 45 min a day, 7 days a week → not in the week"]);
  });
});

describe("the guard on recording a change", () => {
  it("refuses a change that names nothing", () => {
    const plan = planB();
    const same = draft(plan.services[0]!, { minutes: 45 });
    expect(recordAmendment(plan, 0, same, PACK)).toEqual({
      plan, refusal: "Not recorded. Change a task's minutes or days, or enter the new units a month.",
    });
  });

  it("refuses a date outside the schedule, saying which dates work", () => {
    const plan = planB();
    for (const date of ["2025-12-01", "2025-11-01", "2026-11-15"]) {
      const refused = recordAmendment(plan, 0, draft(plan.services[0]!, { date }), PACK);
      expect(refused.plan, date).toBe(plan);
      expect(refused.refusal, date).toMatch(/^Not recorded\. A change takes effect after Dec 1, 2025 and no later than Oct 31, 2026; this one would take effect on /);
    }
  });

  it("refuses a change that would take effect before one already recorded: history is not rewritten", () => {
    const first = record(planB(), { date: "2026-03-01" });
    const refused = recordAmendment(first, 0, draft(first.services[0]!, { date: "2026-02-01", minutes: 30 }), PACK);
    expect(refused.plan).toBe(first);
    expect(refused.refusal).toMatch(/^Not recorded\. A change takes effect after Mar 1, 2026/);
  });

  it("refuses a date that isn't one", () => {
    const plan = planB();
    expect(recordAmendment(plan, 0, draft(plan.services[0]!, { date: "" }), PACK).refusal).toBe(
      "Not recorded. Enter the date the change takes effect.",
    );
  });

  it("a recorded change clears 'reviewed with the participant', and removing it leaves the plan as it was", () => {
    const base = planB();
    const reviewed: CarePlan = { ...base, services: [{ ...base.services[0]!, reviewed: "2025-11-20" }] };
    const plan = record(reviewed);
    expect(plan.services[0]!.reviewed).toBeNull();
    const removed = removeAmendment(plan, 0, amendmentsOf(plan.services[0]!)[0]!.id);
    expect(removed.services[0]!.amendments).toEqual([]);
    expect(removed.services[0]!.tasks).toEqual(base.services[0]!.tasks);
  });
});

describe("storage", () => {
  it("a plan with a recorded change round-trips, and a plan saved before them still opens", () => {
    const base = planB();
    savePlan(base);
    expect(loadPlan()!.services[0]!.amendments).toBeUndefined();
    const plan = record(base);
    savePlan(plan);
    expect(loadPlan()!.services[0]!.amendments).toEqual(plan.services[0]!.amendments);
    expect(sessionStorage.getItem(PLAN_KEY)).not.toMatch(/SAMPLE PARTICIPANT|10000002/);
  });

  it("a malformed change drops the saved plan", () => {
    const plan = record(planB());
    const stored = { ...plan, services: plan.services.map(({ identity: _identity, ...rest }) => ({ ...rest, amendments: [{ ...rest.amendments![0]!, direction: "sideways" }] })) };
    sessionStorage.setItem(PLAN_KEY, JSON.stringify(stored));
    expect(loadPlan()).toBeNull();
  });
});
