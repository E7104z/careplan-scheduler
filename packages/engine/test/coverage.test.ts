import { describe, expect, it } from "vitest";
import {
  combinedRespiteUnits,
  coverageBlockUnits,
  elapsedMinutes,
  ruleAUTH09Ceiling,
  splitByDate,
  type CoverageBlock,
  type MonthlyAuthorization,
  type ServiceAuthorization,
} from "../src/index.js";

function auth(overrides: Partial<ServiceAuthorization> = {}): ServiceAuthorization {
  return {
    id: "a-1",
    participantId: "P-TEST-01",
    program: "RESPITE",
    serviceCode: "S5150",
    start: "2026-11-01",
    end: "2026-12-31",
    state: "active",
    suspensions: [],
    revision: 1,
    tasks: [],
    ...overrides,
  };
}

function monthly(serviceAuthId: string, month: string, units: number): MonthlyAuthorization {
  return { serviceAuthId, month, units, source: "fusion", revision: 1 };
}

function block(id: string, start: string, end: string): CoverageBlock {
  return { id, serviceAuthId: "a-1", start, end };
}

describe("combinedRespiteUnits (AUTH-09 combined figure)", () => {
  it("sums Basic + Advanced across authorizations for one month", () => {
    const basic = auth({ id: "a-basic", serviceCode: "S5150" });
    const advanced = auth({ id: "a-adv", serviceCode: "S5150TF" });
    expect(
      combinedRespiteUnits(
        [basic, advanced],
        [monthly("a-basic", "2026-11", 500), monthly("a-adv", "2026-11", 500)],
        "2026-11",
      ),
    ).toBe(1000);
  });

  it("only counts the month asked for", () => {
    const basic = auth({ id: "a-basic", serviceCode: "S5150" });
    expect(
      combinedRespiteUnits(
        [basic],
        [monthly("a-basic", "2026-11", 500), monthly("a-basic", "2026-12", 400)],
        "2026-11",
      ),
    ).toBe(500);
  });

  it("is 0 when no authorization is respite", () => {
    const cds = auth({ id: "a-cds", program: "CDS", serviceCode: "T1019U2" });
    expect(combinedRespiteUnits([cds], [monthly("a-cds", "2026-11", 500)], "2026-11")).toBe(0);
  });
});

describe("coverageBlockUnits (respite coverage blocks)", () => {
  it("converts a start/end span of care to whole 15-minute units", () => {
    expect(coverageBlockUnits(block("b1", "2026-11-05T13:00", "2026-11-05T17:00"))).toBe(16); // 4 h
    expect(coverageBlockUnits(block("b2", "2026-11-05T08:00", "2026-11-05T08:30"))).toBe(2); // 30 min
  });

  it("floors to whole units, so a block under 15 minutes is 0 units", () => {
    expect(coverageBlockUnits(block("b3", "2026-11-05T08:00", "2026-11-05T08:10"))).toBe(0);
  });

  it("CP4-4: a six-hour shift is 24 units, and an eight-hour overnight shift is 32", () => {
    expect(coverageBlockUnits(block("b4", "2026-11-05T10:00", "2026-11-05T16:00"))).toBe(24);
    expect(coverageBlockUnits(block("b5", "2026-11-05T22:00", "2026-11-06T06:00"))).toBe(32);
  });

  it("CP4-4: partial minutes are kept rather than silently discarded", () => {
    // 6 h 10 m = 370 minutes: 24 whole units, 10 minutes left over.
    expect(elapsedMinutes("2026-11-05T10:00", "2026-11-05T16:10")).toBe(370);
    expect(coverageBlockUnits(block("b6", "2026-11-05T10:00", "2026-11-05T16:10"))).toBe(24);
  });

  it("CP4-4: a block crossing two months allocates its minutes to the right dates", () => {
    expect(elapsedMinutes("2026-07-31T22:00", "2026-08-01T06:00")).toBe(480);
    expect(splitByDate("2026-07-31T22:00", "2026-08-01T06:00")).toEqual({ "2026-07-31": 120, "2026-08-01": 360 });
  });
});

describe("AUTH-09 on the combined figure", () => {
  it("BLOCKs Basic 500 + Advanced 500 over the shared 868", () => {
    const basic = auth({ id: "a-basic", serviceCode: "S5150" });
    const advanced = auth({ id: "a-adv", serviceCode: "S5150TF" });
    const results = ruleAUTH09Ceiling([basic, advanced], [
      monthly("a-basic", "2026-11", 500),
      monthly("a-adv", "2026-11", 500),
    ]);
    expect(results.some((r) => r.ruleId === "AUTH-09" && r.severity === "BLOCK")).toBe(true);
  });

  it("does not BLOCK Basic 400 + Advanced 400 within the shared 868", () => {
    const basic = auth({ id: "a-basic", serviceCode: "S5150" });
    const advanced = auth({ id: "a-adv", serviceCode: "S5150TF" });
    const results = ruleAUTH09Ceiling([basic, advanced], [
      monthly("a-basic", "2026-11", 400),
      monthly("a-adv", "2026-11", 400),
    ]);
    expect(results.some((r) => r.ruleId === "AUTH-09" && r.severity === "BLOCK")).toBe(false);
  });
});
