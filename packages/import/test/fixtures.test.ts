import { describe, expect, it } from "vitest";
import { parseFusionText } from "../src/index.js";
import { A_TASKS, B_TASKS, C_TASKS, PACK, fixtureText, tupleOf } from "./helpers.js";

describe("IMP-T01 fixture A: run-together, 5-day plan", () => {
  const result = parseFusionText(fixtureText("A-run-together-5day-466.txt"), PACK);
  const [service] = result.services;

  it("reads the participant, DCN and plan dates from the banner", () => {
    expect(result.participant).toEqual({ name: "SAMPLE PARTICIPANT A", dcn: "10000001" });
    expect(result.plan).toEqual({ start: "2025-08-01", end: "2026-06-30" });
    expect(result.totalCost).toBeNull();
  });

  it("reads one service group row", () => {
    expect(result.services).toHaveLength(1);
    expect(service).toMatchObject({
      label: "PC - CDS",
      serviceCode: "T1019U2",
      provider: "TEST HOME CARE LLC",
      phone: "5555550100",
      start: "2025-08-01",
      end: "2026-06-30",
      units: 466,
      cost: null,
      pa: "20250000000001",
    });
  });

  it("splits the run-together text into 15 tasks, reading Essential Correspond as Essential Correspondence", () => {
    expect(tupleOf(service!.tasks)).toEqual(A_TASKS);
    const correspondence = service!.tasks.find((task) => task.name === "Essential Correspondence");
    expect(correspondence).toMatchObject({ fusionName: "Essential Correspond", taskCode: "ESSENTIAL_CORRESPONDENCE" });
    expect(service!.tasks.every((task) => task.taskCode !== null)).toBe(true);
  });

  it("splits the transportation digits into 51 units and 765 minutes", () => {
    expect(service!.transport).toEqual({ unitsPerMonth: 51, minutesPerMonth: 765 });
    expect(service!.unread).toEqual([]);
  });

  it("has no issues", () => {
    expect(result.issues).toEqual([]);
  });
});

describe("IMP-T02 fixture B: tab-separated, 7-day plan", () => {
  const result = parseFusionText(fixtureText("B-tabbed-7day-455.txt"), PACK);
  const [service] = result.services;

  it("reads the banner, including the total cost", () => {
    expect(result.participant).toEqual({ name: "SAMPLE PARTICIPANT B", dcn: "10000002" });
    expect(result.plan).toEqual({ start: "2025-12-01", end: "2026-10-31" });
    expect(result.totalCost).toBe("2436.53");
    expect(result.paging).toEqual([{ from: 1, to: 16, total: 16 }]);
  });

  it("reads the service group row, with the cost's comma removed", () => {
    expect(service).toMatchObject({
      label: "PC - CDS", serviceCode: "T1019U2", units: 455, cost: "2436.53", pa: "20250000000002",
    });
  });

  it("reads 15 tasks, including the short names", () => {
    expect(tupleOf(service!.tasks)).toEqual(B_TASKS);
    const toileting = service!.tasks.find((task) => task.name === "Assistance with Toileting");
    expect(toileting).toMatchObject({ fusionName: "Asst. with Toileting", minPerDay: 10, daysPerWeek: 7 });
  });

  it("reads transportation as 23 units and 345 minutes, with no issues", () => {
    expect(service!.transport).toEqual({ unitsPerMonth: 23, minutesPerMonth: 345 });
    expect(result.issues).toEqual([]);
  });
});

describe("IMP-T03 fixture C: rows only, older plan", () => {
  const result = parseFusionText(fixtureText("C-rows-only-older-plan-402.txt"), PACK);
  const [service] = result.services;

  it("has no group row, so the units come from the rows", () => {
    expect(result.services).toHaveLength(1);
    expect(service).toMatchObject({
      label: null, serviceCode: "T1019U2", provider: null, phone: null, units: 402, cost: null, pa: null,
    });
  });

  it("takes the plan dates from the banner", () => {
    expect(result.participant).toEqual({ name: "SAMPLE PARTICIPANT C", dcn: "10000003" });
    expect(result.plan).toEqual({ start: "2025-02-01", end: "2025-12-31" });
  });

  it("reads 14 tasks and transportation of 30 units and 450 minutes, with no issues", () => {
    expect(tupleOf(service!.tasks)).toEqual(C_TASKS);
    expect(service!.transport).toEqual({ unitsPerMonth: 30, minutesPerMonth: 450 });
    expect(result.issues).toEqual([]);
  });
});

describe("IMP-T04 fixture D: page 1 only", () => {
  it("says the copy is incomplete: 10 of 14 rows", () => {
    const result = parseFusionText(fixtureText("D-page1-only-incomplete.txt"), PACK);
    expect(result.issues).toEqual([
      {
        level: "error", code: "incomplete", have: 10, total: 14,
        message: "This copy has 10 of the plan's 14 rows.",
      },
    ]);
    expect(result.services[0]!.tasks).toHaveLength(9);
    expect(result.services[0]!.transport).toEqual({ unitsPerMonth: 20, minutesPerMonth: 300 });
  });
});
