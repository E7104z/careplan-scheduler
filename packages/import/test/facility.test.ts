import { describe, expect, it } from "vitest";
import { parseFusionText } from "../src/index.js";
import { PACK, fixtureText, tupleOf } from "./helpers.js";

// CP2-5 follow-up: RCF/ALF personal care (T1019U3, T1019U3 TF) is now scheduled, so a care plan
// report's RCF/ALF block reaches the week instead of being kept. Fixture G's RCF/ALF nurse block
// (T1001U3) is reused with a facility personal care code and Policy 3.20 tasks; the label is
// invented, so the service is found by its code through Appendix 1. No real report in the fixtures
// shows the advanced code; Appendix 1 prints it "T1019U3 TF", so both spellings are read.
function withFacilityBlock(code: string): string {
  return fixtureText("G-care-plan-report-kept.txt")
    .replace(/^RN\t/m, "PC - RCF\t")
    .replace(/\tT1001U3\t/g, `\t${code}\t`)
    .replace("Nurse Visit\t1\tN/A", "Bathing\t30\t7\nMed Rel HC Tasks: Laundry\t15\t2\nEssential Correspondence\t15\t1");
}

describe("RCF/ALF personal care from a care plan report", () => {
  const CODES = [["T1019U3", "T1019U3"], ["T1019U3 TF", "T1019U3TF"], ["T1019U3TF", "T1019U3TF"]] as const;
  for (const [code, serviceCode] of CODES) {
    it(`schedules ${code} as ${serviceCode} with its tasks, asking nothing`, () => {
      const result = parseFusionText(withFacilityBlock(code), PACK);
      const facility = result.services.find((service) => service.label === "PC - RCF");
      expect(facility?.serviceCode).toBe(serviceCode);
      expect(tupleOf(facility!.tasks)).toEqual([["Bathing", 30, 7], ["Laundry", 15, 2], ["Essential Correspondence", 15, 1]]);
      expect(result.others.map((other) => other.label)).not.toContain("PC - RCF");
      expect(result.issues.filter((issue) => issue.label === "PC - RCF")).toEqual([]);
    });
  }

  it("never collapses the facility code into the home code (INV-04)", () => {
    const codes = CODES.map(
      ([code]) => parseFusionText(withFacilityBlock(code), PACK).services.find((s) => s.label === "PC - RCF")?.serviceCode,
    );
    expect(codes).not.toContain("T1019");
    expect(codes).not.toContain("T1019TF");
  });

  it("still keeps the RCF/ALF nurse visit (T1001U3), which isn't placed in the week", () => {
    const result = parseFusionText(fixtureText("G-care-plan-report-kept.txt"), PACK);
    expect(result.others.find((other) => other.code === "T1001U3")?.registryId).toBe("MO_RN_RCF");
  });
});
