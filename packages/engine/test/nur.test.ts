import { describe, expect, it } from "vitest";
import {
  MO_2026_07,
  ruleById,
  ruleNUR01ApcFirstMonth,
  validatePlan,
  type ScheduleTemplate,
  type ServiceAuthorization,
} from "../src/index.js";

// CP3-3 (RN-03): Advanced Personal Care's first-month nurse visits stay under review. P-TEST data.
function auth(serviceCode: ServiceAuthorization["serviceCode"], start: string, id = "auth-apc"): ServiceAuthorization {
  return {
    id, participantId: "P-TEST-01", program: serviceCode === "T1019TF" ? "APC" : "AGENCY_PC", serviceCode,
    start, end: "2027-04-30", state: "active", suspensions: [], revision: 1,
    tasks: [{ id: `${id}-t1`, serviceAuthId: id, taskCode: "CATHETER_HYGIENE", name: "Catheter Hygiene", minPerDay: 15, daysPerWeek: 7 }],
  };
}

const MESSAGE =
  "A new Advanced Personal Care authorization is expected to have two nurse visits in its first month unless an ongoing nurse visit covers it. Check the care plan.";

describe("NUR-01: a new Advanced Personal Care authorization's first month", () => {
  it("emits REVIEW in the first month, with the authorization and the month", () => {
    expect(ruleNUR01ApcFirstMonth([auth("T1019TF", "2026-11-10")], ["2026-11", "2026-12", "2027-01"])).toEqual([
      { ruleId: "NUR-01", severity: "REVIEW", message: MESSAGE, refs: { serviceAuthId: "auth-apc", month: "2026-11" } },
    ]);
  });

  it("emits nothing once the first month is no longer in the schedule", () => {
    expect(ruleNUR01ApcFirstMonth([auth("T1019TF", "2026-11-10")], ["2026-12", "2027-01"])).toEqual([]);
  });

  it("reads the authorization's own first date when the schedule starts later", () => {
    // The schedule covers December on; the authorization itself began in November.
    const clipped = auth("T1019TF", "2026-12-01");
    expect(ruleNUR01ApcFirstMonth([clipped], ["2026-12"], { "auth-apc": "2026-11-10" })).toEqual([]);
    expect(ruleNUR01ApcFirstMonth([clipped], ["2026-12"], { "auth-apc": "2026-12-01" })).toHaveLength(1);
  });

  it("is about Advanced Personal Care by its code only: no other service raises it", () => {
    for (const code of ["T1019", "T1019U2", "T1019U6", "S5130", "T1019U3TF"] as const) {
      expect(ruleNUR01ApcFirstMonth([auth(code, "2026-11-01")], ["2026-11"]), code).toEqual([]);
    }
  });

  it("is REVIEW only: never a block and never a pass", () => {
    expect(ruleById("NUR-01")).toMatchObject({ severities: ["REVIEW"], status: "PARTIAL", area: "Schedule" });
    expect(ruleById("NUR-01")?.source).toMatch(/DHSS has not confirmed/);
  });
});

describe("NUR-01 through validatePlan", () => {
  const apc = auth("T1019TF", "2026-11-01");
  const template: ScheduleTemplate = {
    id: "tpl", participantId: "P-TEST-01", start: apc.start, end: apc.end, rulePackVersion: "mo-2026-07",
    entries: ([0, 1, 2, 3, 4, 5, 6] as const).map((weekday) => ({ taskId: "auth-apc-t1", weekday, minutes: 15 })),
  };
  const input = { pack: MO_2026_07, authorizations: [apc], monthlyAuthorizations: [], template, exceptions: [] };

  it("an APC plan shows the review in its first month and not in later months", () => {
    const first = validatePlan({ ...input, months: ["2026-11", "2026-12"] }).filter((result) => result.ruleId === "NUR-01");
    expect(first.map((result) => [result.severity, result.refs.month, result.rulePackVersion])).toEqual([["REVIEW", "2026-11", "mo-2026-07"]]);
    const later = validatePlan({ ...input, months: ["2026-12"], authorizedStarts: { "auth-apc": "2026-11-01" } });
    expect(later.filter((result) => result.ruleId === "NUR-01")).toEqual([]);
  });
});
