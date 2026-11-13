import { describe, expect, it } from "vitest";
import {
  ruleCON07AgencyAide,
  ruleCON17QualificationData,
  type Caregiver,
  type ServiceAuthorization,
  type Visit,
} from "../src/index.js";

// CP4-2: a qualification that wasn't entered is asked for (CON-17, REVIEW); it is never a block.
const AUTH: ServiceAuthorization = {
  id: "auth-pc", participantId: "P-TEST-01", program: "AGENCY_PC", serviceCode: "T1019",
  start: "2026-11-01", end: "2027-04-30", state: "active", suspensions: [], revision: 1, tasks: [],
};
const VISIT: Visit = {
  id: "v1", participantId: "P-TEST-01", caregiverId: "C-1", serviceCode: "T1019", start: "2026-11-02T09:00", end: "2026-11-02T10:00", taskIds: [],
};

function caregiver(fields: Partial<Caregiver>): Caregiver {
  return { id: "C-1", relationships: { "P-TEST-01": "none" }, ...fields };
}

describe("agency employment: stated, or asked for", () => {
  it("a stated 'not an employee' is a Must fix (CON-07)", () => {
    expect(ruleCON07AgencyAide([AUTH], [caregiver({ agencyEmployee: false })], [VISIT]).map((result) => [result.ruleId, result.severity, result.message])).toEqual([
      ["CON-07", "BLOCK", "AGENCY_PC aide is not an agency employee"],
    ]);
  });

  it("an employee raises nothing", () => {
    expect(ruleCON07AgencyAide([AUTH], [caregiver({ agencyEmployee: true })], [VISIT])).toEqual([]);
    expect(ruleCON17QualificationData([AUTH], [caregiver({ agencyEmployee: true })], [VISIT])).toEqual([]);
  });

  it("an unanswered question is not a block: CON-07 says nothing and CON-17 asks for it", () => {
    expect(ruleCON07AgencyAide([AUTH], [caregiver({})], [VISIT])).toEqual([]);
    expect(ruleCON17QualificationData([AUTH], [caregiver({})], [VISIT])).toEqual([
      { ruleId: "CON-17", severity: "REVIEW", message: "Missing employment data needed by CON-07", refs: { serviceAuthId: "auth-pc" } },
    ]);
  });

  it("with neither relationship nor employment entered, both are asked for", () => {
    const unknown: Caregiver = { id: "C-1", relationships: {} };
    expect(ruleCON07AgencyAide([AUTH], [unknown], [VISIT])).toEqual([]);
    expect(ruleCON17QualificationData([AUTH], [unknown], [VISIT]).map((result) => result.message)).toEqual([
      "Missing relationship data needed by CON-07",
      "Missing employment data needed by CON-07",
    ]);
  });
});
