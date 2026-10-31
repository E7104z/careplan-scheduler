import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  dayUnits,
  factorFor,
  hcbs3cTaskUnits,
  hcbs3cTaskUnitsFromWeekly,
  maxWeekdayOccurrences,
  monthTaskUnits,
  transportAllowance,
  workbookTaskUnits,
} from "../src/index.js";

// TC-01 authorization tasks: (weeklyMinutes, timesPerWeek)
const TC01_TASKS: Array<[number, number]> = [
  [90, 3],   // Bathing 30 min Mon/Wed/Fri
  [105, 7],  // Toileting 15 min daily
  [315, 7],  // Meals/Dishes 45 min daily
  [60, 2],   // Laundry 30 min Tue/Thu
  [20, 2],   // Clean Kitchen 10 min Sun/Sat
];

function tc01MonthTotal(days: number): number {
  return TC01_TASKS.reduce((sum, [weekly, times]) => sum + monthTaskUnits(weekly, times, days).units, 0);
}

describe("F-1 factor / weekday occurrences", () => {
  it("factorFor matches the AUTH-02 table", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((d) => factorFor(d as 1 | 2 | 3 | 4 | 5 | 6 | 7)))
      .toEqual([5, 10, 15, 19, 23, 27, 31]);
  });

  it("TC-12: max weekday occurrences over 2026-01..2036-12", () => {
    for (let k = 1; k <= 7; k++) {
      let max = 0;
      for (let year = 2026; year <= 2036; year++) {
        for (let month = 1; month <= 12; month++) {
          max = Math.max(max, maxWeekdayOccurrences(year, month, k));
        }
      }
      expect(max).toBe(factorFor(k as 1 | 2 | 3 | 4 | 5 | 6 | 7));
    }
  });
});

describe("F-2a hcbs3cTaskUnits", () => {
  it("TC-04: 309 min/day 5x/wk = 474", () => {
    expect(hcbs3cTaskUnits(309, 5).units).toBe(474);
  });

  it("TC-05: 10 min 1x/wk = 4; 10 min 2x/wk = 7", () => {
    expect(hcbs3cTaskUnits(10, 1).units).toBe(4);
    expect(hcbs3cTaskUnits(10, 2).units).toBe(7);
  });

  it("TC-37: 61/7 min/day 7x/wk = 19", () => {
    expect(hcbs3cTaskUnitsFromWeekly(61, 7).units).toBe(19);
  });
});

describe("F-2b workbookTaskUnits", () => {
  it("TC-37: 61 weekly minutes 7x/wk = 18", () => {
    expect(workbookTaskUnits(61, 7).units).toBe(18);
  });
});

describe("CALC-01 (docs/MISSOURI-COVERAGE-AUDIT.md): 10 minutes a day, 7 days a week", () => {
  it("is 21 units a month on both worksheet formulas (31-day basis), not 31", () => {
    expect(hcbs3cTaskUnitsFromWeekly(70, 7).units).toBe(21);
    expect(workbookTaskUnits(70, 7).units).toBe(21);
  });
});

describe("F-3 monthTaskUnits", () => {
  it("TC-02: 30 min daily over 28/29/30/31-day months", () => {
    expect([28, 29, 30, 31].map((d) => monthTaskUnits(210, 7, d).units)).toEqual([56, 58, 60, 62]);
  });

  it("TC-03: Transfer 30 daily + Toileting 15 daily + Bathing 30 5x/wk", () => {
    const total = (days: number) =>
      monthTaskUnits(210, 7, days).units +
      monthTaskUnits(105, 7, days).units +
      monthTaskUnits(150, 5, days).units;
    expect([28, 29, 30, 31].map(total)).toEqual([130, 133, 136, 139]);
  });

  it("TC-01: month units 181/177/169/173 and 12-month total 2,144", () => {
    expect(tc01MonthTotal(31)).toBe(181);
    expect(tc01MonthTotal(30)).toBe(177);
    expect(tc01MonthTotal(28)).toBe(169);
    expect(tc01MonthTotal(29)).toBe(173);

    const months: Array<[number, number]> = [
      [2025, 9], [2025, 10], [2025, 11], [2025, 12],
      [2026, 1], [2026, 2], [2026, 3], [2026, 4],
      [2026, 5], [2026, 6], [2026, 7], [2026, 8],
    ];
    const total = months.reduce((sum, [y, m]) => sum + tc01MonthTotal(daysInMonth(y, m)), 0);
    expect(total).toBe(2144);
  });
});

describe("F-4 transportAllowance", () => {
  it("TC-06: 90x1, 60x2, 60x3", () => {
    expect(transportAllowance(90, 1)).toEqual({ minutesPerMonth: 450, units: 30, unallocatedMinutes: 0 });
    expect(transportAllowance(60, 2)).toEqual({ minutesPerMonth: 600, units: 40, unallocatedMinutes: 0 });
    expect(transportAllowance(60, 3)).toEqual({ minutesPerMonth: 900, units: 60, unallocatedMinutes: 0 });
  });

  it("TC-20: 50x1, 70x2", () => {
    expect(transportAllowance(50, 1)).toEqual({ minutesPerMonth: 250, units: 16, unallocatedMinutes: 10 });
    expect(transportAllowance(70, 2)).toEqual({ minutesPerMonth: 700, units: 46, unallocatedMinutes: 10 });
  });
});

describe("F-5 dayUnits", () => {
  it("splits minutes into whole 15-minute units and remainder", () => {
    expect(dayUnits(590)).toEqual({ units: 39, remainder: 5 });
    expect(dayUnits(45)).toEqual({ units: 3, remainder: 0 });
  });
});
