import { describe, expect, it } from "vitest";
import {
  amendmentEffectiveDate,
  applyAmendment,
  chainOf,
  expandChainMonth,
  ruleAMEND01EffectiveDates,
  versionOn,
  type AmendmentDirection,
  type AuthorizationChain,
  type ScheduleTemplate,
  type ServiceAuthorization,
} from "../src/index.js";

// CP3-6: the Manual 4.20 behaviors on the CP2-7 model. P-TEST data only.
const AUTH: ServiceAuthorization = {
  id: "auth-1", participantId: "P-TEST-01", program: "CDS", serviceCode: "T1019U2",
  start: "2026-11-01", end: "2027-04-30", state: "active", suspensions: [], revision: 1,
  tasks: [{ id: "bath", serviceAuthId: "auth-1", taskCode: "BATHING", name: "Bathing", minPerDay: 30, daysPerWeek: 7 }],
};

function template(minutes: number, id = "tpl-1"): ScheduleTemplate {
  return {
    id, participantId: "P-TEST-01", start: AUTH.start, end: AUTH.end, rulePackVersion: "mo-2026-07",
    entries: ([0, 1, 2, 3, 4, 5, 6] as const).map((weekday) => ({ taskId: "bath", weekday, minutes })),
  };
}

function amended(direction: AmendmentDirection, date: string, minutes: number, more: { dateConfirmed?: boolean } = {}): AuthorizationChain {
  return applyAmendment(chainOf(AUTH, template(30)), {
    amendmentId: "amend-1", direction, date, ...more,
    authorization: { ...AUTH, revision: 2, tasks: [{ ...AUTH.tasks[0]!, minPerDay: minutes }] },
    template: template(minutes, "tpl-2"),
  });
}

function minutesOn(chain: AuthorizationChain, date: string): number | undefined {
  const [year, month] = date.split("-").map(Number) as [number, number];
  return expandChainMonth(chain, [], year, month).find((occurrence) => occurrence.date === date)?.minutes;
}

describe("amendmentEffectiveDate (Manual 4.20)", () => {
  it("an increase takes effect on its date, mid-month included", () => {
    expect(amendmentEffectiveDate("increase", "2026-12-15")).toBe("2026-12-15");
    expect(amendmentEffectiveDate("increase", "2026-12-01")).toBe("2026-12-01");
  });

  it("a decrease dated mid-month takes effect on the first of the next month", () => {
    expect(amendmentEffectiveDate("decrease", "2026-12-15")).toBe("2027-01-01");
    expect(amendmentEffectiveDate("decrease", "2026-11-02")).toBe("2026-12-01");
    expect(amendmentEffectiveDate("decrease", "2027-02-28")).toBe("2027-03-01");
  });

  it("a decrease dated the 1st is already a month's first day", () => {
    expect(amendmentEffectiveDate("decrease", "2027-01-01")).toBe("2027-01-01");
  });

  it("a participant-requested reduction takes effect on its date", () => {
    expect(amendmentEffectiveDate("reduction-immediate", "2026-12-15")).toBe("2026-12-15");
  });
});

describe("applyAmendment: forward only", () => {
  it("an increase mid-month recalculates from that date and not before", () => {
    const chain = amended("increase", "2026-12-15", 45);
    expect(minutesOn(chain, "2026-12-14")).toBe(30);
    expect(minutesOn(chain, "2026-12-15")).toBe(45);
    expect(minutesOn(chain, "2027-01-10")).toBe(45);
    expect(chain.versions[1]).toMatchObject({ direction: "increase", effectiveFrom: "2026-12-15" });
    expect(chain.versions[1]!.requestedDate).toBeUndefined();
  });

  it("a decrease dated mid-month takes effect on the first of the next month; the rest of this month is unchanged", () => {
    const chain = amended("decrease", "2026-12-15", 15);
    expect(chain.versions[1]).toMatchObject({ direction: "decrease", effectiveFrom: "2027-01-01", requestedDate: "2026-12-15" });
    expect(minutesOn(chain, "2026-12-15")).toBe(30);
    expect(minutesOn(chain, "2026-12-31")).toBe(30);
    expect(minutesOn(chain, "2027-01-01")).toBe(15);
  });

  it("an immediate reduction takes effect on its date", () => {
    const chain = amended("reduction-immediate", "2026-12-15", 15);
    expect(minutesOn(chain, "2026-12-14")).toBe(30);
    expect(minutesOn(chain, "2026-12-15")).toBe(15);
  });

  it("a month crossing an amendment shows both versions, each on its own dates", () => {
    const december = expandChainMonth(amended("increase", "2026-12-15", 45), [], 2026, 12);
    expect(december.filter((occurrence) => occurrence.amendmentId === null).map((occurrence) => occurrence.date)).toEqual(
      Array.from({ length: 14 }, (_, index) => `2026-12-${String(index + 1).padStart(2, "0")}`),
    );
    expect(december.filter((occurrence) => occurrence.amendmentId === "amend-1")).toHaveLength(17);
    expect(new Set(december.map((occurrence) => occurrence.minutes))).toEqual(new Set([30, 45]));
  });

  it("history never changes: the months before the amendment are exactly the original", () => {
    const original = chainOf(AUTH, template(30));
    for (const direction of ["increase", "decrease", "reduction-immediate"] as const) {
      const chain = amended(direction, "2026-12-15", 45);
      expect(expandChainMonth(chain, [], 2026, 11), direction).toEqual(expandChainMonth(original, [], 2026, 11));
      expect(versionOn(chain, "2026-11-30")?.amendmentId).toBeNull();
    }
  });

  it("a plan with no amendment is unchanged", () => {
    const chain = chainOf(AUTH, template(30));
    expect(expandChainMonth(chain, [], 2026, 12).every((occurrence) => occurrence.minutes === 30 && occurrence.amendmentId === null)).toBe(true);
  });

  it("refuses a date that isn't one, and an amendment outside the authorization", () => {
    expect(() => amended("increase", "2026-02-30", 45)).toThrow(/not a date/);
    expect(() => amended("increase", "2027-06-01", 45)).toThrow(/inside/);
    // A decrease dated in the last month has no later month inside the authorization.
    expect(() => amended("decrease", "2027-04-15", 15)).toThrow(/inside/);
  });
});

describe("AMEND-01 after CP3-6", () => {
  it("stays REVIEW until the person confirms the date from the care plan; the engine never confirms it", () => {
    const moved = amended("decrease", "2026-12-15", 15);
    expect(ruleAMEND01EffectiveDates(moved).map((result) => [result.severity, result.refs.date])).toEqual([["REVIEW", "2027-01-01"]]);
    expect(moved.versions[1]!.dateConfirmed).toBeUndefined();
    expect(ruleAMEND01EffectiveDates(amended("increase", "2026-12-15", 45))).toHaveLength(1);
  });

  it("emits nothing for an amendment whose date the person confirmed", () => {
    expect(ruleAMEND01EffectiveDates(amended("increase", "2026-12-15", 45, { dateConfirmed: true }))).toEqual([]);
  });
});
