import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { activeIndex, isUpcoming, maxServiceDays, planWeek, serviceDayWarning, serviceDays, singlePlan, weekMinutes } from "../../src/features/quick-schedule/carePlan";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { exampleStateA, exampleStateB } from "../../src/features/quick-schedule/state";
import type { CarePlan } from "../../src/features/quick-schedule/types";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";
import fixtureP from "@fixtures/fusion/P-TEST-APC-PC-4DAY.txt?raw";

// APP-SPEC 5.8 acceptance (AC-28): fixture F, a care plan report with agency personal care, CDS
// essential transportation, homemaker and two General Health Evaluations, becomes one schedule
// for the participant. Each authorization keeps its own units and checks.

const TODAY = new Date("2026-10-21T12:00:00-05:00");
const PACK = MO_2026_07;

function planF(today = TODAY): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), PACK, today);
  if (outcome.kind !== "ready") throw new Error(`Expected a ready outcome, got ${JSON.stringify(outcome.issues)}`);
  return outcome.plan;
}

function planP(today = TODAY): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureP), PACK, today);
  if (outcome.kind !== "ready") throw new Error(`Expected a ready outcome, got ${JSON.stringify(outcome.issues)}`);
  return outcome.plan;
}

describe("AC-28 fixture F: one schedule for the participant", () => {
  const plan = planF();
  const models = plan.services.map((state) => buildQuickModel(state, PACK));
  const [agency, cds, homemaker] = plan.services;

  it("builds every authorization with no choice to make, and opens on the whole care plan", () => {
    expect(plan.services.map((state) => [state.serviceLabel, state.serviceCode, state.pa])).toEqual([
      ["PC - Agency", "T1019", "20260000000011"],
      ["PC - CDS", "T1019U2", "20260000000012"],
      ["HC", "S5130", "20260000000014"],
    ]);
    expect(plan.view).toBe("plan");
    expect(activeIndex(plan)).toBeNull();
    expect(plan.services.every((state) => state.identity?.dcn === "10000006")).toBe(true);
  });

  it("reconciles each authorization with Fusion on its own: 226, 40 and 5 units", () => {
    expect(models.map((model) => [model.checksum?.fusion, model.checksum?.matches])).toEqual([
      [226, true],
      [40, true],
      [5, true],
    ]);
  });

  it("keeps the household tasks under agency personal care, and its own unit balance", () => {
    expect(agency!.tasks.map((task) => task.name)).toContain("Laundry");
    expect(homemaker!.tasks.map((task) => [task.name, task.minPerDay, task.daysPerWeek])).toEqual([
      ["Wash Windows/Blinds", 15, 1],
    ]);
    expect(models.map((model) => model.monthlyAuthorizations.map((m) => [m.month, m.units]))).toEqual([
      [["2026-10", 226]],
      [["2026-10", 40]],
      [["2026-10", 5]],
    ]);
  });

  it("sets CDS transportation aside: 40 units a month, 120 minutes a week", () => {
    expect(cds!.tasks).toEqual([]);
    expect(models[1]!.allowance).toMatchObject({ units: 40, weeklyMinutes: 120 });
  });

  it("schedules no month after the authorizations end (October 31, 2026)", () => {
    expect(models.map((model) => model.months)).toEqual([["2026-10"], ["2026-10"], ["2026-10"]]);
  });

  it("has no Must-fix result in any service", () => {
    expect(models.flatMap((model) => model.results).filter((result) => result.severity === "BLOCK")).toEqual([]);
  });

  it("keeps every service on one shared set of care days, not spread across the week", () => {
    const week = planWeek(plan, models);
    // Sunday to Saturday: agency Monday to Friday; transportation and homemaker stay inside those days.
    expect(week.map((day) => day.byService)).toEqual([
      [0, 0, 0],
      [160, 0, 0],
      [160, 0, 0],
      [140, 0, 0],
      [130, 0, 15],
      [125, 120, 0],
      [0, 0, 0],
    ]);
    expect(week.reduce((sum, day) => sum + day.minutes, 0)).toBe(715 + 120 + 15);
    expect(week[5]!.items.at(-1)).toEqual({ service: 1, name: "Essential transportation", minutes: 120, transport: true });
    expect(week[4]!.items.at(-1)).toEqual({ service: 2, name: "Wash Windows/Blinds", minutes: 15, transport: false });
    expect(serviceDays(plan, models)).toBe(5);
  });

  it("lists both General Health Evaluations by month, outside the week", () => {
    expect(plan.visits.map((visit) => [visit.name, visit.start, visit.pa])).toEqual([
      ["General Health Evaluation", "2026-05-01", "20260000000013"],
      ["General Health Evaluation", "2026-08-01", "20260000000015"],
    ]);
    expect(plan.visits.map((visit) => isUpcoming(visit, TODAY))).toEqual([false, false]);
    expect(plan.visits.map((visit) => isUpcoming(visit, new Date("2026-08-31T12:00:00-05:00")))).toEqual([false, true]);
    expect(plan.notes.map((note) => note.code)).toEqual(["not-scheduled"]);
  });

  it("refuses a plan whose authorizations have all ended", () => {
    const outcome = next(addPage(emptyImportFlow(), fixtureF), PACK, new Date("2026-11-02T12:00:00-06:00"));
    expect(outcome.kind).toBe("needs");
    if (outcome.kind === "needs") {
      expect(outcome.issues).toEqual([
        { level: "error", code: "plan-ended", message: "This care plan ended on Oct 31, 2026." },
      ]);
    }
  });
});

describe("a service that ended earlier is left out of the plan", () => {
  // Homemaker authorized February to June only.
  const text = fixtureF.replace(
    /(HC\tN\/A[\s\S]*?)(07\/01\/2026\t07\/31\/2026\tS5130\t5\n08[\s\S]*?10\/31\/2026\tS5130\t5\n)/,
    "$1",
  );
  const outcome = next(addPage(emptyImportFlow(), text), PACK, TODAY);

  it("builds the others, with a note", () => {
    if (outcome.kind !== "ready") throw new Error("Expected a ready outcome");
    expect(outcome.plan.services.map((state) => state.serviceLabel)).toEqual(["PC - Agency", "PC - CDS"]);
    expect(outcome.plan.notes.map((note) => note.message)).toContain("HC ended on Jun 30, 2026, so it isn't scheduled.");
  });
});

describe("a plan of one service", () => {
  it("is shown as that service, as before", () => {
    const plan = singlePlan(exampleStateA(TODAY));
    expect(activeIndex(plan)).toBe(0);
    expect(plan.visits).toEqual([]);
  });

  it("weekMinutes adds the transportation to its day", () => {
    const plan = planF();
    expect(weekMinutes(plan.services[1]!, buildQuickModel(plan.services[1]!, PACK))).toEqual([0, 0, 0, 0, 0, 120, 0]);
  });
});

describe("AC-28 APC + PC-Agency: two four-day services share the same days", () => {
  const plan = planP();
  const models = plan.services.map((state) => buildQuickModel(state, PACK));

  it("reads both authorizations in order", () => {
    expect(plan.services.map((state) => [state.serviceLabel, state.serviceCode, state.pa])).toEqual([
      ["APC", "T1019TF", "20260000000041"],
      ["PC - Agency", "T1019", "20260000000042"],
    ]);
  });

  it("reconciles each authorization with Fusion: 114 and 336 units", () => {
    expect(models.map((model) => [model.checksum?.fusion, model.checksum?.matches])).toEqual([
      [114, true],
      [336, true],
    ]);
  });

  it("puts both services on the same four days, 355 minutes a day, nothing the other three", () => {
    const week = planWeek(plan, models);
    expect(week.map((day) => day.minutes)).toEqual([0, 355, 355, 355, 355, 0, 0]);
    expect(week.reduce((sum, day) => sum + day.minutes, 0)).toBe(1420);
    expect(serviceDays(plan, models)).toBe(4);
    expect(maxServiceDays(models)).toBe(4);
  });

  it("has no Must-fix result in either service", () => {
    expect(models.flatMap((model) => model.results).filter((result) => result.severity === "BLOCK")).toEqual([]);
  });
});

describe("service days stay within the largest days-per-week", () => {
  it("for every client with a weekly schedule", () => {
    const cases: [string, CarePlan][] = [
      ["fixture F", planF()],
      ["APC + PC-Agency", planP()],
      ["example A", singlePlan(exampleStateA(TODAY))],
      ["example B", singlePlan(exampleStateB(TODAY))],
    ];
    for (const [label, plan] of cases) {
      const models = plan.services.map((state) => buildQuickModel(state, PACK));
      expect(serviceDays(plan, models), label).toBeLessThanOrEqual(maxServiceDays(models));
    }
  });
});

describe("service day warning", () => {
  it("is quiet when the week fits the plan's largest days-a-week", () => {
    const plan = planF();
    const models = plan.services.map((state) => buildQuickModel(state, PACK));
    expect(serviceDayWarning(plan, models)).toBeNull();
  });

  it("warns when the week has more service days than the plan's largest days-a-week", () => {
    const plan = planF();
    // Move CDS transportation onto Saturday: six service days, still five planned.
    plan.services[1]!.transport.day = 6;
    const models = plan.services.map((state) => buildQuickModel(state, PACK));
    expect(serviceDays(plan, models)).toBe(6);
    expect(maxServiceDays(models)).toBe(5);
    expect(serviceDayWarning(plan, models)).toBe(
      "This week has more service days than the plan's 5 days a week. Check each service's care days.",
    );
  });
});
