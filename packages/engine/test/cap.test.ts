import { describe, expect, it } from "vitest";
import { ruleCAP01CombinedCostCap, type ServiceAuthorization } from "../src/index.js";

// CP4-8: the combined Agency PC + CDS 60% cost maximum (Manual 4.20) as one plan-level flag.
function auth(id: string, program: ServiceAuthorization["program"], serviceCode: ServiceAuthorization["serviceCode"], start = "2026-11-01", end = "2027-04-30"): ServiceAuthorization {
  return { id, participantId: "P-TEST-01", program, serviceCode, start, end, state: "active", suspensions: [], revision: 1, tasks: [] };
}

describe("CAP-01: combined State Plan personal care and CDS cost maximum", () => {
  it("Agency Basic PC and CDS on the same dates → REVIEW naming both, never BLOCK", () => {
    const results = ruleCAP01CombinedCostCap([auth("pc-1", "AGENCY_PC", "T1019"), auth("cds-1", "CDS", "T1019U2"), auth("hm-1", "HOMEMAKER", "S5130")]);
    expect(results.map((r) => [r.severity, r.refs.serviceAuthId])).toEqual([["REVIEW", "pc-1"], ["REVIEW", "cds-1"]]);
    expect(new Set(results.map((r) => r.message)).size).toBe(1);
  });

  it("only one of the two, or the two on dates that don't overlap → nothing", () => {
    expect(ruleCAP01CombinedCostCap([auth("pc-1", "AGENCY_PC", "T1019")])).toEqual([]);
    expect(ruleCAP01CombinedCostCap([auth("cds-1", "CDS", "T1019U2")])).toEqual([]);
    expect(ruleCAP01CombinedCostCap([])).toEqual([]);
    expect(ruleCAP01CombinedCostCap([auth("pc-1", "AGENCY_PC", "T1019", "2026-01-01", "2026-10-31"), auth("cds-1", "CDS", "T1019U2")])).toEqual([]);
  });

  it("Advanced PC with CDS is not this flag (APC may take the plan past 60%)", () => {
    expect(ruleCAP01CombinedCostCap([auth("apc-1", "APC", "T1019TF"), auth("cds-1", "CDS", "T1019U2")])).toEqual([]);
  });
});
