import { describe, expect, it } from "vitest";
import { mergeFusionText, parseFusionText } from "../src/index.js";
import { B_TASKS, PACK, fixtureText, tupleOf } from "./helpers.js";

const PAGE_1 = fixtureText("B-page1-of-2.txt");
const PAGE_2 = fixtureText("B-page2-of-2.txt");

describe("IMP-T05 two pages merged", () => {
  const result = mergeFusionText([PAGE_1, PAGE_2], PACK);

  it("joins page 2's rows to page 1's service: 15 tasks and transportation", () => {
    expect(result.services).toHaveLength(1);
    expect(tupleOf(result.services[0]!.tasks)).toEqual(B_TASKS);
    expect(result.services[0]!.transport).toEqual({ unitsPerMonth: 23, minutesPerMonth: 345 });
  });

  it("has no issues and keeps the participant and plan", () => {
    expect(result.issues).toEqual([]);
    expect(result.participant).toEqual({ name: "SAMPLE PARTICIPANT B", dcn: "10000002" });
    expect(result.plan).toEqual({ start: "2025-12-01", end: "2026-10-31" });
    expect(result.paging).toEqual([
      { from: 1, to: 10, total: 16 },
      { from: 11, to: 16, total: 16 },
    ]);
  });

  it("gives the same plan as the single-page copy of the same table", () => {
    const whole = parseFusionText(fixtureText("B-tabbed-7day-455.txt"), PACK);
    expect(result.services).toEqual(whole.services);
  });

  it("does not depend on which page is pasted first", () => {
    const reversed = mergeFusionText([PAGE_2, PAGE_1], PACK);
    expect(reversed.issues).toEqual([]);
    expect(reversed.services[0]!.tasks).toHaveLength(15);
  });
});

describe("IMP-T06 each page alone is incomplete", () => {
  it("page 1: 10 of 16 rows", () => {
    expect(parseFusionText(PAGE_1, PACK).issues).toEqual([
      { level: "error", code: "incomplete", have: 10, total: 16, message: "This copy has 10 of the plan's 16 rows." },
    ]);
  });

  it("page 2: 6 of 16 rows", () => {
    expect(parseFusionText(PAGE_2, PACK).issues).toEqual([
      { level: "error", code: "incomplete", have: 6, total: 16, message: "This copy has 6 of the plan's 16 rows." },
    ]);
  });

  it("merging page 1 with itself is still incomplete", () => {
    expect(mergeFusionText([PAGE_1], PACK).issues.map((issue) => issue.code)).toEqual(["incomplete"]);
  });
});

describe("IMP-12 several pastes", () => {
  it("refuses a page for a different participant, without putting the DCN in the message", () => {
    const result = mergeFusionText([PAGE_1, fixtureText("A-run-together-5day-466.txt")], PACK);
    const refused = result.issues.find((issue) => issue.code === "different-participant");
    expect(refused).toEqual({
      level: "error", code: "different-participant", message: "Page 2 is for a different participant.",
    });
    expect(JSON.stringify(result.issues)).not.toMatch(/1000000\d/);
    // The refused page adds nothing: the plan is still page 1's service.
    expect(result.services).toHaveLength(1);
    expect(result.services[0]!.units).toBe(455);
  });

  it("drops a task already read and says so (the same page pasted twice)", () => {
    const result = mergeFusionText([PAGE_1, PAGE_1], PACK);
    const duplicates = result.issues.filter((issue) => issue.code === "duplicate-task");
    expect(duplicates).toHaveLength(9);
    expect(duplicates.every((issue) => issue.level === "warn")).toBe(true);
    expect(duplicates[0]).toEqual({
      level: "warn", code: "duplicate-task", name: "Assistance with Toileting",
      message: "Assistance with Toileting appears twice.",
    });
    expect(result.services[0]!.tasks).toHaveLength(9);
    // The repeated page doesn't add rows, so the plan is still short of page 2.
    expect(result.issues.find((issue) => issue.code === "incomplete")).toMatchObject({ have: 10, total: 16 });
  });

  it("checks the rows of every page, not just the first", () => {
    const withOddRows = PAGE_2.replace("455 units\tTrash\t5\t7", "455 units\tPet Care\t17\t7\n455 units\tBathing458");
    const result = mergeFusionText([PAGE_1, withOddRows], PACK);
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("unknown-task");
    expect(codes).toContain("odd-minutes");
    expect(codes).toContain("unread-row");
  });

  it("joins a page without a group row to nothing and keeps it as its own service", () => {
    const rowsOnly = "455 units\tTrash\t5\t7";
    const result = mergeFusionText([PAGE_1, rowsOnly], PACK);
    expect(result.services.map((service) => service.label)).toEqual(["PC - CDS", null]);
  });

  it("takes the participant and plan from a later page when the first page has no banner", () => {
    const rowsOnly = "455 units\tBathing\t45\t7";
    const result = mergeFusionText([rowsOnly, PAGE_2], PACK);
    expect(result.participant).toEqual({ name: "SAMPLE PARTICIPANT B", dcn: "10000002" });
    expect(result.plan).toEqual({ start: "2025-12-01", end: "2026-10-31" });
  });

  it("an empty list of pastes finds no rows", () => {
    const result = mergeFusionText([], PACK);
    expect(result.issues.map((issue) => issue.code)).toEqual(["no-rows"]);
  });
});
