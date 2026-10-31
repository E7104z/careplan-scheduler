import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { matchTask } from "../src/taskMatch.js";
import { mergeFusionText, parseFusionText } from "../src/index.js";
import { PACK, fixtureText, tupleOf } from "./helpers.js";

// IMP-T30..T33: fixture G is made up. It has the layout of fixture F (a real care plan report)
// with services Quick Schedule doesn't place: home delivered meals, adult day care, ILW financial
// management, an RCF/ALF nurse visit, and a code outside Appendix 1. Its labels other than
// "PC - CDS" are invented, so IMP-11 learns none of them: services are kept by code.
const G = "G-care-plan-report-kept.txt";

const MONTHS = ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"];

describe("IMP-T30 fixture G: nothing in the plan is lost", () => {
  const result = parseFusionText(fixtureText(G), PACK);

  it("schedules the one time-based service and keeps the five others in the report's order", () => {
    expect(result.services.map((s) => [s.label, s.serviceCode, s.units])).toEqual([["PC - CDS", "T1019U2", 144]]);
    expect(tupleOf(result.services[0]!.tasks)).toEqual([["Bathing", 30, 7], ["Meal Prep/Eating", 30, 7]]);
    expect(result.services[0]!.transport).toEqual({ unitsPerMonth: 20, minutesPerMonth: 300 });
    expect(result.visits).toEqual([]);
    expect(result.others.map((o) => [o.label, o.code, o.registryId, o.pa])).toEqual([
      ["HDM", "S5170", "MO_ADW_HDM", "20260000000022"],
      ["ADC", "S5100HC", "MO_ADW_ADC", "20260000000023"],
      ["FMS", "T2040U6", "MO_ILW_FMS", "20260000000024"],
      ["RN", "T1001U3", "MO_RN_RCF", "20260000000025"],
      ["XYZ", "H2015", null, "20260000000026"],
    ]);
  });

  it("keeps each one's months, units, provider and rows exactly as read", () => {
    const [meals, , , nurse] = result.others;
    expect(meals!.monthly.map((m) => [m.start.slice(0, 7), m.units])).toEqual(MONTHS.map((month) => [month, 62]));
    expect([meals!.start, meals!.end, meals!.provider]).toEqual(["2026-11-01", "2027-04-30", "TEST HOME CARE LLC"]);
    expect(meals!.rows).toEqual(["Home Delivered Meals\t2\tN/A"]);
    expect(nurse!.monthly).toEqual([{ start: "2026-12-01", end: "2026-12-31", units: 1 }]);
  });

  it("never turns meals, a month or a nurse visit into 15-minute units or tasks", () => {
    expect(result.services.some((s) => ["S5170", "T2040U6", "T1001U3", "S5100HC"].includes(s.serviceCode ?? ""))).toBe(false);
    expect(JSON.stringify(result.services)).not.toMatch(/Home Delivered Meals|Adult Day Care/);
  });

  it("asks the person nothing, and says why each one isn't in the week", () => {
    expect(result.issues.filter((issue) => issue.level !== "warn")).toEqual([]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "HDM (Home Delivered Meals, S5170) isn't scheduled: it's arranged by date, not placed in the week. It's kept with the plan.",
      "ADC (Adult Day Care, S5100HC) isn't scheduled: it's arranged by date, not placed in the week. It's kept with the plan.",
      "FMS (Financial Management Service, T2040U6) isn't scheduled: it has no caregiver time to schedule. It's kept with the plan.",
      "RN (Authorized Nurse Visits – RCF/ALF, T1001U3) isn't scheduled: it's arranged by date, not placed in the week. It's kept with the plan.",
      "XYZ (H2015) isn't one of DHSS's Appendix 1 services, so it isn't scheduled. It's kept with the plan for review.",
    ]);
  });

  it("never reads the address, date of birth or phone", () => {
    expect(JSON.stringify(result)).not.toMatch(/1950|Sample Street|Sampletown|555-/);
  });

  it("keeps the others once when the plan is pasted in two pages", () => {
    const text = fixtureText(G);
    const cut = text.indexOf("Date Generated: 10/31/2026 | Page 3 of 6");
    const merged = mergeFusionText([text.slice(0, cut), text.slice(cut), text.slice(cut)], PACK);
    expect(merged.others.map((o) => o.code)).toEqual(["S5170", "S5100HC", "T2040U6", "T1001U3", "H2015"]);
  });
});

describe("IMP-T31 INV-03: a code we don't know is kept, not dropped or renamed", () => {
  it("keeps an unknown label with an unknown code verbatim", () => {
    const result = parseFusionText(fixtureText(G), PACK);
    const unknown = result.others.at(-1)!;
    expect(unknown).toMatchObject({ label: "XYZ", code: "H2015", registryId: null, rows: ["Community Support\t10\tN/A"] });
  });

  it("still asks which service an unknown label is when its code is T1019, which says nothing (INV-04)", () => {
    const result = parseFusionText(fixtureText(G).replace(/^HDM\t/m, "PC - Other\t").replace(/\tS5170\t/g, "\tT1019\t"), PACK);
    expect(result.others.map((o) => o.label)).not.toContain("PC - Other");
    expect(result.services.find((s) => s.label === "PC - Other")?.serviceCode).toBeNull();
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "unknown-service", label: "PC - Other" }));
  });
});

describe("IMP-T32 a plan with nothing for the week says so", () => {
  it("names what it read instead of saying it found nothing", () => {
    const text = fixtureText(G);
    const start = text.indexOf("Service\tStart");
    const end = text.indexOf("Date Generated: 10/31/2026 | Page 2 of 6");
    const result = parseFusionText(text.slice(0, start) + text.slice(end), PACK);
    expect(result.services).toEqual([]);
    expect(result.issues[0]).toEqual({
      level: "error", code: "nothing-to-schedule",
      message: "None of this care plan's authorizations has tasks to place in the week: HDM, ADC, FMS, RN, XYZ.",
    });
  });
});

// INV-02: every row of the HCBS-3a and HCBS-3c task sections in the owner's inventory is recognized.
const INVENTORY = fileURLToPath(new URL("../../../docs/All Schedules/CarePlan_Official_Tasks_3a_3c.csv", import.meta.url));

describe("IMP-T33 INV-02: all 51 worksheet rows", () => {
  const rows = readFileSync(INVENTORY, "utf8").trim().split(/\r?\n/).slice(1).map((line) => line.split(","));
  const PROGRAM: Record<string, string> = {
    AGENCY_BASIC_PC: "AGENCY_PC", AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD: "HOMEMAKER", AGENCY_APC: "APC",
    CDS_ILW_TASK: "CDS", CDS_ILW_TRANSPORT: "CDS",
  };

  it("has 51 rows: 7 basic personal care (one a control row), 11 homemaker, 7 APC, 25 CDS/ILW tasks and transportation", () => {
    const count = (section: string) => rows.filter((row) => row[3] === section).length;
    expect(rows).toHaveLength(51);
    expect(Object.keys(PROGRAM).map(count)).toEqual([7, 11, 7, 25, 1]);
  });

  it("matches every task row to a rule-pack task of its section's service", () => {
    for (const [, , , section, cell, label] of rows) {
      if (label === "MED REL HC TASKS") continue;
      const task = matchTask(PACK, label!);
      expect(task, `${cell} ${label}`).not.toBeNull();
      expect(task!.programs, `${cell} ${label}`).toContain(PROGRAM[section!]);
    }
  });

  it("treats MED REL HC TASKS as the control row, not a task: its children are the homemaker rows, under PC", () => {
    expect(matchTask(PACK, "MED REL HC TASKS")).toBeNull();
    for (const [, , , section, , label] of rows.filter((row) => row[3] === "AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD")) {
      expect(matchTask(PACK, `Med Rel HC Tasks: ${label}`)?.taskCode, label).toBe(matchTask(PACK, label!)?.taskCode);
      expect(section).toBe("AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD");
    }
  });

  it("marks only essential transportation as transportation", () => {
    for (const [, , , section, , label] of rows.filter((row) => row[5] !== "MED REL HC TASKS")) {
      expect(matchTask(PACK, label!)?.isTransport ?? false, label).toBe(section === "CDS_ILW_TRANSPORT");
    }
  });
});
