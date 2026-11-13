import { describe, expect, it } from "vitest";
import {
  placeOneTimeOccurrences,
  type DatedOccurrence,
  type MonthlyAuthorization,
  type ServiceAuthorization,
} from "../src/index.js";

function auth(overrides: Partial<ServiceAuthorization> = {}): ServiceAuthorization {
  return {
    id: "chore-auth-1",
    participantId: "P-TEST-01",
    program: "CHORE",
    serviceCode: "S5120",
    start: "2026-11-01",
    end: "2026-12-31",
    state: "active",
    suspensions: [],
    revision: 1,
    tasks: [],
    ...overrides,
  };
}

function fusion(serviceAuthId: string, month: string, units: number): MonthlyAuthorization {
  return { serviceAuthId, month, units, source: "fusion", revision: 1 };
}

function occ(id: string, date: string, minutes: number): DatedOccurrence {
  return { id, serviceAuthId: "chore-auth-1", date, minutes };
}

describe("placeOneTimeOccurrences (ADW-05)", () => {
  it("places dated occurrences on their own dates, never a weekly template", () => {
    const result = placeOneTimeOccurrences(
      auth(),
      [occ("a", "2026-11-03", 60), occ("b", "2026-11-10", 45), occ("c", "2026-11-24", 30)],
      [],
    );

    expect(result.placed.map((o) => [o.date, o.minutes])).toEqual([
      ["2026-11-03", 60],
      ["2026-11-10", 45],
      ["2026-11-24", 30],
    ]);
    // No repetition: exactly the three dates, never expanded into a weekly pattern.
    expect(result.placed).toHaveLength(3);
  });

  it("draws down the monthly balance and caps the total at the Fusion figure", () => {
    const result = placeOneTimeOccurrences(
      auth(),
      [
        occ("a", "2026-11-03", 60),
        occ("b", "2026-11-10", 90),
        occ("c", "2026-11-17", 120),
        occ("d", "2026-11-24", 90),
      ],
      [fusion("chore-auth-1", "2026-11", 20)], // 20 units = 300 minutes
    );

    expect(result.byMonth).toEqual([
      { month: "2026-11", authorizedUnits: 20, budgetMinutes: 300, scheduledMinutes: 300, remainingMinutes: 0 },
    ]);
    // 60 + 90 + 120 + 30 = 300: the last occurrence is trimmed 90 -> 30.
    expect(result.placed.map((o) => o.minutes)).toEqual([60, 90, 120, 30]);
    expect(result.placed[3]!.trimmedMinutes).toBe(60);
  });

  it("keeps the earliest chore work and cuts the last occurrence when the month runs out", () => {
    const result = placeOneTimeOccurrences(
      auth(),
      [occ("a", "2026-11-03", 120), occ("b", "2026-11-17", 120)],
      [fusion("chore-auth-1", "2026-11", 10)], // 150 minutes
    );

    expect(result.placed.map((o) => [o.id, o.minutes])).toEqual([
      ["a", 120],
      ["b", 30],
    ]);
    expect(result.placed[1]!.trimmedMinutes).toBe(90);
  });

  it("with no Fusion figure, occurrences are an editable record (no cap)", () => {
    const result = placeOneTimeOccurrences(
      auth(),
      [occ("a", "2026-11-03", 75), occ("b", "2026-11-10", 45)],
      [],
    );

    expect(result.placed.map((o) => o.minutes)).toEqual([75, 45]);
    expect(result.byMonth).toEqual([
      { month: "2026-11", authorizedUnits: 0, budgetMinutes: null, scheduledMinutes: 120, remainingMinutes: null },
    ]);
  });

  it("leaves occurrences outside the authorization or during a suspension out", () => {
    const result = placeOneTimeOccurrences(
      auth({
        start: "2026-11-01",
        end: "2026-11-30",
        suspensions: [{ start: "2026-11-10", end: "2026-11-12" }],
      }),
      [occ("a", "2026-10-30", 60), occ("b", "2026-11-11", 60), occ("c", "2026-11-15", 60)],
      [],
    );

    expect(result.placed.map((o) => o.id)).toEqual(["c"]);
  });

  it("sums minutes only within the month each occurrence lands in", () => {
    const result = placeOneTimeOccurrences(
      auth(),
      [occ("a", "2026-11-28", 60), occ("b", "2026-12-02", 60)],
      [fusion("chore-auth-1", "2026-11", 3), fusion("chore-auth-1", "2026-12", 3)], // 45 minutes each
    );

    expect(result.byMonth.map((m) => [m.month, m.scheduledMinutes, m.remainingMinutes])).toEqual([
      ["2026-11", 45, 0],
      ["2026-12", 45, 0],
    ]);
    expect(result.placed.map((o) => [o.date, o.minutes])).toEqual([
      ["2026-11-28", 45],
      ["2026-12-02", 45],
    ]);
  });
});
