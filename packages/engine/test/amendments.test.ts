import { describe, expect, it } from "vitest";
import {
  addVersion,
  chainOf,
  expandChainMonth,
  expandMonth,
  ruleAMEND01EffectiveDates,
  ruleById,
  versionOn,
  type AuthorizationChain,
  type ScheduleTemplate,
  type ServiceAuthorization,
} from "../src/index.js";

// AMEND-01 groundwork (CP2-7): a chain of effective-dated versions. P-TEST data only.
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

/** The original plan (30 minutes a day), then an increase to 45 from Dec 15, 2026. */
function twoVersions(): AuthorizationChain {
  return addVersion(chainOf(AUTH, template(30)), {
    amendmentId: "amend-1", direction: "increase", effectiveFrom: "2026-12-15", recordedOn: "2026-12-10",
    authorization: { ...AUTH, revision: 2, tasks: [{ ...AUTH.tasks[0]!, minPerDay: 45 }] },
    template: template(45, "tpl-2"),
  });
}

describe("AMEND-01: an authorization as a chain of effective-dated versions", () => {
  it("a plan with no amendment is one version and expands exactly as before", () => {
    const chain = chainOf(AUTH, template(30));
    expect(chain.versions).toHaveLength(1);
    expect(chain.versions[0]).toMatchObject({ amendmentId: null, direction: null, effectiveFrom: "2026-11-01" });
    const before = expandMonth(template(30), [], 2026, 12, AUTH.start, AUTH.end);
    const occurrences = expandChainMonth(chain, [], 2026, 12);
    expect(occurrences).toHaveLength(31);
    for (const occurrence of occurrences) {
      expect(occurrence.amendmentId).toBeNull();
      expect(occurrence.minutes).toBe(before[occurrence.date]!.bath);
    }
    expect(ruleAMEND01EffectiveDates(chain)).toEqual([]);
  });

  it("occurrences before the effective date stay on the old version; from it, on the new", () => {
    const occurrences = expandChainMonth(twoVersions(), [], 2026, 12);
    expect(occurrences).toHaveLength(31);
    const on = (date: string) => occurrences.find((occurrence) => occurrence.date === date)!;
    expect(on("2026-12-14")).toEqual({ date: "2026-12-14", taskId: "bath", minutes: 30, amendmentId: null, serviceAuthId: "auth-1" });
    expect(on("2026-12-15")).toEqual({ date: "2026-12-15", taskId: "bath", minutes: 45, amendmentId: "amend-1", serviceAuthId: "auth-1" });
    expect(occurrences.filter((occurrence) => occurrence.amendmentId === null)).toHaveLength(14);
    expect(occurrences.filter((occurrence) => occurrence.amendmentId === "amend-1")).toHaveLength(17);
  });

  it("a later amendment never rewrites a month that came before it", () => {
    const original = expandChainMonth(chainOf(AUTH, template(30)), [], 2026, 11);
    expect(expandChainMonth(twoVersions(), [], 2026, 11)).toEqual(original);
  });

  it("versionOn gives the version in effect on a date, and none outside the authorization", () => {
    const chain = twoVersions();
    expect(versionOn(chain, "2026-12-14")?.amendmentId).toBeNull();
    expect(versionOn(chain, "2026-12-15")?.amendmentId).toBe("amend-1");
    expect(versionOn(chain, "2027-04-30")?.amendmentId).toBe("amend-1");
    expect(versionOn(chain, "2026-10-31")).toBeNull();
    expect(versionOn(chain, "2027-05-01")).toBeNull();
  });

  it("a version with an end date stops there, and the one before it does not come back", () => {
    const chain = addVersion(chainOf(AUTH, template(30)), {
      amendmentId: "amend-1", direction: "reduction-immediate", effectiveFrom: "2026-12-15", effectiveTo: "2026-12-20",
      authorization: AUTH, template: template(15, "tpl-2"),
    });
    expect(versionOn(chain, "2026-12-20")?.amendmentId).toBe("amend-1");
    expect(versionOn(chain, "2026-12-21")).toBeNull();
    expect(expandChainMonth(chain, [], 2026, 12).map((occurrence) => occurrence.date).at(-1)).toBe("2026-12-20");
  });

  it("stores the direction, the effective date and the amendment date without applying a rule to them", () => {
    const version = twoVersions().versions[1]!;
    expect(version).toMatchObject({ direction: "increase", effectiveFrom: "2026-12-15", recordedOn: "2026-12-10" });
    // A decrease dated mid-month is stored as entered: the first-of-next-month behavior is Phase 3.
    const decrease = addVersion(chainOf(AUTH, template(30)), {
      amendmentId: "amend-2", direction: "decrease", effectiveFrom: "2026-12-15",
      authorization: AUTH, template: template(15, "tpl-2"),
    });
    expect(versionOn(decrease, "2026-12-15")?.amendmentId).toBe("amend-2");
  });

  it("refuses a version that would change history or reuse an amendment id", () => {
    const chain = twoVersions();
    const next = { direction: "decrease" as const, authorization: AUTH, template: template(15, "tpl-3") };
    expect(() => addVersion(chain, { ...next, amendmentId: "amend-1", effectiveFrom: "2027-01-01" })).toThrow(/already/);
    expect(() => addVersion(chain, { ...next, amendmentId: "amend-2", effectiveFrom: "2026-12-15" })).toThrow(/after/);
    expect(() => addVersion(chain, { ...next, amendmentId: "amend-2", effectiveFrom: "2026-12-01" })).toThrow(/after/);
    expect(() => addVersion(chain, { ...next, amendmentId: "amend-2", effectiveFrom: "2027-05-01" })).toThrow(/inside/);
    // The chain it was given is untouched.
    expect(chain.versions.map((version) => version.amendmentId)).toEqual([null, "amend-1"]);
  });

  it("exceptions apply on their date, to the version in effect that day", () => {
    const exception = {
      id: "ex-1", participantId: "P-TEST-01", date: "2026-12-16", taskId: "bath", minutesDelta: -15,
      reason: "one day", author: "tester", createdAt: "2026-12-01",
    };
    const occurrences = expandChainMonth(twoVersions(), [exception], 2026, 12);
    expect(occurrences.find((occurrence) => occurrence.date === "2026-12-16")).toMatchObject({ minutes: 30, amendmentId: "amend-1" });
    expect(occurrences.find((occurrence) => occurrence.date === "2026-12-17")).toMatchObject({ minutes: 45 });
  });
});

describe("AMEND-01: a schedule that spans an amendment is under review", () => {
  it("emits REVIEW with the amendment's date and its source", () => {
    expect(ruleAMEND01EffectiveDates(twoVersions())).toEqual([
      {
        ruleId: "AMEND-01",
        severity: "REVIEW",
        message: "amendment effective date needs confirmation, Manual 4.20",
        refs: { serviceAuthId: "auth-1", date: "2026-12-15", month: "2026-12" },
      },
    ]);
    const entry = ruleById("AMEND-01");
    expect(entry?.severities).toEqual(["REVIEW"]);
    expect(entry?.source).toMatch(/Manual 4\.20/);
  });

  it("emits one REVIEW for each amendment, never a pass", () => {
    const chain = addVersion(twoVersions(), {
      amendmentId: "amend-2", direction: "decrease", effectiveFrom: "2027-02-01",
      authorization: AUTH, template: template(15, "tpl-3"),
    });
    const results = ruleAMEND01EffectiveDates(chain);
    expect(results.map((result) => result.refs.date)).toEqual(["2026-12-15", "2027-02-01"]);
    expect(results.every((result) => result.severity === "REVIEW")).toBe(true);
  });
});
