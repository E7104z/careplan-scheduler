import { describe, expect, it } from "vitest";
import { MO_2026_07, findAppendix1, findTaskByName, serviceByCode } from "../src/index.js";

// The 3a's 11 household rows (B33–B63 / the MED REL HC TASKS set): never a facility task.
const HOUSEHOLD = [
  "Clean Bath", "Clean Kitchen", "Clean Living Area", "Essential Correspondence", "Iron/Mend",
  "Laundry", "Make Bed/Change Linens", "Meals/Dishes", "Shopping/Errands", "Trash", "Wash Windows/Blinds",
];

describe("CP2-5 RCF/ALF variants as facility services", () => {
  it("schedules Basic RCF/ALF PC as its six personal-care tasks, never a household task", () => {
    const facility = serviceByCode(MO_2026_07, "T1019U3");
    if (!facility) throw new Error("T1019U3 must resolve");
    expect(facility.code).toBe("T1019U3");
    expect(facility.program).toBe("RCF_PC");

    const taskCodes = MO_2026_07.tasks
      .filter((task) => task.programs.includes(facility.program) && !task.isTransport)
      .map((task) => task.taskCode);
    expect(taskCodes).toEqual([
      "BATHING",
      "DRESSING_GROOMING",
      "DIETARY",
      "MOBILITY_TRANSFER_POSITION",
      "SELF_ADMIN_OF_MEDICATIONS",
      "TOILETING",
    ]);
    for (const name of HOUSEHOLD) {
      const task = findTaskByName(MO_2026_07, name);
      expect(task, `${name} resolves`).toBeDefined();
      expect(task?.programs, name).not.toContain("RCF_PC");
    }
  });

  it("schedules Advanced RCF/ALF APC as the advanced task set, no household either", () => {
    const facility = serviceByCode(MO_2026_07, "T1019U3TF");
    if (!facility) throw new Error("T1019U3TF must resolve");
    expect(facility.code).toBe("T1019U3TF");
    expect(facility.program).toBe("RCF_APC");

    const rcfApc = MO_2026_07.tasks.filter((task) => task.programs.includes("RCF_APC")).map((task) => task.taskCode);
    const homeApc = MO_2026_07.tasks.filter((task) => task.programs.includes("APC")).map((task) => task.taskCode);
    expect(rcfApc).toEqual(homeApc);
    for (const name of HOUSEHOLD) {
      const task = findTaskByName(MO_2026_07, name);
      expect(task, `${name} resolves`).toBeDefined();
      expect(task?.programs, name).not.toContain("RCF_APC");
    }
  });

  it("keeps the RCF/ALF codes distinct from the home codes (INV-04)", () => {
    expect(serviceByCode(MO_2026_07, "T1019U3")?.code).toBe("T1019U3");
    expect(serviceByCode(MO_2026_07, "T1019U3")?.program).toBe("RCF_PC");
    expect(serviceByCode(MO_2026_07, "T1019U3")?.monthlyCeiling).toBe(438);
    expect(serviceByCode(MO_2026_07, "T1019")?.code).toBe("T1019");
    expect(serviceByCode(MO_2026_07, "T1019")?.program).toBe("AGENCY_PC");
    expect(serviceByCode(MO_2026_07, "T1019")?.monthlyCeiling).toBe(412);
    expect(serviceByCode(MO_2026_07, "T1019U3TF")?.program).toBe("RCF_APC");
    expect(serviceByCode(MO_2026_07, "T1019TF")?.program).toBe("APC");

    expect(findAppendix1("T1019U3")?.id).toBe("MO_PC_RCF");
    expect(findAppendix1("T1019")?.id).toBe("MO_PC_AGENCY");
    expect(findAppendix1("T1019U3 TF")?.id).toBe("MO_APC_RCF");
    expect(findAppendix1("T1019TF")?.id).toBe("MO_APC_AGENCY");
    expect(findAppendix1("T1019U3")?.engineCode).toBe("T1019U3");
    expect(findAppendix1("T1019U3 TF")?.engineCode).toBe("T1019U3TF");
  });
});
