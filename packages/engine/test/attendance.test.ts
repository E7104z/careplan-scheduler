import { describe, expect, it } from "vitest";
import { MO_2026_07, adcAttendanceChecks, adcDayTotals, type AdcAttendance } from "../src/index.js";

// ADW-03 reuses WS-R08's caps straight from the rule pack; the transport cap lives beside them.
const LIMITS = MO_2026_07.stateParity3a!.adultDayCare;

function attendance(id: string, date: string, minutes: number, transportMinutes = 0): AdcAttendance {
  return { id, serviceAuthId: "adc-auth-1", date, minutes, transportMinutes };
}

describe("adcDayTotals (ADW-03 calculator)", () => {
  it("sums each day's attendance and transport into one dated record, in date order", () => {
    expect(adcDayTotals([
      attendance("b", "2026-11-02", 360, 30),
      attendance("a", "2026-11-02", 240, 30),
      attendance("c", "2026-11-03", 600, 0),
    ])).toEqual([
      { date: "2026-11-02", minutes: 600, transportMinutes: 60 },
      { date: "2026-11-03", minutes: 600, transportMinutes: 0 },
    ]);
  });
});

describe("adcAttendanceChecks (ADW-03 caps)", () => {
  it("passes 40 units (600 minutes) a day across 5 days a week", () => {
    const week = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]
      .map((date, i) => attendance(String(i), date, 600));
    expect(adcAttendanceChecks(week, LIMITS)).toEqual([]);
  });

  it("blocks 41 units (615 minutes) in a day", () => {
    const results = adcAttendanceChecks([attendance("1", "2026-11-02", 615)], LIMITS);
    expect(results.some((r) => r.ruleId === "WS-R08" && r.severity === "BLOCK")).toBe(true);
  });

  it("blocks a sixth day in a Sunday-Saturday week", () => {
    const week = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]
      .map((date, i) => attendance(String(i), date, 600));
    const results = adcAttendanceChecks(week, LIMITS);
    expect(results.some((r) => r.ruleId === "WS-R08" && r.severity === "BLOCK")).toBe(true);
  });

  it("blocks minutes that are not in 15-minute steps", () => {
    const results = adcAttendanceChecks([attendance("1", "2026-11-02", 610)], LIMITS);
    expect(results.some((r) => r.ruleId === "WS-R08" && r.severity === "BLOCK")).toBe(true);
  });

  it("blocks the transport part above 120 minutes a day", () => {
    const results = adcAttendanceChecks([attendance("1", "2026-11-02", 600, 121)], LIMITS);
    expect(results.some((r) => r.ruleId === "WS-R08" && r.severity === "BLOCK" && r.message.includes("transportation"))).toBe(true);
  });

  it("allows the transport part up to 120 minutes a day", () => {
    expect(adcAttendanceChecks([attendance("1", "2026-11-02", 600, 120)], LIMITS)).toEqual([]);
  });
});
