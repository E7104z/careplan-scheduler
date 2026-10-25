import { describe, expect, it } from "vitest";
import { MO_2026_07, findTaskByName, serviceByCode } from "../src/index.js";

describe("MO 2026-07 rule pack", () => {
  it("has the AUTH-02 days-per-month factor table", () => {
    expect(MO_2026_07.daysPerMonthFactor).toEqual({ 1: 5, 2: 10, 3: 15, 4: 19, 5: 23, 6: 27, 7: 31 });
  });

  it("has the monthly ceilings", () => {
    expect(serviceByCode(MO_2026_07, "T1019U2")?.monthlyCeiling).toBe(641);
    expect(serviceByCode(MO_2026_07, "T1019")?.monthlyCeiling).toBe(412);
    expect(serviceByCode(MO_2026_07, "T1019U6")?.monthlyCeiling).toBe(868);
    const basic = serviceByCode(MO_2026_07, "S5150");
    const advanced = serviceByCode(MO_2026_07, "S5150TF");
    expect(basic?.combinedCeilingGroup).toBe("RESPITE");
    expect(basic?.monthlyCeiling).toBe(868);
    expect(advanced?.combinedCeilingGroup).toBe("RESPITE");
    expect(advanced?.monthlyCeiling).toBe(868);
  });

  it("resolves both toileting alias spellings to one taskCode", () => {
    const a = findTaskByName(MO_2026_07, "Asstance with Toileting");
    const b = findTaskByName(MO_2026_07, "Asst. with Toileting");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a?.taskCode).toBe(b?.taskCode);
    expect(a?.taskCode).toBe("ASSISTANCE_WITH_TOILETING");
  });

  it("implements the CON-02 overlap matrix (order-insensitive)", () => {
    expect(MO_2026_07.overlap("CDS", "NURSE")).toBe("allowed");
    expect(MO_2026_07.overlap("NURSE", "CDS")).toBe("allowed");
    expect(MO_2026_07.overlap("RESPITE", "CDS")).toBe("prohibited");
    expect(MO_2026_07.overlap("CDS", "RESPITE")).toBe("prohibited");
    expect(MO_2026_07.overlap("AGENCY_PC", "HOMEMAKER")).toBe("unknown");
    expect(MO_2026_07.overlap("CDS", "CDS")).toBe("prohibited");
  });

  it("offers agency personal care the household tasks Fusion lists under PC - Agency", () => {
    // Fusion's care plan report lists these as "Med Rel HC Tasks: <task>" (IMPORT-SPEC 1.3).
    const household = ["Clean Bath", "Clean Kitchen", "Clean Living Area", "Laundry", "Make Bed/Change Linens", "Shopping/Errands", "Trash"];
    for (const name of household) {
      const def = findTaskByName(MO_2026_07, name);
      expect(def?.programs, name).toContain("AGENCY_PC");
      expect(def?.programs, name).toContain("HOMEMAKER");
    }
    for (const name of ["Iron/Mend", "Meals/Dishes", "Wash Windows/Blinds", "Essential Correspondence"]) {
      expect(findTaskByName(MO_2026_07, name)?.programs, name).not.toContain("AGENCY_PC");
    }
  });
});
