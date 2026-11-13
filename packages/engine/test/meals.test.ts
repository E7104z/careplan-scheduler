import { describe, expect, it } from "vitest";
import { MO_2026_07, hdmDayTotals, hdmMealChecks, type HdmDelivery } from "../src/index.js";

// ADW-04 reuses WS-R09's "Max 2/day" note from the rule pack.
const MAX = MO_2026_07.stateParity3a!.hdmMaxUnitsPerDayNote;

function delivery(id: string, date: string, meals: number): HdmDelivery {
  return { id, serviceAuthId: "hdm-auth-1", date, meals };
}

describe("hdmDayTotals (ADW-04 calculator)", () => {
  it("sums each day's meals into one dated record, never minutes", () => {
    expect(hdmDayTotals([
      delivery("a", "2026-11-02", 1),
      delivery("b", "2026-11-02", 1),
      delivery("c", "2026-11-03", 2),
    ])).toEqual([
      { date: "2026-11-02", meals: 2 },
      { date: "2026-11-03", meals: 2 },
    ]);
  });
});

describe("hdmMealChecks (ADW-04 cap)", () => {
  it("allows 1 or 2 meals a day", () => {
    expect(hdmMealChecks([
      delivery("a", "2026-11-02", 1),
      delivery("b", "2026-11-03", 2),
    ], MAX)).toEqual([]);
  });

  it("reviews more than 2 meals a day", () => {
    const results = hdmMealChecks([delivery("a", "2026-11-02", 3)], MAX);
    expect(results.some((r) => r.ruleId === "WS-R09" && r.severity === "REVIEW")).toBe(true);
  });
});
