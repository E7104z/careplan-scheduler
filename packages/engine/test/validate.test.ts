import { describe, expect, it } from "vitest";
import {
  MO_2026_07,
  validatePlan,
  validateSchedule,
  type AuthorizedTask,
  type ServiceAuthorization,
  type ValidatePlanInput,
  type ValidateScheduleInput,
  type ScheduleTemplate,
  type TemplateEntry,
  type Weekday,
} from "../src/index.js";

function task(id: string, minPerDay: number, daysPerWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7): AuthorizedTask {
  return { id, serviceAuthId: "auth-1", taskCode: id.toUpperCase(), name: id, minPerDay, daysPerWeek };
}

function entry(taskId: string, weekday: number, minutes: number): TemplateEntry {
  return { taskId, weekday: weekday as Weekday, minutes };
}

function tc01Template(): ScheduleTemplate {
  return {
    id: "tpl-tc01",
    participantId: "P-TEST-01",
    start: "2025-09-01",
    end: "2026-08-31",
    rulePackVersion: "mo-2026-07",
    entries: [
      entry("bathing", 1, 30),
      entry("bathing", 3, 30),
      entry("bathing", 5, 30),
      entry("toileting", 0, 15),
      entry("toileting", 1, 15),
      entry("toileting", 2, 15),
      entry("toileting", 3, 15),
      entry("toileting", 4, 15),
      entry("toileting", 5, 15),
      entry("toileting", 6, 15),
      entry("meals", 0, 45),
      entry("meals", 1, 45),
      entry("meals", 2, 45),
      entry("meals", 3, 45),
      entry("meals", 4, 45),
      entry("meals", 5, 45),
      entry("meals", 6, 45),
      entry("laundry", 2, 30),
      entry("laundry", 4, 30),
      entry("kitchen", 0, 10),
      entry("kitchen", 6, 10),
    ],
  };
}

const RANKS = { BLOCK: 0, REVIEW: 1, WARN: 2, INFO: 3 } as const;

describe("validateSchedule", () => {
  it("TC-01: matching template has no BLOCK and no REVIEW for September 2025", () => {
    const results = validateSchedule({
      pack: MO_2026_07,
      authorizations: [
        {
          id: "auth-1",
          participantId: "P-TEST-01",
          program: "CDS",
          serviceCode: "T1019U2",
          start: "2025-09-01",
          end: "2026-08-31",
          state: "active",
          suspensions: [],
          revision: 1,
          tasks: [
            task("bathing", 30, 3),
            task("toileting", 15, 7),
            task("meals", 45, 7),
            task("laundry", 30, 2),
            task("kitchen", 10, 2),
          ],
        },
      ],
      monthlyAuthorizations: [{ serviceAuthId: "auth-1", month: "2025-09", units: 177, source: "fusion", revision: 1 }],
      template: tc01Template(),
      exceptions: [],
      visits: [],
      caregivers: [],
      enrollments: [],
      months: ["2025-09"],
      tenantWorkweekStart: 1,
    });

    expect(results.filter((r) => r.severity === "BLOCK")).toEqual([]);
    expect(results.filter((r) => r.severity === "REVIEW")).toEqual([]);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.rulePackVersion === "mo-2026-07")).toBe(true);
  });

  it("returns results ordered BLOCK, REVIEW, WARN, INFO", () => {
    const results = validateSchedule({
      pack: MO_2026_07,
      authorizations: [
        {
          id: "auth-ilw",
          participantId: "P-TEST-01",
          program: "ILW",
          serviceCode: "T1019U6",
          start: "2026-01-01",
          end: "2026-12-31",
          state: "pending_approval",
          suspensions: [],
          revision: 1,
          tasks: [task("bathing", 30, 3)],
        },
      ],
      monthlyAuthorizations: [],
      template: {
        id: "tpl-1",
        participantId: "P-TEST-01",
        start: "2026-01-01",
        end: "2026-12-31",
        rulePackVersion: "mo-2026-07",
        entries: [
          entry("bathing", 1, 30),
          entry("bathing", 3, 30),
        ],
      },
      exceptions: [],
      visits: [],
      caregivers: [],
      enrollments: [],
      months: ["2026-01"],
      tenantWorkweekStart: 0,
    });

    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1]!.severity;
      const curr = results[i]!.severity;
      expect(RANKS[prev]).toBeLessThanOrEqual(RANKS[curr]);
    }
    expect(results.some((r) => r.severity === "BLOCK")).toBe(true);
    expect(results.some((r) => r.severity === "WARN")).toBe(true);
  });
});

/** An AGENCY_PC plan with no referral date: CON-13 has nothing to check it against. */
function agencyPlan(): ValidatePlanInput {
  const auth: ServiceAuthorization = {
    id: "auth-1",
    participantId: "P-TEST-01",
    program: "AGENCY_PC",
    serviceCode: "T1019",
    start: "2025-09-01",
    end: "2026-08-31",
    state: "active",
    suspensions: [],
    revision: 1,
    tasks: [task("bathing", 30, 3), task("toileting", 15, 7), task("meals", 45, 7), task("laundry", 30, 2), task("kitchen", 10, 2)],
  };
  return {
    pack: MO_2026_07,
    authorizations: [auth],
    monthlyAuthorizations: [{ serviceAuthId: "auth-1", month: "2025-09", units: 177, source: "fusion", revision: 1 }],
    template: tc01Template(),
    exceptions: [],
    months: ["2025-09", "2025-10"],
  };
}

const NO_VISITS: Pick<ValidateScheduleInput, "visits" | "caregivers" | "enrollments" | "tenantWorkweekStart"> = {
  visits: [],
  caregivers: [],
  enrollments: [],
  tenantWorkweekStart: 0,
};

describe("validatePlan", () => {
  it("leaves out the visit rules: no CON-13 REVIEW for an agency plan without a referral date", () => {
    const plan = agencyPlan();
    expect(validateSchedule({ ...plan, ...NO_VISITS }).some((r) => r.ruleId === "CON-13")).toBe(true);
    expect(validatePlan(plan).some((r) => r.ruleId === "CON-13")).toBe(false);
  });

  it("gives every other result validateSchedule gives with no visits, in the same order, stamped the same", () => {
    const plan = agencyPlan();
    const withVisitRules = validateSchedule({ ...plan, ...NO_VISITS });
    expect(validatePlan(plan)).toEqual(withVisitRules.filter((r) => r.ruleId !== "CON-13"));
    expect(validatePlan(plan).length).toBeGreaterThan(0);
  });

  it("CON-09 on the expanded template: ILW always needs review; over 49 hours every week is BLOCK (Amendment B, E-02)", () => {
    const ilw = (minPerDay: number): ValidatePlanInput => ({
      pack: MO_2026_07,
      authorizations: [
        {
          id: "auth-1", participantId: "P-TEST-01", program: "ILW", serviceCode: "T1019U6",
          start: "2026-11-01", end: "2026-12-31", state: "active", suspensions: [], revision: 1,
          tasks: [task("care", minPerDay, 7)],
        },
      ],
      monthlyAuthorizations: [],
      template: {
        id: "tpl-1", participantId: "P-TEST-01", start: "2026-11-01", end: "2026-12-31", rulePackVersion: "mo-2026-07",
        entries: ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => entry("care", weekday, minPerDay)),
      },
      exceptions: [],
      months: ["2026-11", "2026-12"],
    });
    // 420 min a day = 49 hours a week exactly: the REVIEW only, with both figures.
    const exact = validatePlan(ilw(420)).filter((r) => r.ruleId === "CON-09");
    expect(exact).toEqual([
      expect.objectContaining({
        severity: "REVIEW",
        message: "Highest Sunday-Saturday week 49 h (week of 2026-11-01); highest 7-day stretch 49 h (2026-11-01 to 2026-11-07)",
        refs: { serviceAuthId: "auth-1" },
      }),
    ]);
    // 430 min a day = 50 h 10 min in any seven days of Nov and Dec 2026: BLOCK, and the REVIEW.
    const over = validatePlan(ilw(430)).filter((r) => r.ruleId === "CON-09");
    expect(over.map((r) => r.severity)).toEqual(["BLOCK", "REVIEW"]);
    expect(over[0]!.refs).toEqual({ serviceAuthId: "auth-1" });
    expect(over[1]!.message).toContain("50 h 10 min");
  });
});

