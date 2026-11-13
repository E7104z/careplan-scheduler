import { beforeEach, describe, expect, it } from "vitest";
import { MO_2026_07, type Weekday } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { addCaregiver, assignCaregiver, planCaregivers, updateCaregiver } from "../../src/features/quick-schedule/caregivers";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { loadPlan, PLAN_KEY, savePlan } from "../../src/features/quick-schedule/persistence";
import type { CarePlan } from "../../src/features/quick-schedule/types";
import { careWeekdays, guardedPlanChange, planVisitResults, setStartTime } from "../../src/features/quick-schedule/visits";
import { addWaiver } from "../../src/features/quick-schedule/waivers";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-3 on fixture F (PC - Agency T1019, PC - CDS T1019U2, HC S5130), built Apr 15, 2026.
const PACK = MO_2026_07;

function planF(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), PACK, new Date("2026-04-15T12:00:00-05:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture F should build");
  return outcome.plan;
}

const modelsOf = (plan: CarePlan) => plan.services.map((state) => buildQuickModel(state, PACK));
const indexOf = (plan: CarePlan, code: string) => plan.services.findIndex((state) => state.serviceCode === code);

/** Set a start time on every care day of a service. */
function timed(plan: CarePlan, service: number, time: string): CarePlan {
  return careWeekdays(plan.services[service]!, modelsOf(plan)[service]!).reduce((current, weekday) => {
    const change = setStartTime(current, service, weekday, time, PACK, modelsOf(current));
    expect(change.refusal, `${service} ${weekday}`).toBeUndefined();
    return change.plan;
  }, plan);
}

/** A weekday two services both have care on. */
function commonDay(plan: CarePlan, a: number, b: number): Weekday {
  const aDays = new Set(careWeekdays(plan.services[a]!, modelsOf(plan)[a]!));
  return careWeekdays(plan.services[b]!, modelsOf(plan)[b]!).find((day) => aDays.has(day))!;
}

beforeEach(() => sessionStorage.clear());

describe("JOIN-04: the overlap matrix runs on the schedule's visits", () => {
  it("an unknown pair (agency PC and homemaker) overlapping is REVIEW, never a pass or a block", () => {
    const plan = planF();
    const agency = indexOf(plan, "T1019");
    const hc = indexOf(plan, "S5130");
    const withTimes = timed(timed(plan, agency, "09:00"), hc, "09:00");
    const results = planVisitResults(withTimes, modelsOf(withTimes), PACK);
    expect(results.some((result) => result.ruleId === "CON-02" && result.severity === "REVIEW" && /Overlapping/.test(result.message))).toBe(true);
    expect(results.some((result) => result.ruleId === "CON-02" && result.severity === "BLOCK")).toBe(false);
  });
});

describe("STAFF-01: a caregiver can't be in two visits at once (CON-04)", () => {
  it("one caregiver on two services that overlap is refused, and the plan is unchanged", () => {
    let plan = planF();
    const agency = indexOf(plan, "T1019");
    const hc = indexOf(plan, "S5130");
    const added = addCaregiver(plan);
    const id = planCaregivers(added).at(-1)!.id;
    plan = updateCaregiver(added, id, { relationship: "none", agencyEmployee: true });
    plan = assignCaregiver(assignCaregiver(plan, agency, id, true), hc, id, true);
    const withAgency = timed(plan, agency, "09:00");
    const refused = setStartTime(withAgency, hc, commonDay(withAgency, agency, hc), "09:00", PACK, modelsOf(withAgency));
    expect(refused.plan).toBe(withAgency);
    expect(refused.refusal).toBe(
      "Not changed. A caregiver is booked in two places at once. Change one visit's time or caregiver.",
    );
  });

  it("two different caregivers on the same two services is not a double-booking", () => {
    let plan = planF();
    const agency = indexOf(plan, "T1019");
    const hc = indexOf(plan, "S5130");
    const first = addCaregiver(plan);
    const a = planCaregivers(first).at(-1)!.id;
    plan = updateCaregiver(first, a, { relationship: "none", agencyEmployee: true });
    const second = addCaregiver(plan);
    const b = planCaregivers(second).at(-1)!.id;
    plan = updateCaregiver(second, b, { relationship: "none", agencyEmployee: true });
    plan = assignCaregiver(plan, agency, a, true);
    plan = assignCaregiver(plan, hc, b, true);
    const withTimes = timed(timed(plan, agency, "09:00"), hc, "09:00");
    expect(planVisitResults(withTimes, modelsOf(withTimes), PACK).some((result) => result.ruleId === "CON-04")).toBe(false);
  });
});

describe("CON-16: waiver enrollments are entered, never inferred", () => {
  it("two overlapping enrollments are refused; the first is fine", () => {
    const plan = planF();
    const first = guardedPlanChange(plan, addWaiver(plan), PACK, modelsOf(plan));
    expect(first.refusal).toBeUndefined();
    const second = guardedPlanChange(first.plan, addWaiver(first.plan), PACK, modelsOf(first.plan));
    expect(second.plan).toBe(first.plan);
    expect(second.refusal).toBe(
      "Not changed. Two waiver enrollments overlap. A participant can't be in two waivers on the same dates.",
    );
  });

  it("a waiver service visit with no covering enrollment is asked for; entering one clears it", () => {
    const plan = planF();
    const hc = indexOf(plan, "S5130");
    const withTimes = timed(plan, hc, "09:00");
    const asked = planVisitResults(withTimes, modelsOf(withTimes), PACK);
    expect(asked.some((result) => result.ruleId === "CON-16" && result.severity === "REVIEW")).toBe(true);
    // An ADW enrollment spanning the plan covers the homemaker visits.
    const covered = addWaiver(withTimes);
    const cleared = planVisitResults(covered, modelsOf(covered), PACK);
    expect(cleared.some((result) => result.ruleId === "CON-16" && result.severity === "REVIEW")).toBe(false);
  });

  it("enrollments round-trip through storage with no name or DCN", () => {
    const plan = planF();
    const withWaiver = addWaiver(plan);
    savePlan(withWaiver);
    const stored = sessionStorage.getItem(PLAN_KEY)!;
    expect(stored).toContain('"waiver":"ADW"');
    expect(stored).not.toMatch(/SAMPLE PARTICIPANT|10000006/);
    expect(loadPlan()!.waivers).toEqual(withWaiver.waivers);
  });
});

