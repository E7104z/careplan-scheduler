import { describe, expect, it } from "vitest";
import {
  ruleAUTH05DerivedMonthUnits,
  ruleCON07AgencyAide,
  ruleCON17QualificationData,
  type Caregiver,
  type ServiceAuthorization,
  type Visit,
} from "../src/index.js";

// CP2-5 follow-up: the eligibility and proration rules reach the RCF/ALF programs, never a silent
// pass. Policy 3.05 and 3.10 say PC and APC are also provided in an RCF/ALF; Policy 3.20 (rev. Mar
// 2026), the facility policy, doesn't restate 3.05's aide restrictions, so CON-07 is REVIEW there.

function auth(program: ServiceAuthorization["program"], serviceCode: ServiceAuthorization["serviceCode"]): ServiceAuthorization {
  return {
    id: `a-${serviceCode}`, participantId: "P-TEST-01", program, serviceCode,
    start: "2026-01-01", end: "2026-12-31", state: "active", suspensions: [], revision: 1, tasks: [],
  };
}

function visit(serviceCode: ServiceAuthorization["serviceCode"]): Visit {
  return {
    id: `v-${serviceCode}`, participantId: "P-TEST-01", caregiverId: "C-1", serviceCode,
    start: "2026-10-05T09:00", end: "2026-10-05T10:00", taskIds: [],
  };
}

const GRANDCHILD: Caregiver = { id: "C-1", relationships: { "P-TEST-01": "grandchild" }, agencyEmployee: true };
const NON_EMPLOYEE: Caregiver = { id: "C-1", relationships: { "P-TEST-01": "none" }, agencyEmployee: false };
const UNKNOWN: Caregiver = { id: "C-1", relationships: {}, agencyEmployee: true };

describe("CON-07 on RCF/ALF personal care (Policy 3.05, 3.20)", () => {
  for (const [program, code] of [["RCF_PC", "T1019U3"], ["RCF_APC", "T1019U3TF"]] as const) {
    it(`${program}: an immediate-family aide is REVIEW, citing 3.05 and 3.20`, () => {
      const results = ruleCON07AgencyAide([auth(program, code)], [GRANDCHILD], [visit(code)]);
      expect(results.map((r) => [r.ruleId, r.severity])).toEqual([["CON-07", "REVIEW"]]);
      expect(results[0]!.message).toMatch(/grandchild/);
      expect(results[0]!.message).toMatch(/Policy 3\.20/);
    });

    it(`${program}: an aide who isn't the provider's employee is REVIEW`, () => {
      const results = ruleCON07AgencyAide([auth(program, code)], [NON_EMPLOYEE], [visit(code)]);
      expect(results.map((r) => [r.ruleId, r.severity])).toEqual([["CON-07", "REVIEW"]]);
      expect(results[0]!.message).toMatch(/not an employee/);
    });

    it(`${program}: missing relationship data is CON-17 REVIEW`, () => {
      const results = ruleCON17QualificationData([auth(program, code)], [UNKNOWN], [visit(code)]);
      expect(results).toContainEqual(expect.objectContaining({ ruleId: "CON-17", severity: "REVIEW" }));
    });
  }

  it("the home service keeps its BLOCK (TC-13 unchanged)", () => {
    const results = ruleCON07AgencyAide([auth("AGENCY_PC", "T1019")], [GRANDCHILD], [visit("T1019")]);
    expect(results.map((r) => r.severity)).toEqual(["BLOCK"]);
  });
});

describe("AUTH-05 on RCF/ALF personal care (INFO 05-25-03)", () => {
  it("prorates RCF/ALF month units like the home services", () => {
    const results = ruleAUTH05DerivedMonthUnits([auth("RCF_PC", "T1019U3"), auth("RCF_APC", "T1019U3TF")]);
    expect(results.map((r) => r.message)).toEqual([
      "Derived month units use F-3 (short-month proration for 7-day tasks)",
      "Derived month units use F-3 (short-month proration for 7-day tasks)",
    ]);
  });

  it("still says a non-task service isn't prorated", () => {
    expect(ruleAUTH05DerivedMonthUnits([auth("RESPITE", "S5150")])[0]!.message).toBe(
      "Month units are not prorated for this service",
    );
  });
});
