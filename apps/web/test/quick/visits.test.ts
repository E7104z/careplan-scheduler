import { beforeEach, describe, expect, it } from "vitest";
import { MO_2026_07, elapsedMinutes, splitByDate } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { weekMinutes } from "../../src/features/quick-schedule/carePlan";
import { dailyVisits } from "../../src/features/quick-schedule/DailyTaskList";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { loadPlan, PLAN_KEY, savePlan } from "../../src/features/quick-schedule/persistence";
import { planCheckLines } from "../../src/features/quick-schedule/PlanChecks";
import { buildScheduleSheet } from "../../src/features/quick-schedule/scheduleSheet";
import type { CarePlan } from "../../src/features/quick-schedule/types";
import { buildVisits, careWeekdays, planVisitResults, scheduledServices, setStartTime } from "../../src/features/quick-schedule/visits";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-1 on fixture F, built Apr 15, 2026: PC - Agency, PC - CDS and HC share the week's days.
const PACK = MO_2026_07;

function planF(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), PACK, new Date("2026-04-15T12:00:00-05:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture F should build");
  return outcome.plan;
}

const modelsOf = (plan: CarePlan) => plan.services.map((state) => buildQuickModel(state, PACK));

/** Set a start time on every care day of a service. */
function timed(plan: CarePlan, service: number, time: string): CarePlan {
  return careWeekdays(plan.services[service]!, modelsOf(plan)[service]!).reduce((current, weekday) => {
    const change = setStartTime(current, service, weekday, time, PACK, modelsOf(current));
    expect(change.refusal, `${service} ${weekday}`).toBeUndefined();
    return change.plan;
  }, plan);
}

beforeEach(() => sessionStorage.clear());

describe("no start times: overlaps can't be checked, and that is never a pass", () => {
  it("a plan as opened has no visits, and every overlap rule that applies says it needs review", () => {
    const plan = planF();
    const models = modelsOf(plan);
    expect(buildVisits(plan, models, PACK)).toEqual([]);
    expect(scheduledServices(plan, models).map((service) => service.hasClockTimes)).toEqual([false, false, false]);
    const results = planVisitResults(plan, models, PACK);
    expect(results.every((result) => result.severity === "REVIEW")).toBe(true);
    expect(new Set(results.map((result) => result.ruleId))).toEqual(new Set(["CON-01", "CON-02"]));
    expect(results.every((result) => result.message === "No clock times yet, so overlaps can't be checked")).toBe(true);
    // Said once on the page, naming the services and the rules.
    expect(planCheckLines(results, plan, models)).toEqual([
      {
        severity: "REVIEW", text: "No clock times yet, so overlaps can't be checked", whatToDo: "",
        ruleIds: ["CON-01", "CON-02"], details: [], services: ["PC - Agency", "PC - CDS", "HC"], count: 6,
      },
    ]);
  });

  it("a service stops being under review only when every one of its care days has a time", () => {
    const plan = planF();
    const days = careWeekdays(plan.services[0]!, modelsOf(plan)[0]!);
    const one = setStartTime(plan, 0, days[0]!, "09:00", PACK, modelsOf(plan)).plan;
    expect(scheduledServices(one, modelsOf(one))[0]!.hasClockTimes).toBe(days.length === 1);
    const all = timed(plan, 0, "09:00");
    expect(scheduledServices(all, modelsOf(all)).map((service) => service.hasClockTimes)).toEqual([true, false, false]);
    expect(planVisitResults(all, modelsOf(all), PACK).some((result) => result.refs.serviceAuthId === all.services[0]!.id)).toBe(false);
  });
});

describe("buildVisits: visits from start times", () => {
  it("each visit runs from its start time for that date's scheduled minutes", () => {
    const plan = timed(planF(), 0, "09:00");
    const models = modelsOf(plan);
    const state = plan.services[0]!;
    const week = weekMinutes(state, models[0]!);
    const visits = buildVisits(plan, models, PACK);
    expect(visits.length).toBeGreaterThan(20);
    for (const visit of visits) {
      const date = visit.start.slice(0, 10);
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      expect(visit.start).toBe(`${date}T09:00`);
      expect(elapsedMinutes(visit.start, visit.end), date).toBe(week[weekday]);
      expect(visit.serviceCode).toBe(state.serviceCode);
      expect(visit.participantId).toBe("participant");
    }
    // One visit a date, on every care day from this month to the plan's end, and nowhere else.
    expect(new Set(visits.map((visit) => visit.start.slice(0, 10))).size).toBe(visits.length);
    expect(visits[0]!.start >= "2026-04-01").toBe(true);
    expect(visits.at(-1)!.start <= "2026-10-31T23:59").toBe(true);
  });

  it("a visit past midnight ends on the next date and splits by date (SCH-15)", () => {
    const plan = timed(planF(), 0, "22:00");
    const visit = buildVisits(plan, modelsOf(plan), PACK)[0]!;
    expect(visit.end.slice(0, 10) > visit.start.slice(0, 10)).toBe(true);
    const split = splitByDate(visit.start, visit.end);
    expect(Object.keys(split)).toHaveLength(2);
    expect(Object.values(split).reduce((sum, minutes) => sum + minutes, 0)).toBe(elapsedMinutes(visit.start, visit.end));
    expect(split[visit.start.slice(0, 10)]).toBe(120);
  });

  it("a service or a day with no start time produces no visit", () => {
    const plan = planF();
    const days = careWeekdays(plan.services[0]!, modelsOf(plan)[0]!);
    const one = setStartTime(plan, 0, days[0]!, "09:00", PACK, modelsOf(plan)).plan;
    const visits = buildVisits(one, modelsOf(one), PACK);
    expect(visits.length).toBeGreaterThan(0);
    expect(visits.every((visit) => new Date(`${visit.start.slice(0, 10)}T12:00:00Z`).getUTCDay() === days[0])).toBe(true);
    expect(visits.every((visit) => visit.id.startsWith(`${one.services[0]!.id}:`))).toBe(true);
  });
});

describe("setting a start time goes through the guard", () => {
  it("refuses a time that isn't one, and clears a time with null", () => {
    const plan = planF();
    const day = careWeekdays(plan.services[0]!, modelsOf(plan)[0]!)[0]!;
    expect(setStartTime(plan, 0, day, "9am", PACK, modelsOf(plan))).toEqual({
      plan, refusal: "Not changed. Enter the time as hours and minutes, like 9:00 AM.",
    });
    const set = setStartTime(plan, 0, day, "09:00", PACK, modelsOf(plan)).plan;
    expect(set.services[0]!.startTimes).toEqual({ [String(day)]: "09:00" });
    expect(setStartTime(set, 0, day, null, PACK, modelsOf(set)).plan.services[0]!.startTimes).toEqual({});
  });

  it("refuses a time that would make two visits of the same CDS service overlap, and says why", () => {
    // Two CDS authorizations with their time on the same day (made up from fixture F's).
    const base = planF();
    const cds = base.services.findIndex((state) => state.serviceCode === "T1019U2");
    const second = { ...base.services[cds]!, id: "auth-cds-2", serviceLabel: "PC - CDS (2)" };
    const plan: CarePlan = { ...base, services: [...base.services, second] };
    const other = plan.services.length - 1;
    const day = careWeekdays(plan.services[cds]!, modelsOf(plan)[cds]!)[0]!;
    const first = setStartTime(plan, cds, day, "09:00", PACK, modelsOf(plan)).plan;

    const refused = setStartTime(first, other, day, "10:00", PACK, modelsOf(first));
    expect(refused.plan).toBe(first);
    expect(refused.refusal).toBe(
      "Not changed. Two visits for the same service overlap. A participant can't get the same CDS or ILW service twice at once. Change one visit's time.",
    );
    // A time after the first visit ends is accepted.
    expect(setStartTime(first, other, day, "13:00", PACK, modelsOf(first)).refusal).toBeUndefined();
  });

  it("the plan it was given is untouched", () => {
    const plan = planF();
    const day = careWeekdays(plan.services[0]!, modelsOf(plan)[0]!)[0]!;
    setStartTime(plan, 0, day, "09:00", PACK, modelsOf(plan));
    expect(plan.services[0]!.startTimes).toBeUndefined();
  });
});

describe("the start time is shown where the visit is", () => {
  it("the daily task list and the printout carry it; a day with none reads as before", () => {
    const plan = planF();
    const day = careWeekdays(plan.services[0]!, modelsOf(plan)[0]!)[0]!;
    const set = setStartTime(plan, 0, day, "09:00", PACK, modelsOf(plan)).plan;
    const [state, model] = [set.services[0]!, modelsOf(set)[0]!];
    const visits = dailyVisits(state, model);
    expect(visits[day]!.startTime).toBe("09:00");
    expect(visits.filter((visit) => visit.startTime !== null)).toHaveLength(1);

    const sheet = buildScheduleSheet(state, model, PACK, "2026-04-15");
    expect(sheet.days[day]!.visit).toMatch(/^9:00 AM, \d/);
    const before = buildScheduleSheet(plan.services[0]!, modelsOf(plan)[0]!, PACK, "2026-04-15");
    expect(before.days[day]!.visit).not.toMatch(/AM|PM/);
    expect(sheet.days.filter((_, index) => index !== day)).toEqual(before.days.filter((_, index) => index !== day));
  });
});

describe("storage", () => {
  it("start times round-trip; a plan saved before them opens; a bad time drops the saved plan", () => {
    const plan = planF();
    savePlan(plan);
    expect(loadPlan()!.services[0]!.startTimes).toBeUndefined();
    const set = timed(plan, 0, "09:30");
    savePlan(set);
    expect(loadPlan()!.services[0]!.startTimes).toEqual(set.services[0]!.startTimes);
    expect(sessionStorage.getItem(PLAN_KEY)).not.toMatch(/SAMPLE PARTICIPANT|10000006/);

    const bad = { ...set, services: set.services.map(({ identity: _identity, ...rest }, index) => (index === 0 ? { ...rest, startTimes: { "1": "25:00" } } : rest)) };
    sessionStorage.setItem(PLAN_KEY, JSON.stringify(bad));
    expect(loadPlan()).toBeNull();
  });
});
