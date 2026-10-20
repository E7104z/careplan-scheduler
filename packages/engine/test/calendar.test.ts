import { describe, expect, it } from "vitest";
import {
  elapsedMinutes,
  rollingWindows,
  splitByDate,
  sundayWeeks,
  usageMeasures,
  type ScheduleTemplate,
  type TemplateEntry,
} from "../src/index.js";

function entry(taskId: string, weekday: number, minutes: number): TemplateEntry {
  return { taskId, weekday: weekday as TemplateEntry["weekday"], minutes };
}

function tc01Template(): ScheduleTemplate {
  return {
    id: "tpl-tc01",
    participantId: "P-TEST-01",
    start: "2025-09-01",
    end: "2026-08-31",
    rulePackVersion: "mo-2026-07",
    entries: [
      entry("bathing", 1, 30),
      entry("bathing", 3, 30),
      entry("bathing", 5, 30),
      entry("toileting", 0, 15),
      entry("toileting", 1, 15),
      entry("toileting", 2, 15),
      entry("toileting", 3, 15),
      entry("toileting", 4, 15),
      entry("toileting", 5, 15),
      entry("toileting", 6, 15),
      entry("meals", 0, 45),
      entry("meals", 1, 45),
      entry("meals", 2, 45),
      entry("meals", 3, 45),
      entry("meals", 4, 45),
      entry("meals", 5, 45),
      entry("meals", 6, 45),
      entry("laundry", 2, 30),
      entry("laundry", 4, 30),
      entry("kitchen", 0, 10),
      entry("kitchen", 6, 10),
    ],
  };
}

const TC01_MONTHS = [
  "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02", "2026-03", "2026-04",
  "2026-05", "2026-06", "2026-07", "2026-08",
];

describe("calendar expansion", () => {
  it("TC-01: day totals and weekly minutes", () => {
    const template = tc01Template();
    const totals = [0, 0, 0, 0, 0, 0, 0];
    for (const e of template.entries) totals[e.weekday] = (totals[e.weekday] ?? 0) + e.minutes;
    expect(totals).toEqual([70, 90, 90, 90, 90, 90, 70]);
    expect(totals.reduce((a, b) => a + b, 0)).toBe(590);
  });

  it("TC-01: usage measures over Sep 2025–Aug 2026", () => {
    const m = usageMeasures(tc01Template(), TC01_MONTHS);
    expect(m.weeklyBaselineUnits).toBe(2028);
    expect(m.calendarMinutes).toBe(30770);
    expect(m.monthlyWholeUnits).toBe(2047);
    expect(m.monthEndRemainderMinutes).toBe(65);
  });

  it("TC-01: Sep 2025 usage = 169 units + 5", () => {
    const m = usageMeasures(tc01Template(), ["2025-09"]);
    expect(m.monthlyWholeUnits).toBe(169);
    expect(m.monthEndRemainderMinutes).toBe(5);
  });
});

describe("DST-safe time handling", () => {
  it("TC-27: fall-back visit 2026-10-31T22:00 → 2026-11-01T06:00", () => {
    expect(elapsedMinutes("2026-10-31T22:00", "2026-11-01T06:00")).toBe(540);
    expect(splitByDate("2026-10-31T22:00", "2026-11-01T06:00"))
      .toEqual({ "2026-10-31": 120, "2026-11-01": 420 });
  });

  it("TC-28: spring-forward visit 2027-03-13T22:00 → 2027-03-14T06:00", () => {
    expect(elapsedMinutes("2027-03-13T22:00", "2027-03-14T06:00")).toBe(420);
    expect(splitByDate("2027-03-13T22:00", "2027-03-14T06:00"))
      .toEqual({ "2027-03-13": 120, "2027-03-14": 300 });
  });
});

describe("week windows", () => {
  it("TC-11: Sunday week does not reset at month boundary", () => {
    const daily: Record<string, number> = {
      "2029-01-28": 420,
      "2029-01-29": 420,
      "2029-01-30": 420,
      "2029-01-31": 420,
      "2029-02-01": 420,
      "2029-02-02": 420,
      "2029-02-03": 420,
    };
    const weeks = sundayWeeks(daily);
    expect(weeks).toEqual([{ weekStart: "2029-01-28", minutes: 2940 }]);
  });

  it("TC-25: ILW 450 min/day Sunday week = 3,150", () => {
    const daily: Record<string, number> = {
      "2026-12-27": 450,
      "2026-12-28": 450,
      "2026-12-29": 450,
      "2026-12-30": 450,
      "2026-12-31": 450,
      "2027-01-01": 450,
      "2027-01-02": 450,
    };
    expect(sundayWeeks(daily).map((w) => w.minutes)).toEqual([3150]);
  });

  it("TC-26: Sunday weeks 2,940 / 2,940 and max rolling window 4,200", () => {
    const daily: Record<string, number> = {
      "2026-12-27": 285, "2026-12-28": 285, "2026-12-29": 285, "2026-12-30": 285,
      "2026-12-31": 600, "2027-01-01": 600, "2027-01-02": 600,
      "2027-01-03": 600, "2027-01-04": 600, "2027-01-05": 600, "2027-01-06": 600,
      "2027-01-07": 180, "2027-01-08": 180, "2027-01-09": 180,
    };
    expect(sundayWeeks(daily).map((w) => w.minutes)).toEqual([2940, 2940]);
    const max = Math.max(...rollingWindows(daily).map((w) => w.minutes));
    expect(max).toBe(4200);
  });
});
