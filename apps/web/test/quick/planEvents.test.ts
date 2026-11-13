import { beforeEach, describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { singlePlan } from "../../src/features/quick-schedule/carePlan";
import { loadPlan, PLAN_KEY, savePlan } from "../../src/features/quick-schedule/persistence";
import {
  applyEvent,
  dropEvent,
  eventAuthorizations,
  eventsOf,
  planEventResults,
  planEvents,
  sharesVisit,
  UPLOAD_REMINDER_NOTE,
} from "../../src/features/quick-schedule/planEvents";
import { exampleStateA } from "../../src/features/quick-schedule/state";
import type { CarePlan, PlanVisit } from "../../src/features/quick-schedule/types";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

const PACK = MO_2026_07;
// Inside fixture F's plan (Feb 1 to Oct 31, 2026), before its May and August evaluations.
const TODAY = new Date("2026-04-15T12:00:00-05:00");

function planF(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), PACK, TODAY);
  if (outcome.kind !== "ready") throw new Error("Fixture F should build");
  return outcome.plan;
}

function place(plan: CarePlan, visit: PlanVisit, date: string, id?: string) {
  return applyEvent(plan, { id, authorizationId: visit.id!, kind: "NURSE_VISIT", date }, PACK);
}

/** A plan as storage holds it: no identity (APP-SPEC 5.6). */
function stored(plan: CarePlan) {
  return { ...plan, services: plan.services.map(({ identity: _identity, ...rest }) => rest) };
}

beforeEach(() => sessionStorage.clear());

describe("RN-01: only the visits Fusion authorized, and nothing placed by the app", () => {
  it("fixture F has its two evaluations, each with its own id, and no events", () => {
    const plan = planF();
    expect(plan.visits.map((visit) => [visit.name, visit.start, visit.end, visit.units])).toEqual([
      ["General Health Evaluation", "2026-05-01", "2026-05-31", 1],
      ["General Health Evaluation", "2026-08-01", "2026-08-31", 1],
    ]);
    expect(new Set(plan.visits.map((visit) => visit.id)).size).toBe(2);
    expect(planEvents(plan)).toEqual([]);
    expect(eventAuthorizations(plan).map((authorization) => [authorization.unit, authorization.months])).toEqual([
      ["visit", [{ month: "2026-05", quantity: 1 }]],
      ["visit", [{ month: "2026-08", quantity: 1 }]],
    ]);
  });

  it("a plan with no authorized visit has none derived: the CDS example", () => {
    const plan = singlePlan(exampleStateA(TODAY));
    expect(plan.visits).toEqual([]);
    expect(eventAuthorizations(plan)).toEqual([]);
    const refused = applyEvent(plan, { authorizationId: "made-up", kind: "NURSE_VISIT", date: "2026-05-12" }, PACK);
    expect(refused.plan).toBe(plan);
    expect(refused.refusal).toBe("Not placed. That authorization isn't in this care plan.");
  });
});

describe("RN-02: visits are counted by visit, on dates inside their month", () => {
  it("each of F's evaluations can be dated in its month", () => {
    const plan = planF();
    const [may, august] = plan.visits as [PlanVisit, PlanVisit];
    const first = place(plan, may, "2026-05-12");
    expect(first.refusal).toBeUndefined();
    const second = place(first.plan, august, "2026-08-20");
    expect(second.refusal).toBeUndefined();
    expect(eventsOf(second.plan, may.id!).filter((event) => event.kind === "NURSE_VISIT")).toMatchObject([
      { date: "2026-05-12", quantity: 1, billable: true, evaluation: true },
    ]);
    expect(eventsOf(second.plan, august.id!).some((event) => event.date === "2026-08-20")).toBe(true);
  });

  it("a date outside the month is refused with the month named, and nothing changes", () => {
    const plan = planF();
    const refused = place(plan, plan.visits[0]!, "2026-06-01");
    expect(refused.plan).toBe(plan);
    expect(refused.refusal).toBe(
      "Not placed. Jun 1, 2026 is outside May 2026, the month this is authorized for. Pick a date in that month.",
    );
  });

  it("a second visit in a one-visit month is refused: Fusion's count controls", () => {
    const plan = planF();
    const one = place(plan, plan.visits[0]!, "2026-05-12").plan;
    const refused = place(one, plan.visits[0]!, "2026-05-19");
    expect(refused.plan).toBe(one);
    expect(refused.refusal).toBe(
      "Not placed. The care plan authorizes 1 visit in May 2026, and this would go over. Remove a date first, or enter less.",
    );
  });

  it("moving a placed visit keeps one event, and its reminder moves with it", () => {
    const plan = planF();
    const may = plan.visits[0]!;
    const one = place(plan, may, "2026-05-12").plan;
    const id = eventsOf(one, may.id!).find((event) => event.kind === "NURSE_VISIT")!.id;
    const moved = place(one, may, "2026-05-28", id).plan;
    expect(eventsOf(moved, may.id!).map((event) => [event.kind, event.date])).toEqual([
      ["NURSE_VISIT", "2026-05-28"],
      ["REMINDER", "2026-06-15"],
    ]);
  });

  it("two regular nurse visits on one date are refused; an evaluation at a regular visit is one visit", () => {
    const base = planF();
    const regular: PlanVisit = {
      id: "visit-regular", label: "RN", serviceCode: "T1001", name: "Authorized Nurse Visit", provider: null,
      start: "2026-05-01", end: "2026-05-31", units: 4, pa: null,
    };
    const plan: CarePlan = { ...base, visits: [...base.visits, regular] };
    const one = place(plan, regular, "2026-05-12").plan;
    const twice = place(one, regular, "2026-05-12");
    expect(twice.plan).toBe(one);
    expect(twice.refusal).toBe(
      "Not placed. May 12, 2026 already has a nurse visit, and a participant can have one a day. Pick another date.",
    );
    // The evaluation on the same date is accepted and shown as the same visit.
    const both = place(one, plan.visits[0]!, "2026-05-12");
    expect(both.refusal).toBeUndefined();
    const evaluation = eventsOf(both.plan, plan.visits[0]!.id!).find((event) => event.kind === "NURSE_VISIT")!;
    expect(sharesVisit(both.plan, evaluation)).toBe(true);
    expect(sharesVisit(one, eventsOf(one, regular.id!)[0]!)).toBe(false);
  });
});

describe("the evaluation upload reminder", () => {
  it("lands on the 15th of the next month, is not billable and is never counted as a visit", () => {
    const plan = planF();
    const august = plan.visits[1]!;
    const placed = place(plan, august, "2026-08-31").plan;
    const reminder = eventsOf(placed, august.id!).find((event) => event.kind === "REMINDER")!;
    expect(reminder).toMatchObject({ date: "2026-09-15", billable: false, quantity: 0, note: UPLOAD_REMINDER_NOTE });
    expect(UPLOAD_REMINDER_NOTE).toBe("Upload the evaluation (HCBS 08-26-01)");
    // The month's one visit is still the only visit: the reminder used none of the count.
    expect(place(placed, august, "2026-08-10").refusal).toMatch(/authorizes 1 visit in August 2026/);
    expect(planEvents(placed).filter((event) => event.kind === "NURSE_VISIT")).toHaveLength(1);
  });

  it("goes when its visit is removed", () => {
    const plan = planF();
    const may = plan.visits[0]!;
    const placed = place(plan, may, "2026-05-12").plan;
    const id = eventsOf(placed, may.id!).find((event) => event.kind === "NURSE_VISIT")!.id;
    expect(planEvents(dropEvent(placed, id))).toEqual([]);
  });

  it("a December evaluation's reminder is January 15 of the next year", () => {
    const base = planF();
    const december: PlanVisit = { ...base.visits[0]!, id: "visit-dec", start: "2026-12-01", end: "2026-12-31" };
    const placed = place({ ...base, visits: [december] }, december, "2026-12-30").plan;
    expect(eventsOf(placed, "visit-dec").map((event) => event.date)).toEqual(["2026-12-30", "2027-01-15"]);
  });
});

describe("RN-04: a passed month with no date placed (NUR-02)", () => {
  it("is raised for a past unplaced month and not for a placed one", () => {
    const plan = planF();
    expect(planEventResults(plan, "2026-04")).toEqual([]);
    expect(planEventResults(plan, "2026-06").map((result) => [result.ruleId, result.severity, result.refs.month])).toEqual([
      ["NUR-02", "WARN", "2026-05"],
    ]);
    const placed = place(plan, plan.visits[0]!, "2026-05-12").plan;
    expect(planEventResults(placed, "2026-06")).toEqual([]);
    expect(planEventResults(placed, "2026-09").map((result) => result.refs.month)).toEqual(["2026-08"]);
  });
});

describe("storage: additive, and without a name", () => {
  it("a plan with events round-trips", () => {
    const plan = planF();
    const placed = place(plan, plan.visits[0]!, "2026-05-12").plan;
    savePlan(placed);
    const loaded = loadPlan()!;
    expect(loaded.events).toEqual(placed.events);
    expect(loaded.visits.map((visit) => visit.id)).toEqual(placed.visits.map((visit) => visit.id));
    expect(sessionStorage.getItem(PLAN_KEY)).not.toMatch(/SAMPLE PARTICIPANT|10000006/);
  });

  it("a plan saved before Coverage Phase 3 (no events, no visit ids) still opens, and gains ids", () => {
    const plan = planF();
    const old = {
      ...stored(plan),
      visits: plan.visits.map(({ id: _id, ...rest }) => rest),
      others: plan.others?.map(({ id: _id, ...rest }) => rest),
    };
    sessionStorage.setItem(PLAN_KEY, JSON.stringify(old));
    const loaded = loadPlan()!;
    expect(loaded.services).toHaveLength(plan.services.length);
    expect(loaded.events).toBeUndefined();
    expect(loaded.visits.every((visit) => typeof visit.id === "string" && visit.id.length > 0)).toBe(true);
  });

  it("a malformed event drops the saved plan rather than opening it wrong", () => {
    const plan = planF();
    const placed = place(plan, plan.visits[0]!, "2026-05-12").plan;
    const bad = { ...stored(placed), events: [{ ...placed.events![0]!, billable: false }] };
    sessionStorage.setItem(PLAN_KEY, JSON.stringify(bad));
    expect(loadPlan()).toBeNull();
  });

  it("an event whose authorization is gone is dropped on load", () => {
    const plan = planF();
    const placed = place(plan, plan.visits[0]!, "2026-05-12").plan;
    sessionStorage.setItem(PLAN_KEY, JSON.stringify({ ...stored(placed), visits: [placed.visits[1]!] }));
    expect(loadPlan()!.events).toEqual([]);
  });
});
