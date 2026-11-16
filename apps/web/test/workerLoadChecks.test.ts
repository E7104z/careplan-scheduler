import type { Visit } from "@careplan/engine";
import { describe, expect, it } from "vitest";
import { toWeekday, workerLoadResults } from "../src/features/agency/workerLoadChecks";

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: "v-test",
    participantId: "p-test-1",
    caregiverId: "cg-test-01",
    serviceCode: "T1019",
    start: "2026-07-06T09:00",
    end: "2026-07-06T10:00",
    taskIds: ["task-1"],
    ...overrides,
  };
}

describe("workerLoadResults", () => {
  it("is empty for an empty schedule", () => {
    expect(workerLoadResults([], 0)).toEqual([]);
  });

  it("flags a worker in two participants' visits at once as must-fix (CON-04)", () => {
    const visits = [
      visit({ id: "v-1", participantId: "p-test-1", start: "2026-07-06T09:00", end: "2026-07-06T11:00" }),
      visit({ id: "v-2", participantId: "p-test-2", start: "2026-07-06T10:00", end: "2026-07-06T12:00" }),
    ];
    const block = workerLoadResults(visits, 0).find((result) => result.ruleId === "CON-04");
    expect(block?.severity).toBe("BLOCK");
    expect(block?.message).toBe("Caregiver cg-test-01 overlaps across participants");
  });

  it("flags a worker over 40 hours in the workweek as a check (CON-05)", () => {
    const visits = [0, 1, 2, 3, 4, 5].map((day) =>
      visit({
        id: `v-${day}`,
        start: `2026-07-${String(6 + day).padStart(2, "0")}T09:00`,
        end: `2026-07-${String(6 + day).padStart(2, "0")}T16:00`,
      }),
    );
    const warn = workerLoadResults(visits, 0).find((result) => result.ruleId === "CON-05");
    expect(warn?.severity).toBe("WARN");
  });

  it("does not flag a worker when the hours are split across workweeks", () => {
    const visits = [
      visit({ id: "v-1", start: "2026-07-04T09:00", end: "2026-07-04T18:00" }),
      visit({ id: "v-2", start: "2026-07-05T09:00", end: "2026-07-05T18:00" }),
    ];
    expect(workerLoadResults(visits, 0).filter((result) => result.ruleId === "CON-05")).toEqual([]);
  });
});

describe("toWeekday", () => {
  it("keeps valid workweek start days", () => {
    expect(toWeekday(0)).toBe(0);
    expect(toWeekday(6)).toBe(6);
  });

  it("falls back to Sunday for missing or out-of-range values", () => {
    expect(toWeekday(undefined)).toBe(0);
    expect(toWeekday(-1)).toBe(0);
    expect(toWeekday(7)).toBe(0);
    expect(toWeekday(2.5)).toBe(0);
  });
});
