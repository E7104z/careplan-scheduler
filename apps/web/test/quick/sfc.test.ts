import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { addCaregiver, planCaregivers, setSfcCaregiver } from "../../src/features/quick-schedule/caregivers";
import { sfcCaregiverRoles, sfcResults, sfcwPeriod } from "../../src/features/quick-schedule/sfc";
import type { CarePlan, PlanOther } from "../../src/features/quick-schedule/types";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-4: SFCW exclusivity (Policy 3.60) on fixture F (PC - Agency, PC - CDS, HC; Feb 1 to Oct 31, 2026).
const PACK = MO_2026_07;

function planF(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), PACK, new Date("2026-04-15T12:00:00-05:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture F should build");
  return outcome.plan;
}

function sfcOther(start: string, end: string): PlanOther {
  return {
    id: "auth-sfcw", label: "SFC", code: "S5126HB", registryId: "MO_SFC",
    provider: null, pa: null, start, end,
    monthly: [{ start, end, units: 1 }], rows: ["S5126HB"],
    sfcCaregivers: { primary: null, backup: null },
  };
}

function withSfc(start = "2026-04-01", end = "2026-12-31"): CarePlan {
  const plan = planF();
  return { ...plan, others: [...(plan.others ?? []), sfcOther(start, end)] };
}

describe("SFC-01 on the plan: exclusivity (Policy 3.60)", () => {
  it("blocks each scheduled HCBS service whose period overlaps SFCW", () => {
    const plan = withSfc();
    const blocked = sfcResults(plan).filter((r) => r.ruleId === "SFC-01" && r.severity === "BLOCK");
    // PC - Agency, PC - CDS and HC all run Feb 1 to Oct 31, inside SFCW's Apr 1 to Dec 31.
    expect(blocked.length).toBe(plan.services.length);
    expect(blocked.every((r) => /PC - Agency|PC - CDS|HC/.test(r.message))).toBe(true);
  });

  it("permits an SFCW that starts the day after every service ends", () => {
    const plan = withSfc("2026-11-01", "2027-06-30");
    expect(sfcResults(plan).filter((r) => r.ruleId === "SFC-01").map((r) => r.severity)).toEqual([]);
  });

  it("reviews a kept code outside Appendix 1, and never guesses it", () => {
    const plan = withSfc();
    const unknown: PlanOther = {
      id: "auth-u", label: null, code: "H2015", registryId: null, provider: null, pa: null,
      start: "2026-05-01", end: "2026-05-31", monthly: [], rows: [],
    };
    const withUnknown = { ...plan, others: [...plan.others!, unknown] };
    const reviews = sfcResults(withUnknown).filter((r) => r.ruleId === "SFC-01" && r.refs.serviceAuthId === "auth-u");
    expect(reviews[0]!.severity).toBe("REVIEW");
  });

  it("exposes the SFCW period for the conflict messages", () => {
    expect(sfcwPeriod(withSfc())).toMatchObject({ id: "auth-sfcw", start: "2026-04-01", end: "2026-12-31" });
  });
});

describe("SFC-02 on the plan: one primary caregiver", () => {
  it("one primary with a substitute is no result; the engine blocks two primaries", () => {
    let plan = withSfc();
    plan = addCaregiver(addCaregiver(plan));
    const [primary, backup] = planCaregivers(plan).map((c) => c.id) as [string, string];
    plan = setSfcCaregiver(plan, "auth-sfcw", "primary", primary);
    plan = setSfcCaregiver(plan, "auth-sfcw", "backup", backup);
    expect(sfcCaregiverRoles(plan).map((r) => r.role)).toEqual(["primary", "backup"]);
    expect(sfcResults(plan).filter((r) => r.ruleId === "SFC-02")).toEqual([]);
  });
});
