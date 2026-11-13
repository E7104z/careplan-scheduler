import { describe, expect, it } from "vitest";
import {
  ruleSFC01HcbsExclusivity,
  ruleSFC02SinglePrimary,
  type HcbsPeriod,
} from "../src/index.js";

// CP4-4: SFCW exclusivity (Policy 3.60) and the one-primary rule. Made-up identifiers only.
const SFCW: HcbsPeriod = { id: "auth-sfcw", name: "Structured Family Caregiver", start: "2026-07-01", end: "2026-12-31", hcbs: true };

function hcbs(id: string, name: string, start: string, end: string): HcbsPeriod {
  return { id, name, start, end, hcbs: true };
}

describe("SFC-01: an SFCW authorization can't overlap another HCBS authorization", () => {
  it("blocks each HCBS State Plan or waiver service whose period overlaps SFCW", () => {
    for (const name of ["PC - Agency", "CDS", "Homemaker", "Case Management - ILW"]) {
      const results = ruleSFC01HcbsExclusivity(SFCW, [hcbs("a", name, "2026-09-01", "2026-10-31")]);
      expect(results.map((r) => r.severity)).toEqual(["BLOCK"]);
      expect(results[0]!.message).toContain(name);
    }
  });

  it("permits sequential periods: the prior HCBS ends the day before SFCW starts", () => {
    expect(ruleSFC01HcbsExclusivity(SFCW, [hcbs("a", "PC - Agency", "2026-01-01", "2026-06-30")])).toEqual([]);
  });

  it("blocks when both authorizations include the boundary date", () => {
    const results = ruleSFC01HcbsExclusivity(SFCW, [hcbs("a", "CDS", "2026-05-01", "2026-07-01")]);
    expect(results.some((r) => r.severity === "BLOCK")).toBe(true);
    // A CDS authorization ending July 1 overlaps SFCW starting July 1: the shared date is named.
    expect(results[0]!.refs.date).toBe("2026-07-01");
  });

  it("does not block a non-HCBS service, and does not guess an unknown classification", () => {
    const appointment: HcbsPeriod = { id: "appt", name: "Dental appointment", start: "2026-08-05", end: "2026-08-05", hcbs: false };
    const unknown: HcbsPeriod = { id: "u", name: "Unknown service H2015", start: "2026-08-01", end: "2026-08-31", hcbs: null };
    expect(ruleSFC01HcbsExclusivity(SFCW, [appointment])).toEqual([]);
    const results = ruleSFC01HcbsExclusivity(SFCW, [unknown]);
    expect(results[0]!.severity).toBe("REVIEW");
  });

  it("reviews when dates or classification are missing, and when SFCW's own dates are missing", () => {
    const noDates: HcbsPeriod = { id: "a", name: "PC - Agency", start: null, end: null, hcbs: true };
    expect(ruleSFC01HcbsExclusivity(SFCW, [noDates])[0]!.severity).toBe("REVIEW");
    const noSfcwDates: HcbsPeriod = { id: "auth-sfcw", name: "Structured Family Caregiver", start: null, end: null, hcbs: true };
    expect(ruleSFC01HcbsExclusivity(noSfcwDates, [hcbs("a", "CDS", "2026-09-01", "2026-10-31")])[0]!.severity).toBe("REVIEW");
  });
});

describe("SFC-02: SFCW takes one primary caregiver", () => {
  it("permits one primary with a substitute", () => {
    expect(
      ruleSFC02SinglePrimary([
        { id: "C-1", role: "primary" },
        { id: "C-2", role: "backup" },
      ]),
    ).toEqual([]);
  });

  it("blocks two primaries", () => {
    const results = ruleSFC02SinglePrimary([
      { id: "C-1", role: "primary" },
      { id: "C-2", role: "primary" },
    ]);
    expect(results.map((r) => r.severity)).toEqual(["BLOCK", "BLOCK"]);
  });
});
