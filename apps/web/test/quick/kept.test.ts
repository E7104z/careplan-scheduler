import { beforeEach, describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { addPage, emptyImportFlow, next, setChoice } from "../../src/features/import/importFlow";
import { coverageLine } from "../../src/features/quick-schedule/PlanOverview";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { otherAmount, otherLines, otherReason } from "../../src/features/quick-schedule/others";
import { loadPlan, PLAN_KEY, savePlan } from "../../src/features/quick-schedule/persistence";
import { planSheets } from "../../src/features/quick-schedule/planSheet";
import type { ScheduleSheet } from "../../src/features/quick-schedule/scheduleSheet";
import type { CarePlan } from "../../src/features/quick-schedule/types";
import fixtureA from "@fixtures/fusion/A-run-together-5day-466.txt?raw";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";
import fixtureG from "@fixtures/fusion/G-care-plan-report-kept.txt?raw";

// IMP-19 / AC-30: nothing read from a care plan is dropped. Fixture G (made up) has one CDS service
// and five authorizations Quick Schedule doesn't place; its plan runs Nov 2026 to Apr 2027.
const TODAY = new Date("2026-10-31T12:00:00-05:00");
/** Inside fixture A's plan (Aug 1, 2025 to Jun 30, 2026). */
const DURING_A = new Date("2026-01-15T12:00:00-06:00");

function ready(text: string, today = TODAY): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), text), MO_2026_07, today);
  if (outcome.kind !== "ready") throw new Error(`Expected a ready outcome: ${JSON.stringify(outcome.issues)}`);
  return outcome.plan;
}

describe("IMP-19 kept authorizations in the care plan", () => {
  it("builds fixture G's one service and keeps its five other authorizations, asking nothing", () => {
    const plan = ready(fixtureG);
    expect(plan.services.map((state) => [state.serviceLabel, state.serviceCode])).toEqual([["PC - CDS", "T1019U2"]]);
    expect(plan.others!.map((other) => [other.label, other.code, other.registryId])).toEqual([
      ["HDM", "S5170", "MO_ADW_HDM"],
      ["ADC", "S5100HC", "MO_ADW_ADC"],
      ["FMS", "T2040U6", "MO_ILW_FMS"],
      ["RN", "T1001U3", "MO_RN_RCF"],
      ["XYZ", "H2015", null],
    ]);
    expect(plan.notes.filter((note) => note.code === "kept")).toHaveLength(5);
  });

  it("counts what was read from the plan itself: fixture G, and fixture F (JOIN-01)", () => {
    expect(coverageLine(ready(fixtureG))).toBe(
      "6 authorizations read: 1 scheduled in the week, 5 kept without a schedule (1 not recognized).",
    );
    expect(coverageLine(ready(fixtureF, new Date("2026-10-21T12:00:00-05:00")))).toBe(
      "5 authorizations read: 3 scheduled in the week, 2 nurse visits by month.",
    );
  });

  it("describes each in its own unit, never as hours", () => {
    const [meals, dayCare, fms, nurse, unknown] = ready(fixtureG).others!;
    expect(otherAmount(meals!)).toBe("62 meals a month, Nov 2026 to Apr 2027");
    expect(otherAmount(dayCare!)).toBe("400 units a month, Nov 2026 to Apr 2027");
    expect(otherAmount(nurse!)).toBe("1 visit in Dec 2026");
    expect([meals, dayCare, fms, nurse, unknown].map((other) => otherReason(other!))).toEqual([
      "Arranged by date", "Arranged by date", "No caregiver time", "Arranged by date", "Not recognized: kept for review",
    ]);
  });

  it("prints them on a one-service plan's page (EXPORT-01)", () => {
    const plan = ready(fixtureG);
    const model = buildQuickModel(plan.services[0]!, MO_2026_07);
    const sheet = planSheets(plan, [model], MO_2026_07, "2026-10-31") as ScheduleSheet;
    expect(sheet.authorizedNote).toContain(` Also in the care plan, not in the week: ${otherLines(plan).join(" ")}`);
    expect(sheet.authorizedNote).toContain("HDM (Home Delivered Meals · S5170): 62 meals a month, Nov 2026 to Apr 2027. Arranged by date.");
    expect(sheet.authorizedNote).toContain("XYZ (Not an Appendix 1 service · H2015): 10 units a month, Nov 2026 to Apr 2027. Not recognized: kept for review.");
  });

  it("prints nurse visits on a one-service plan's page too", () => {
    // Fixture F without its agency block: CDS transportation, two GHEs, and HC turned into meals.
    const text = fixtureF.slice(0, fixtureF.indexOf("Service\tStart")) + fixtureF.slice(fixtureF.indexOf("Date Generated: 10/23/2026 | Page 3 of 7"));
    const plan = ready(text.replace(/^HC\t/m, "XX\t").replace(/S5130/g, "S5170"), new Date("2026-10-21T12:00:00-05:00"));
    expect(plan.services.map((state) => state.serviceLabel)).toEqual(["PC - CDS"]);
    const sheet = planSheets(plan, [buildQuickModel(plan.services[0]!, MO_2026_07)], MO_2026_07, "2026-10-21") as ScheduleSheet;
    // Once per authorization, with its tasks (Nov 17, 2026), and its own page at the end.
    expect(sheet.authorizedNote).toContain(
      "Nurse visits are authorized by month and aren't in the week; their page is at the end: GHE, PA 20260000000013: " +
        "General Health Evaluation, 1 visit a month authorized; GHE, PA 20260000000015: General Health Evaluation, 1 visit a month authorized.",
    );
    expect(sheet.nurseVisits?.map((visit) => visit.title)).toEqual(["GHE · PA 20260000000013", "GHE · PA 20260000000015"]);
    expect(sheet.authorizedNote).toMatch(/Arranged by date\. Each month's figures count all of its days, including the 20 before this schedule was made on Oct 21, 2026\.$/);
    expect(sheet.authorizedNote).toContain("XX (Home Delivered Meals · S5170): 5 meals a month, Feb 2026 to Oct 2026. Arranged by date.");
  });
});

describe("IMP-19 a service the person keeps rather than names", () => {
  const unknown = fixtureA.replace("PC - CDS", "PC - Foo");

  it("offers the choice, and keeping it builds no schedule from it", () => {
    const flow = addPage(emptyImportFlow(), unknown);
    const needs = next(flow, MO_2026_07, DURING_A);
    expect(needs.kind === "needs" && needs.issues.map((issue) => issue.code)).toEqual(["unknown-service"]);

    const kept = next(setChoice(flow, { kind: "keep", label: "PC - Foo" }), MO_2026_07, DURING_A);
    expect(kept.kind === "needs" && kept.issues).toEqual([
      {
        level: "error", code: "nothing-to-schedule",
        message: "None of this care plan's authorizations has tasks to place in the week: PC - Foo.",
      },
    ]);
  });

  it("keeps it with its rows beside a service that is scheduled", () => {
    const both = `${fixtureA}\n${unknown.replace(/PA: 20250000000001/, "PA: 20250000000009").replace(/466 units/g, "455 units")}`;
    const flow = setChoice(addPage(emptyImportFlow(), both), { kind: "keep", label: "PC - Foo" });
    const outcome = next(flow, MO_2026_07, DURING_A);
    if (outcome.kind !== "ready") throw new Error(JSON.stringify(outcome.issues));
    expect(outcome.plan.services.map((state) => state.serviceLabel)).toEqual(["PC - CDS"]);
    const other = outcome.plan.others![0]!;
    expect([other.label, other.code, other.pa, other.start, other.end]).toEqual([
      "PC - Foo", null, "20250000000009", "2025-08-01", "2026-06-30",
    ]);
    expect(other.rows[0]).toBe("Bathing, 45 min a day, 5 days a week");
    expect(outcome.plan.notes).toContainEqual(expect.objectContaining({
      code: "kept", message: "PC - Foo isn't scheduled: you chose to keep it with the plan without a schedule.",
    }));
  });
});

describe("IMP-19 saving kept authorizations", () => {
  beforeEach(() => sessionStorage.clear());

  it("saves and restores them with the plan", () => {
    const plan = ready(fixtureG);
    savePlan(plan);
    expect(loadPlan()!.others).toEqual(plan.others);
  });

  it("restores a plan saved before them, which has none", () => {
    const { others: _others, ...older } = ready(fixtureG);
    savePlan(older);
    expect(loadPlan()).not.toBeNull();
    expect(loadPlan()!.others).toBeUndefined();
  });

  it("refuses a saved plan whose kept authorization is malformed", () => {
    const plan = ready(fixtureG);
    savePlan(plan);
    const saved = JSON.parse(sessionStorage.getItem(PLAN_KEY)!) as { others: { monthly: unknown }[] };
    saved.others[0]!.monthly = [{ start: "Nov", end: "2026-11-30", units: 62 }];
    sessionStorage.setItem(PLAN_KEY, JSON.stringify(saved));
    expect(loadPlan()).toBeNull();
  });
});
