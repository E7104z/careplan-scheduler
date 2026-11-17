import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  projectAccrual,
  weekdayOf,
  type AccrualProjection,
} from "../src/index.js";

/** An expanded month map from day minutes, keyed to one "task" each date. */
function expandedFrom(days: Record<string, number>): Record<string, Record<string, number>> {
  const expanded: Record<string, Record<string, number>> = {};
  for (const [date, minutes] of Object.entries(days)) expanded[date] = { task: minutes };
  return expanded;
}

/** The TC-01 weekly pattern expanded across one month: Sun..Sat minutes [70,90,90,90,90,90,70]. */
function tc01November2026(): Record<string, Record<string, number>> {
  const dayTotals = [70, 90, 90, 90, 90, 90, 70];
  const year = 2026;
  const month = 11;
  const expanded: Record<string, Record<string, number>> = {};
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const date = `2026-11-${String(d).padStart(2, "0")}`;
    expanded[date] = { task: dayTotals[weekdayOf(year, month, d)]! };
  }
  return expanded;
}

describe("projectAccrual", () => {
  it("ACC-01: remainders summing to 143 minutes give 9 units and 8 remaining", () => {
    // 10 days of 14 leftover minutes + 1 day of 3 = 143.
    const days: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) days[`2026-11-${String(i).padStart(2, "0")}`] = 14;
    days["2026-11-11"] = 3;
    const result = projectAccrual(expandedFrom(days));
    expect(result.accruedMinutes).toBe(143);
    expect(result.potentialAmvUnits).toBe(9);
    expect(result.remainingMinutes).toBe(8);
  });

  it("ACC-02: TC-01 test week in November 2026 accrues 90 minutes into 6 units on the named dates", () => {
    const result = projectAccrual(tc01November2026());
    expect(result.accruedMinutes).toBe(90);
    expect(result.potentialAmvUnits).toBe(6);
    expect(result.remainingMinutes).toBe(0);
    expect(result.units.map((unit) => unit.availableOn)).toEqual([
      "2026-11-07",
      "2026-11-08",
      "2026-11-15",
      "2026-11-21",
      "2026-11-28",
      "2026-11-29",
    ]);
  });

  it("ACC-03: remainders 10 then 10 split the first day's minutes across two units", () => {
    const result = projectAccrual(expandedFrom({ "2026-11-01": 10, "2026-11-02": 10 }));
    expect(result.units).toEqual([
      {
        number: 1,
        availableOn: "2026-11-02",
        contributions: [
          { date: "2026-11-01", minutes: 10 },
          { date: "2026-11-02", minutes: 5 },
        ],
      },
    ]);
    expect(result.remainingMinutes).toBe(5);
    expect(result.remainingContributions).toEqual([{ date: "2026-11-02", minutes: 5 }]);
  });

  it("ACC-04: a 17-minute day leaves 2; a 173-minute day makes 11 units and leaves 8", () => {
    const seventeen = projectAccrual(expandedFrom({ "2026-11-01": 17 }));
    expect(seventeen.days[0]!.dayUnits).toBe(1);
    expect(seventeen.days[0]!.remainder).toBe(2);

    const big = projectAccrual(expandedFrom({ "2026-11-01": 173 }));
    expect(big.days[0]!.dayUnits).toBe(11);
    expect(big.days[0]!.remainder).toBe(8);
  });

  it("ACC-05: all multiples of 15 accrue nothing and leave no remainder rows", () => {
    const result = projectAccrual(expandedFrom({ "2026-11-01": 45, "2026-11-02": 60, "2026-11-03": 90 }));
    expect(result.accruedMinutes).toBe(0);
    expect(result.potentialAmvUnits).toBe(0);
    expect(result.remainingMinutes).toBe(0);
    expect(result.units).toEqual([]);
    expect(result.days.every((day) => day.remainder === 0)).toBe(true);
  });

  it("ACC-06: a month-end cut and a one-day change both change the projection", () => {
    const base = tc01November2026();
    const cut: Record<string, Record<string, number>> = {};
    for (const [date, day] of Object.entries(base)) {
      cut[date] = { task: date === "2026-11-30" ? 0 : day.task! };
    }
    const changed: Record<string, Record<string, number>> = {
      ...base,
      "2026-11-03": { task: (base["2026-11-03"]!.task ?? 0) + 5 },
    };
    const baseResult = projectAccrual(base);
    expect(projectAccrual(cut)).not.toEqual(baseResult);
    expect(projectAccrual(changed)).not.toEqual(baseResult);
  });

  it("ACC-07: a mid-month authorization counts only the in-range dates it is given", () => {
    const result = projectAccrual(expandedFrom({ "2026-11-15": 70, "2026-11-16": 70 }));
    expect(result.days.map((day) => day.date)).toEqual(["2026-11-15", "2026-11-16"]);
    expect(result.accruedMinutes).toBe(20);
  });

  it("ACC-08: two services combined on the same days accrue separately", () => {
    const a = projectAccrual(expandedFrom({ "2026-11-01": 70, "2026-11-02": 90 }));
    const b = projectAccrual(expandedFrom({ "2026-11-01": 85, "2026-11-02": 95 }));
    expect(a.accruedMinutes).toBe(10); // 70 -> 10, 90 -> 0
    expect(b.accruedMinutes).toBe(15); // 85 -> 10, 95 -> 5
    expect(a.potentialAmvUnits).toBe(0);
    expect(b.potentialAmvUnits).toBe(1);
  });

  it("ACC-09: transportation (weekly minutes in multiples of 15) projects 0", () => {
    const result = projectAccrual(expandedFrom({ "2026-11-03": 45, "2026-11-10": 60 }));
    expect(result.accruedMinutes).toBe(0);
    expect(result.potentialAmvUnits).toBe(0);
    expect(result.remainingMinutes).toBe(0);
  });

  it("ACC-10: sum(dayUnits) + potentialAmvUnits === floor(sum(dayMinutes)/15)", () => {
    const schedules: Record<string, number>[][] = [
      [{ "2026-11-01": 17 }, { "2026-11-02": 173 }, { "2026-11-03": 8 }],
      [{ "2026-11-01": 70 }, { "2026-11-02": 90 }, { "2026-11-03": 70 }, { "2026-11-04": 95 }],
      [{ "2026-11-05": 143 }, { "2026-11-06": 1 }, { "2026-11-07": 14 }],
    ];
    for (const schedule of schedules) {
      const expanded: Record<string, Record<string, number>> = {};
      for (const day of schedule) Object.assign(expanded, expandedFrom(day));
      const result: AccrualProjection = projectAccrual(expanded);
      const dayUnits = result.days.reduce((sum, day) => sum + day.dayUnits, 0);
      const dayMinutes = result.days.reduce((sum, day) => sum + day.dayMinutes, 0);
      expect(dayUnits + result.potentialAmvUnits).toBe(Math.floor(dayMinutes / 15));
    }
  });
});
