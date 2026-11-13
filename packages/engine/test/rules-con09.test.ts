import { describe, expect, it } from "vitest";
import { ruleCON09WeeklyHours } from "../src/index.js";

/** `minutes` on every date from `from` to `to` (inclusive, same month). */
function everyDay(from: string, to: string, minutes: number): Record<string, number> {
  const daily: Record<string, number> = {};
  const month = from.slice(0, 8);
  for (let day = Number(from.slice(8)); day <= Number(to.slice(8)); day++) {
    daily[`${month}${String(day).padStart(2, "0")}`] = minutes;
  }
  return daily;
}

describe("CON-09: the 49-hour week stays under review until DHSS defines it (E-02)", () => {
  it("ILW-02: under 49 hours in every reading still shows one REVIEW, never a pass", () => {
    // 6 h a day for all of November 2026: 42 h in any seven days.
    const results = ruleCON09WeeklyHours(everyDay("2026-11-01", "2026-11-30", 360));
    expect(results.map((r) => r.severity)).toEqual(["REVIEW"]);
  });

  it("the REVIEW shows both diagnostics: the highest Sunday-Saturday week and the highest 7-day stretch", () => {
    const [review] = ruleCON09WeeklyHours(everyDay("2026-11-01", "2026-11-30", 360));
    expect(review!.message).toBe(
      "Highest Sunday-Saturday week 42 h (week of 2026-11-01); highest 7-day stretch 42 h (2026-11-01 to 2026-11-07)",
    );
  });

  it("over 49 hours in every reading shows BLOCK and the REVIEW", () => {
    // 7 h 30 min a day for all of November 2026: 52 h 30 min in any seven days.
    const results = ruleCON09WeeklyHours(everyDay("2026-11-01", "2026-11-30", 450));
    expect(results.map((r) => r.severity).sort()).toEqual(["BLOCK", "REVIEW"]);
    const review = results.find((r) => r.severity === "REVIEW")!;
    expect(review.message).toContain("52 h 30 min");
  });

  it("the BLOCK message carries no figures, so lowering the hours of a plan already over isn't refused", () => {
    const a = ruleCON09WeeklyHours(everyDay("2026-11-01", "2026-11-30", 450)).find((r) => r.severity === "BLOCK");
    const b = ruleCON09WeeklyHours(everyDay("2026-11-01", "2026-11-30", 440)).find((r) => r.severity === "BLOCK");
    expect(a).toEqual(b);
  });

  it("over in one reading only (a 7-day stretch across two weeks) shows REVIEW with both figures", () => {
    // TC-26's days: each Sunday-Saturday week is exactly 49 h, the Thursday-Wednesday stretch 70 h.
    const daily: Record<string, number> = {
      "2026-12-27": 285, "2026-12-28": 285, "2026-12-29": 285, "2026-12-30": 285,
      "2026-12-31": 600, "2027-01-01": 600, "2027-01-02": 600,
      "2027-01-03": 600, "2027-01-04": 600, "2027-01-05": 600, "2027-01-06": 600,
      "2027-01-07": 180, "2027-01-08": 180, "2027-01-09": 180,
    };
    const results = ruleCON09WeeklyHours(daily);
    expect(results.map((r) => r.severity)).toEqual(["REVIEW"]);
    expect(results[0]!.message).toBe(
      "Highest Sunday-Saturday week 49 h (week of 2026-12-27); highest 7-day stretch 70 h (2026-12-31 to 2027-01-06)",
    );
  });

  it("does not pick Sunday to Saturday: one Sunday-Saturday week over 49 h, but not the weeks starting other days, is REVIEW only", () => {
    // Sun Nov 1 to Sat Nov 7, 2026 at 7 h 30 min (52 h 30 min); the week from Monday Nov 2 holds 45 h.
    const results = ruleCON09WeeklyHours(everyDay("2026-11-01", "2026-11-07", 450));
    expect(results.map((r) => r.severity)).toEqual(["REVIEW"]);
  });

  it("a week over 49 h only where it crosses a month or year end is REVIEW only (how DHSS counts it is open)", () => {
    // TC-25: 7 h 30 min a day, Sun Dec 27, 2026 to Sat Jan 2, 2027.
    const daily: Record<string, number> = {
      "2026-12-27": 450, "2026-12-28": 450, "2026-12-29": 450, "2026-12-30": 450,
      "2026-12-31": 450, "2027-01-01": 450, "2027-01-02": 450,
    };
    expect(ruleCON09WeeklyHours(daily).map((r) => r.severity)).toEqual(["REVIEW"]);
  });

  it("exactly 49 hours in every reading is REVIEW only (the limit is over 49)", () => {
    const results = ruleCON09WeeklyHours(everyDay("2026-11-01", "2026-11-30", 420));
    expect(results.map((r) => r.severity)).toEqual(["REVIEW"]);
  });

  it("no scheduled time: nothing to check, so no result", () => {
    expect(ruleCON09WeeklyHours({})).toEqual([]);
    expect(ruleCON09WeeklyHours({ "2026-11-02": 0 })).toEqual([]);
  });

  it("names the participant and limit group when scoped", () => {
    const results = ruleCON09WeeklyHours(everyDay("2026-11-01", "2026-11-30", 450), { participantId: "P-1", group: "ILW" });
    for (const result of results) {
      expect(result.message.startsWith("P-1 ILW: ")).toBe(true);
      expect(result.refs.participantId).toBe("P-1");
    }
  });
});
