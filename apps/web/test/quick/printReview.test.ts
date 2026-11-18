import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { planSheets } from "../../src/features/quick-schedule/planSheet";
import type { ScheduleSheet } from "../../src/features/quick-schedule/scheduleSheet";
import type { CarePlan } from "../../src/features/quick-schedule/types";
import fixtureQ from "@fixtures/fusion/Q-care-plan-report-apc-rn.txt?raw";

// The Nov 17, 2026 review of a real printout: APC and PC - Agency on four days, two RN
// authorizations (Eval APC Plan 2 and Train APC 1 against 2 a month; Eval APC Plan 1), a plan
// ending Nov 30, made on Nov 17. Fixture Q has that plan's layout with made-up identifiers.
const TODAY = "2026-11-17";

function planQ(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureQ), MO_2026_07, new Date(`${TODAY}T12:00:00-06:00`));
  if (outcome.kind !== "ready") throw new Error("Expected a ready outcome");
  return outcome.plan;
}

function sheetsFor(plan: CarePlan, audience: "client" | "agency" = "client"): ScheduleSheet[] {
  const models = plan.services.map((state) => buildQuickModel(state, MO_2026_07));
  const sheets = planSheets(plan, models, MO_2026_07, TODAY, audience);
  if (!Array.isArray(sheets)) throw new Error("Expected the whole plan and each service");
  return sheets;
}

const fact = (sheet: ScheduleSheet, label: string) => sheet.facts.find((item) => item.label === label)?.value;

describe("printout review, Nov 17, 2026", () => {
  const plan = planQ();
  const [overview, apc, pc] = sheetsFor(plan);

  it("says which copy it is: the participant's, or the agency's with projected accruals", () => {
    expect(sheetsFor(plan).map((sheet) => sheet.copy)).toEqual(["Participant copy", "Participant copy", "Participant copy"]);
    const agency = sheetsFor(plan, "agency");
    expect(agency.map((sheet) => sheet.copy)).toEqual(["Agency copy", "Agency copy", "Agency copy"]);
    // PC leaves 10 minutes a day over whole units: 17 days, 170 minutes, 11 units and 5 minutes.
    expect(agency[2]!.accruals?.map((a) => [a.month, a.accruedMinutes, a.potentialAmvUnits, a.remainingMinutes])).toEqual([
      ["2026-11", 170, 11, 5],
    ]);
  });

  it("groups the nurse visits by authorization, every task with its visits a month, never once per month", () => {
    expect(fact(overview!, "Nurse visits")).toBe("2 authorizations, Jun to Nov 2026");
    expect(overview!.authorizedNote).toBe(
      "Each scheduled service has its own page after this one, with its units month by month. Nurse visits are " +
        "authorized by month and aren't in the week; their page is at the end: RN, PA 20260000000052: Eval APC Plan " +
        "2 a month and Train APC 1 a month, 2 visits a month authorized; RN, PA 20260000000054: Eval APC Plan, 1 " +
        "visit a month authorized. Each month's figures count all of its days, including the 16 before " +
        "this schedule was made on Nov 17, 2026.",
    );
    expect(overview!.nurseVisits).toEqual([
      {
        title: "RN · PA 20260000000052",
        detail: "T1001 · TEST HOME CARE LLC",
        tasks: "Eval APC Plan 2 a month, Train APC 1 a month",
        months: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((month) => ({ label: `${month} 2026`, authorized: "2", placed: "–" })),
        review:
          "The tasks add up to 3 visits a month (Eval APC Plan 2, Train APC 1), but Fusion authorized 2 a month. " +
          "Ask the care manager which is right; the plan keeps Fusion's 2.",
      },
      {
        title: "RN · PA 20260000000054",
        detail: "T1001 · TEST HOME CARE LLC",
        tasks: "Eval APC Plan 1 a month",
        months: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((month) => ({ label: `${month} 2026`, authorized: "1", placed: "–" })),
        review: null,
      },
    ]);
  });

  it("lists what still needs review on the overview, and doesn't call it ready", () => {
    expect(overview!.checks).toEqual([
      {
        severity: "REVIEW",
        label: "Needs review",
        title: "No clock times yet, so overlaps can't be checked",
        context: "APC and PC - Agency: add a start time for each care day of each service, so its visits can be checked against each other.",
      },
      {
        severity: "REVIEW",
        label: "Needs review",
        title: "Nurse visit tasks don't add up to the authorization",
        context: "RN, PA 20260000000052: 3 visits a month in its tasks, 2 authorized. Ask the care manager which is right.",
      },
    ]);
    expect(overview!.status).toEqual({
      title: "2 to review",
      detail: "No service breaks a rule we check. 2 items need review: see Checks.",
      blocked: false,
      review: true,
    });
  });

  it("says when the care plan ends soon", () => {
    expect(overview!.warning).toBe(
      "This care plan ends Nov 30, 2026, 13 days after this schedule was made. Care after that date needs a new care plan; check with the care manager.",
    );
  });

  it("says the schedule covers whole months, not from the day it was made", () => {
    expect(fact(overview!, "Schedule covers")).toBe("Nov 1 to Nov 30, 2026");
    expect(fact(overview!, "Schedule starts")).toBeUndefined();
    expect(fact(apc!, "Schedule covers")).toBe("Nov 1 to Nov 30, 2026");
  });

  it("names APC by its rule pack code and says what Fusion prints", () => {
    expect(fact(apc!, "Service")).toBe("APC · T1019TF (Fusion prints T1019)");
    expect(fact(pc!, "Service")).toBe("PC - Agency · T1019");
  });

  it("says units left over are expected, not missed care", () => {
    expect(apc!.months.map((month) => [month.authorized, month.scheduled, month.left])).toEqual([["114", "102", "12"]]);
    expect(apc!.authorizedNote).toBe(
      "Authorized is Fusion's figure for each month. Left is units authorized but not scheduled, not missed care: " +
        "Nov 2026 has 17 care days, each with every task's minutes, and all 114 units would take about 19. Each " +
        "month's figures count all of its days, including the 16 before this schedule was made on Nov 17, 2026.",
    );
    expect(pc!.authorizedNote).toContain("Nov 2026 has 17 care days, each with every task's minutes, and all 336 units would take about 19.");
  });
});

describe("printout review: a plan with clock times and nothing to review", () => {
  it("is ready to use, with no end-of-plan notice months before the end", () => {
    const plan = planQ();
    for (const state of plan.services) {
      state.plan = { ...state.plan, end: "2027-05-31" };
    }
    plan.visits = [];
    // APC from 8:00 (90 minutes), PC from 10:00: no overlap on any care day.
    plan.services[0]!.startTimes = { "1": "08:00", "3": "08:00", "5": "08:00", "6": "08:00" };
    plan.services[1]!.startTimes = { "1": "10:00", "3": "10:00", "5": "10:00", "6": "10:00" };
    const [overview, apc] = sheetsFor(plan);
    expect(overview!.checks).toEqual([]);
    expect(overview!.status).toMatchObject({ title: "Ready to use", blocked: false, review: false });
    expect(overview!.warning).toBeNull();
    expect(apc!.days[1]!.visit).toBe("8:00 AM, 1 h 30 min");
  });
});
