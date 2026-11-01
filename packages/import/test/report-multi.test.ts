import { describe, expect, it } from "vitest";
import { mergeFusionText, parseFusionText } from "../src/index.js";
import { PACK, contentServices, contentVisits, fixtureText, tupleOf, type TaskTuple } from "./helpers.js";

// IMP-T26..T29: fixture F has the layout of a real care plan report with several authorizations
// (Oct 2026): agency personal care, CDS essential transportation, two General Health Evaluations
// and homemaker, each on its own page. Every identifier in it is made up.
const F = "F-care-plan-report-multi.txt";

const PLAN_MONTHS = ["02", "03", "04", "05", "06", "07", "08", "09", "10"].map((month) => {
  const days = { "02": 28, "04": 30, "06": 30, "09": 30 }[month] ?? 31;
  return { start: `2026-${month}-01`, end: `2026-${month}-${days}` };
});

const F_AGENCY_TASKS: TaskTuple[] = [
  ["Dietary", 75, 5], ["Clean Bath", 15, 2], ["Clean Kitchen", 15, 2], ["Clean Living Area", 10, 3],
  ["Make Bed/Change Linens", 10, 5], ["Trash", 5, 1], ["Laundry", 60, 2], ["Dressing/Grooming", 15, 5],
];

const GHE_NOTE = {
  level: "warn",
  code: "not-scheduled",
  label: "GHE",
  message: "GHE (General Health Evaluation) is a nurse visit, so it's listed by month, not in the week.",
};

describe("IMP-T26 fixture F: every authorization in the report is read", () => {
  const result = parseFusionText(fixtureText(F), PACK);
  const [agency, cds, homemaker] = result.services;

  it("reads the participant and the plan, and nothing else about the person", () => {
    expect(result.participant).toEqual({ name: "SAMPLE PARTICIPANT F", dcn: "10000006" });
    expect(result.plan).toEqual({ start: "2026-02-01", end: "2026-10-31" });
    expect(JSON.stringify(result)).not.toMatch(/1950|Sample Street|Sampletown|555-0101/);
  });

  it("reads the three time-based services in the report's order, each with its own authorization", () => {
    expect(result.services.map((s) => [s.label, s.serviceCode, s.units, s.pa])).toEqual([
      ["PC - Agency", "T1019", 226, "20260000000011"],
      ["PC - CDS", "T1019U2", 40, "20260000000012"],
      ["HC", "S5130", 5, "20260000000014"],
    ]);
    for (const service of result.services) {
      expect(service.monthly!.map(({ start, end }) => ({ start, end }))).toEqual(PLAN_MONTHS);
      expect(service.unread).toEqual([]);
    }
  });

  it("keeps the household tasks under agency personal care, not homemaker", () => {
    expect(tupleOf(agency!.tasks)).toEqual(F_AGENCY_TASKS);
    expect(agency!.monthly!.every((month) => month.units === 226)).toBe(true);
  });

  it("reads CDS essential transportation as its monthly units", () => {
    expect(cds!.tasks).toEqual([]);
    expect(cds!.transport).toEqual({ unitsPerMonth: 40, minutesPerMonth: 600 });
    expect(cds!.provider).toBe("TEST HOME CARE LLC");
  });

  it("reads homemaker's one task", () => {
    expect(tupleOf(homemaker!.tasks)).toEqual([["Wash Windows/Blinds", 15, 1]]);
  });

  it("keeps both General Health Evaluations as visits in their own months", () => {
    expect(result.visits).toMatchObject([
      {
        label: "GHE", serviceCode: "T1001", name: "General Health Evaluation", provider: "TEST HOME CARE LLC",
        start: "2026-05-01", end: "2026-05-31", units: 1, pa: "20260000000013",
      },
      {
        label: "GHE", serviceCode: "T1001", name: "General Health Evaluation", provider: "TEST HOME CARE LLC",
        start: "2026-08-01", end: "2026-08-31", units: 1, pa: "20260000000015",
      },
    ]);
  });

  it("has nothing for the person to resolve, and one note for the visits", () => {
    expect(result.issues).toEqual([GHE_NOTE]);
  });
});

describe("IMP-T27 fixture E keeps its visits", () => {
  const result = parseFusionText(fixtureText("E-care-plan-report-229.txt"), PACK);

  it("lists both GHEs as visits, in the report's order", () => {
    expect(result.visits.map((visit) => [visit.label, visit.start, visit.units, visit.pa])).toEqual([
      ["GHE", "2026-11-01", 1, "20260000000006"],
      ["GHE", "2026-05-01", 1, "20260000000007"],
    ]);
  });
});

describe("IMP-T28 a label we haven't seen is named by its procedure code", () => {
  const text = fixtureText(F).replace("\nHC\tN/A", "\nHMK\tN/A");
  const result = parseFusionText(text, PACK);

  it("uses the month table's code when the rule pack has it as a 15-minute service", () => {
    expect(result.services[2]).toMatchObject({ label: "HMK", serviceCode: "S5130" });
    expect(result.issues.some((issue) => issue.code === "unknown-service")).toBe(false);
  });

  it("still asks when the code is shared by several labels' services", () => {
    const shared = parseFusionText(fixtureText(F).replace("\nPC - CDS\tN/A", "\nPC - XYZ\tN/A"), PACK);
    expect(shared.services[1]).toMatchObject({ label: "PC - XYZ", serviceCode: null });
    expect(shared.issues).toContainEqual(expect.objectContaining({ code: "unknown-service", label: "PC - XYZ" }));
  });
});

describe("IMP-T29 fixture F pasted in two parts", () => {
  const text = fixtureText(F);
  const cut = text.indexOf("Date Generated: 10/23/2026 | Page 4 of 7");
  const result = mergeFusionText([text.slice(0, cut), text.slice(cut)], PACK);

  it("reads the same services and visits as one paste", () => {
    const whole = parseFusionText(text, PACK);
    expect(contentServices(result.services)).toEqual(contentServices(whole.services));
    expect(contentVisits(result.visits)).toEqual(contentVisits(whole.visits));
    expect(result.issues).toEqual([GHE_NOTE]);
  });
});
