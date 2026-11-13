import { describe, expect, it } from "vitest";
import {
  MO_2026_07,
  addMinutesLocal,
  elapsedMinutes,
  ruleById,
  ruleCON01SameServiceOverlap,
  ruleCON02DifferentServiceOverlap,
  ruleCON03RespiteOverlap,
  splitByDate,
  type ScheduledService,
  type Visit,
} from "../src/index.js";

// CP4-1: visits with clock times, and what the overlap rules say when there are none.
const PACK = MO_2026_07;
const NO_TIMES = "No clock times yet, so overlaps can't be checked";

function service(serviceAuthId: string, serviceCode: Visit["serviceCode"], hasClockTimes: boolean): ScheduledService {
  return { serviceAuthId, serviceCode, hasClockTimes };
}

function visit(id: string, serviceCode: Visit["serviceCode"], start: string, minutes: number): Visit {
  return { id, participantId: "P-TEST-01", caregiverId: "", serviceCode, start, end: addMinutesLocal(start, minutes), taskIds: [] };
}

describe("addMinutesLocal: where a visit ends (SCH-15)", () => {
  it("adds real minutes on an ordinary day", () => {
    expect(addMinutesLocal("2026-05-12T09:00", 150)).toBe("2026-05-12T11:30");
  });

  it("a visit past midnight ends on the next date, and splits by date", () => {
    const end = addMinutesLocal("2026-05-12T22:00", 480);
    expect(end).toBe("2026-05-13T06:00");
    expect(splitByDate("2026-05-12T22:00", end)).toEqual({ "2026-05-12": 120, "2026-05-13": 360 });
  });

  it("on the Sunday clocks go forward, a visit is still as long as its minutes", () => {
    // Mar 8, 2026: 2:00 AM becomes 3:00 AM. Three hours from 1:00 AM end at 5:00 AM.
    const end = addMinutesLocal("2026-03-08T01:00", 180);
    expect(end).toBe("2026-03-08T05:00");
    expect(elapsedMinutes("2026-03-08T01:00", end)).toBe(180);
  });

  it("on the Sunday clocks go back, a visit is still as long as its minutes", () => {
    // Nov 1, 2026: 2:00 AM becomes 1:00 AM. Three hours from 12:30 AM end at 2:30 AM.
    const end = addMinutesLocal("2026-11-01T00:30", 180);
    expect(end).toBe("2026-11-01T02:30");
    expect(elapsedMinutes("2026-11-01T00:30", end)).toBe(180);
  });
});

describe("the overlap rules never pass on missing clock times", () => {
  it("CON-01: a service with no clock times is REVIEW, in the engine's own words", () => {
    expect(ruleCON01SameServiceOverlap([], [service("auth-cds", "T1019U2", false)])).toEqual([
      { ruleId: "CON-01", severity: "REVIEW", message: NO_TIMES, refs: { serviceAuthId: "auth-cds" } },
    ]);
    expect(ruleCON01SameServiceOverlap([], [service("auth-cds", "T1019U2", true)])).toEqual([]);
  });

  it("CON-02: with two services, the one without clock times is REVIEW; one service alone has nothing to overlap", () => {
    const two = [service("auth-pc", "T1019", true), service("auth-hc", "S5130", false)];
    expect(ruleCON02DifferentServiceOverlap([], PACK, two)).toEqual([
      { ruleId: "CON-02", severity: "REVIEW", message: NO_TIMES, refs: { serviceAuthId: "auth-hc" } },
    ]);
    expect(ruleCON02DifferentServiceOverlap([], PACK, [service("auth-hc", "S5130", false)])).toEqual([]);
  });

  it("CON-03: with respite and another service, any service without clock times is REVIEW", () => {
    const withRespite = [service("auth-resp", "S5150", true), service("auth-hc", "S5130", false)];
    expect(ruleCON03RespiteOverlap([], withRespite).map((result) => [result.ruleId, result.severity, result.refs.serviceAuthId])).toEqual([
      ["CON-03", "REVIEW", "auth-hc"],
    ]);
    // No respite in the plan, or respite alone: CON-03 has nothing to check.
    expect(ruleCON03RespiteOverlap([], [service("auth-pc", "T1019", false), service("auth-hc", "S5130", false)])).toEqual([]);
    expect(ruleCON03RespiteOverlap([], [service("auth-resp", "S5150", false)])).toEqual([]);
  });

  it("with every clock time set and no overlap, nothing is raised", () => {
    const services = [service("auth-pc", "T1019", true), service("auth-hc", "S5130", true)];
    const visits = [visit("v1", "T1019", "2026-05-12T09:00", 120), visit("v2", "S5130", "2026-05-12T13:00", 60)];
    expect([
      ...ruleCON01SameServiceOverlap(visits, services),
      ...ruleCON02DifferentServiceOverlap(visits, PACK, services),
      ...ruleCON03RespiteOverlap(visits, services),
    ]).toEqual([]);
  });

  it("the rules still read visits as before when no service list is given", () => {
    const overlapping = [visit("v1", "T1019U2", "2026-05-12T09:00", 120), visit("v2", "T1019U2", "2026-05-12T10:00", 60)];
    expect(ruleCON01SameServiceOverlap(overlapping).map((result) => result.severity)).toEqual(["BLOCK"]);
    const respite = [visit("v1", "S5150", "2026-05-12T09:00", 120), visit("v2", "T1019", "2026-05-12T10:00", 60)];
    expect(ruleCON03RespiteOverlap(respite).map((result) => result.severity)).toEqual(["BLOCK"]);
  });

  it("the catalog lists REVIEW for all three", () => {
    for (const id of ["CON-01", "CON-02", "CON-03"]) expect(ruleById(id)?.severities, id).toContain("REVIEW");
  });
});
