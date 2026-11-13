import { describe, expect, it } from "vitest";
import {
  combinedRespiteUnits,
  coverageBlockUnits,
  ruleAUTH09Ceiling,
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
