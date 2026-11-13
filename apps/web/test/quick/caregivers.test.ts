import { beforeEach, describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import {
  addCaregiver,
  assignCaregiver,
  assignedTo,
  caregiverLabel,
  engineCaregivers,
  planCaregivers,
  removeCaregiver,
  updateCaregiver,
} from "../../src/features/quick-schedule/caregivers";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { loadPlan, PLAN_KEY, savePlan } from "../../src/features/quick-schedule/persistence";
import { planCheckLines } from "../../src/features/quick-schedule/PlanChecks";
import type { CarePlan, PlanCaregiver } from "../../src/features/quick-schedule/types";
import { buildVisits, careWeekdays, guardedPlanChange, planVisitResults, setStartTime } from "../../src/features/quick-schedule/visits";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-2 on fixture F (PC - Agency, PC - CDS, HC). Names are made up ("Caregiver A").
const PACK = MO_2026_07;

function planF(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), PACK, new Date("2026-04-15T12:00:00-05:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture F should build");
  return outcome.plan;
}

const modelsOf = (plan: CarePlan) => plan.services.map((state) => buildQuickModel(state, PACK));
const indexOf = (plan: CarePlan, code: string) => plan.services.findIndex((state) => state.serviceCode === code);

/** A plan with one caregiver, with what was entered about them. */
function withCaregiver(plan: CarePlan, entered: Partial<Omit<PlanCaregiver, "id">> = {}): { plan: CarePlan; id: string } {
  const added = addCaregiver(plan);
  const id = planCaregivers(added).at(-1)!.id;
  return { plan: updateCaregiver(added, id, entered), id };
}

function results(plan: CarePlan) {
  return planVisitResults(plan, modelsOf(plan), PACK);
}

beforeEach(() => sessionStorage.clear());

describe("a caregiver's name is kept in memory only", () => {
  it("the name never reaches storage; what was entered and who is assigned do", () => {
    const { plan: named, id } = withCaregiver(planF(), {
      name: "Caregiver A", relationship: "none", agencyEmployee: true, nurseLicense: false, fcsrRegistered: null,
    });
    const plan = assignCaregiver(named, indexOf(named, "T1019"), id, true);
    savePlan(plan);

    const stored = sessionStorage.getItem(PLAN_KEY)!;
    expect(stored).not.toContain("Caregiver A");
    // (Tasks and visits have a "name" of their own; the caregiver entry has none.)
    expect(Object.keys(JSON.parse(stored).caregivers[0])).not.toContain("name");
    expect(stored).not.toMatch(/SAMPLE PARTICIPANT|10000006/);
    expect(JSON.parse(stored).caregivers).toEqual([
      { id, relationship: "none", agencyEmployee: true, nurseLicense: false, fcsrRegistered: null },
    ]);

    const loaded = loadPlan()!;
    expect(planCaregivers(loaded)).toEqual([{ id, relationship: "none", agencyEmployee: true, nurseLicense: false, fcsrRegistered: null }]);
    expect(assignedTo(loaded, indexOf(loaded, "T1019"))).toEqual([id]);
    // After a reload the caregiver is shown by number, not by a name.
    expect(caregiverLabel(plan, id)).toBe("Caregiver A");
    expect(caregiverLabel(loaded, id)).toBe("Caregiver 1");
    expect(caregiverLabel(plan, id, false)).toBe("Caregiver 1");
  });

  it("a stored caregiver that carries a name is refused: the saved plan is dropped", () => {
    const { plan } = withCaregiver(planF(), { relationship: "none" });
    savePlan(plan);
    const tampered = JSON.parse(sessionStorage.getItem(PLAN_KEY)!);
    tampered.caregivers[0].name = "Caregiver A";
    sessionStorage.setItem(PLAN_KEY, JSON.stringify(tampered));
    expect(loadPlan()).toBeNull();
  });

  it("a plan saved before caregivers still opens", () => {
    savePlan(planF());
    const loaded = loadPlan()!;
    expect(loaded.caregivers).toBeUndefined();
    expect(planCaregivers(loaded)).toEqual([]);
  });
});

describe("qualifications are entered, never guessed (CON-17)", () => {
  it("a new caregiver has nothing entered, and the engine is told nothing about them", () => {
    const { plan, id } = withCaregiver(planF(), { name: "Nurse Spouse" });
    expect(planCaregivers(plan)[0]).toEqual({ id, name: "Nurse Spouse", relationship: null, agencyEmployee: null, nurseLicense: null, fcsrRegistered: null });
    // A name that sounds like a role or a relationship changes nothing.
    expect(engineCaregivers(plan)).toEqual([{ id, relationships: {} }]);
  });

  it("an unassigned caregiver raises nothing: there is no service to check them against", () => {
    const base = planF();
    const { plan } = withCaregiver(base);
    expect(results(plan)).toEqual(results(base));
  });

  it("assigned with nothing entered: missing data is REVIEW, never a pass and never a block", () => {
    const { plan: added, id } = withCaregiver(planF());
    const agency = indexOf(added, "T1019");
    const change = guardedPlanChange(added, assignCaregiver(added, agency, id, true), PACK, modelsOf(added));
    expect(change.refusal).toBeUndefined();
    const found = results(change.plan).filter((result) => result.ruleId === "CON-17" || result.ruleId === "CON-07");
    expect(found.map((result) => [result.ruleId, result.severity, result.message])).toEqual([
      ["CON-17", "REVIEW", "Missing relationship data needed by CON-07"],
      ["CON-17", "REVIEW", "Missing employment data needed by CON-07"],
    ]);
    expect(planCheckLines(found, change.plan, modelsOf(change.plan)).map((line) => [line.severity, line.text, line.services])).toEqual([
      ["REVIEW", "Caregiver details are missing", ["PC - Agency"]],
    ]);
  });

  it("once the relationship and employment are entered, the review is gone", () => {
    const { plan: added, id } = withCaregiver(planF(), { relationship: "none", agencyEmployee: true });
    const plan = assignCaregiver(added, indexOf(added, "T1019"), id, true);
    expect(results(plan).filter((result) => result.ruleId === "CON-17" || result.ruleId === "CON-07")).toEqual([]);
  });

  it("a CDS attendant with no relationship entered is REVIEW (CON-17)", () => {
    const { plan: added, id } = withCaregiver(planF());
    const plan = assignCaregiver(added, indexOf(added, "T1019U2"), id, true);
    expect(results(plan).filter((result) => result.ruleId === "CON-17").map((result) => result.message)).toEqual([
      "Missing relationship data needed by CON-06",
    ]);
  });
});

describe("the guard on who can serve this participant", () => {
  it("a spouse can't be assigned as the paid CDS attendant: refused with the rule's words", () => {
    const { plan: added, id } = withCaregiver(planF(), { relationship: "spouse" });
    const refused = guardedPlanChange(added, assignCaregiver(added, indexOf(added, "T1019U2"), id, true), PACK, modelsOf(added));
    expect(refused.plan).toBe(added);
    expect(refused.refusal).toBe(
      "Not changed. This attendant can't be paid for this participant. A spouse or legal guardian can't be the CDS attendant.",
    );
  });

  it("entering 'spouse' for a caregiver already on CDS is refused too", () => {
    const { plan: added, id } = withCaregiver(planF(), { relationship: "none" });
    const assigned = assignCaregiver(added, indexOf(added, "T1019U2"), id, true);
    const refused = guardedPlanChange(assigned, updateCaregiver(assigned, id, { relationship: "spouse" }), PACK, modelsOf(assigned));
    expect(refused.plan).toBe(assigned);
    expect(refused.refusal).toMatch(/^Not changed\. This attendant can't be paid/);
  });

  it("a close family member, or someone who isn't an employee, can't be the agency aide", () => {
    const base = planF();
    const agency = indexOf(base, "T1019");
    for (const entered of [{ relationship: "child" as const, agencyEmployee: true }, { relationship: "none" as const, agencyEmployee: false }]) {
      const { plan: added, id } = withCaregiver(base, entered);
      const refused = guardedPlanChange(added, assignCaregiver(added, agency, id, true), PACK, modelsOf(added));
      expect(refused.plan).toBe(added);
      expect(refused.refusal).toBe(
        "Not changed. This aide can't serve this participant. A close family member or a non-employee can't provide this agency service.",
      );
    }
  });

  it("the same person may be the CDS attendant when they aren't a spouse or guardian", () => {
    const { plan: added, id } = withCaregiver(planF(), { relationship: "child" });
    expect(guardedPlanChange(added, assignCaregiver(added, indexOf(added, "T1019U2"), id, true), PACK, modelsOf(added)).refusal).toBeUndefined();
  });
});

describe("assignment", () => {
  it("each visit takes the service's first assigned caregiver", () => {
    let { plan, id } = withCaregiver(planF(), { relationship: "none" });
    const cds = indexOf(plan, "T1019U2");
    plan = assignCaregiver(plan, cds, id, true);
    const day = careWeekdays(plan.services[cds]!, modelsOf(plan)[cds]!)[0]!;
    plan = setStartTime(plan, cds, day, "09:00", PACK, modelsOf(plan)).plan;
    const visits = buildVisits(plan, modelsOf(plan), PACK);
    expect(visits.length).toBeGreaterThan(0);
    expect(visits.every((visit) => visit.caregiverId === id)).toBe(true);
  });

  it("a service can have several caregivers, and removing one takes them off every service", () => {
    let plan = planF();
    const first = withCaregiver(plan, { relationship: "none", agencyEmployee: true });
    const second = withCaregiver(first.plan, { relationship: "none", agencyEmployee: true });
    plan = assignCaregiver(assignCaregiver(second.plan, 0, first.id, true), 0, second.id, true);
    plan = assignCaregiver(plan, 2, first.id, true);
    expect(assignedTo(plan, 0)).toEqual([first.id, second.id]);
    const removed = removeCaregiver(plan, first.id);
    expect(assignedTo(removed, 0)).toEqual([second.id]);
    expect(assignedTo(removed, 2)).toEqual([]);
    expect(caregiverLabel(removed, second.id)).toBe("Caregiver 1");
  });

  it("assigning twice is once; an unknown caregiver or service changes nothing", () => {
    const { plan, id } = withCaregiver(planF());
    const once = assignCaregiver(assignCaregiver(plan, 0, id, true), 0, id, true);
    expect(assignedTo(once, 0)).toEqual([id]);
    expect(assignCaregiver(plan, 0, "nobody", true)).toBe(plan);
    expect(assignCaregiver(plan, 99, id, true)).toBe(plan);
  });
});
