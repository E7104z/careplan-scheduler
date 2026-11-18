import { beforeEach, describe, expect, it } from "vitest";
import {
  MO_2026_07,
  elapsedMinutes,
  ruleSCH14VisitDates,
  splitByDate,
  weekdayOf,
  type ServiceAuthorization,
  type Visit,
} from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { recordAmendment } from "../../src/features/quick-schedule/amendments";
import { calendarMonths } from "../../src/features/quick-schedule/balances";
import { calendarCells } from "../../src/features/quick-schedule/calendarView";
import { changeDay } from "../../src/features/quick-schedule/dayChanges";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { normalizeEvents, occurrencesIn } from "../../src/features/quick-schedule/normalizeEvents";
import { loadPlan, PLAN_KEY, savePlan } from "../../src/features/quick-schedule/persistence";
import { applyEvent, eventAuthorizations, planEvents } from "../../src/features/quick-schedule/planEvents";
import { planSheets } from "../../src/features/quick-schedule/planSheet";
import type { ScheduleSheet } from "../../src/features/quick-schedule/scheduleSheet";
import type { CarePlan, QuickState } from "../../src/features/quick-schedule/types";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";
import fixtureG from "@fixtures/fusion/G-care-plan-report-kept.txt?raw";

// Coverage Phase 3 acceptance (CP3-8): DATES-01 on the calendar path, fixtures F and G end to
// end, and plans saved before this phase. Made-up and de-identified data only.
const PACK = MO_2026_07;

function build(text: string, today: string): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), text), PACK, new Date(today));
  if (outcome.kind !== "ready") throw new Error("The fixture should build");
  return outcome.plan;
}

const modelsOf = (plan: CarePlan) => plan.services.map((state) => buildQuickModel(state, PACK));

/** Fixture B (CDS, every day) with other plan dates, built in its first month. */
function planWithDates(start: string, end: string): CarePlan {
  const base = build(fixtureB, "2025-11-20T12:00:00-06:00");
  const state: QuickState = { ...base.services[0]!, plan: { start, end }, fromMonth: start.slice(0, 7), viewMonth: start.slice(0, 7) };
  return { ...base, services: [state] };
}

function datesOf(plan: CarePlan, month: string): string[] {
  return [...new Set(normalizeEvents(plan, modelsOf(plan), PACK, [month]).map((occurrence) => occurrence.date))].sort();
}

beforeEach(() => sessionStorage.clear());

describe("DATES-01 on the calendar path", () => {
  it("mid-month start: nothing is scheduled before the plan's first day, and the partial month is under review", () => {
    const plan = planWithDates("2026-03-10", "2026-10-31");
    const march = datesOf(plan, "2026-03");
    expect(march[0]).toBe("2026-03-10");
    expect(march).toHaveLength(22);
    const cells = calendarCells(normalizeEvents(plan, modelsOf(plan), PACK, ["2026-03"]), "2026-03", plan.services[0]!.plan);
    expect(cells.find((cell) => cell.date === "2026-03-09")!.label).toBe("Monday, Mar 9, 2026: outside the plan");
    // The engine asks for a partial month's figure rather than guessing it (SCH-12).
    const model = buildQuickModel(plan.services[0]!, PACK);
    expect(model.results.some((result) => result.ruleId === "SCH-12" && result.severity === "REVIEW")).toBe(true);
  });

  it("expiry: nothing is scheduled after the plan's last day, and the calendar ends in its last month", () => {
    const plan = planWithDates("2026-03-01", "2026-06-15");
    expect(datesOf(plan, "2026-06").at(-1)).toBe("2026-06-15");
    expect(calendarMonths(plan, modelsOf(plan))).toEqual(["2026-03", "2026-04", "2026-05", "2026-06"]);
    expect(normalizeEvents(plan, modelsOf(plan), PACK).every((occurrence) => occurrence.date <= "2026-06-15")).toBe(true);
  });

  it("expiry: an event dated after its authorization ends is refused", () => {
    const plan = build(fixtureG, "2026-10-31T12:00:00-05:00");
    const meals = plan.others!.find((other) => other.code === "S5170")!;
    const refused = applyEvent(plan, { authorizationId: meals.id!, kind: "MEAL_DELIVERY", date: "2027-05-01", quantity: 1 }, PACK);
    expect(refused.plan).toBe(plan);
    expect(refused.refusal).toMatch(/^Not placed\. May 1, 2027 is outside what the care plan authorizes/);
  });

  it("future start: a plan that hasn't begun has nothing before its first day, and the calendar opens on its first month", () => {
    // Built Nov 20, 2025; fixture B starts Dec 1, 2025.
    const plan = build(fixtureB, "2025-11-20T12:00:00-06:00");
    expect(calendarMonths(plan, modelsOf(plan))[0]).toBe("2025-12");
    expect(normalizeEvents(plan, modelsOf(plan), PACK)[0]!.date).toBe("2025-12-01");
  });

  it("DST weeks: each date of March and November 2026 appears once, on its own weekday, with a full day's care", () => {
    // Clocks change on Sunday, Mar 8 and Sunday, Nov 1, 2026.
    const plan = planWithDates("2026-03-01", "2026-11-30");
    for (const [month, days, sunday] of [["2026-03", 31, "2026-03-08"], ["2026-11", 30, "2026-11-01"]] as const) {
      const occurrences = normalizeEvents(plan, modelsOf(plan), PACK, [month]);
      const dates = [...new Set(occurrences.map((occurrence) => occurrence.date))].sort();
      expect(dates, month).toHaveLength(days);
      const [year, monthNumber, day] = sunday.split("-").map(Number) as [number, number, number];
      expect(weekdayOf(year, monthNumber, day)).toBe(0);
      const minutesOn = (date: string) => occurrences.filter((occurrence) => occurrence.date === date).reduce((sum, occurrence) => sum + (occurrence.minutes ?? 0), 0);
      // The DST Sunday holds what the Sunday before or after it holds: scheduled minutes are a plan, not a clock.
      const other = month === "2026-03" ? "2026-03-15" : "2026-11-08";
      expect(minutesOn(sunday), sunday).toBe(minutesOn(other));
      expect(minutesOn(sunday)).toBeGreaterThan(0);
    }
  });

  it("DST and overnight: elapsed minutes are real minutes in America/Chicago, split by calendar date (SCH-15)", () => {
    // 10 pm to 6 am is 7 hours when clocks go forward and 9 when they go back.
    expect(elapsedMinutes("2026-03-07T22:00", "2026-03-08T06:00")).toBe(420);
    expect(elapsedMinutes("2026-10-31T22:00", "2026-11-01T06:00")).toBe(540);
    // An ordinary overnight visit is split at midnight.
    expect(splitByDate("2026-05-12T22:00", "2026-05-13T06:00")).toEqual({ "2026-05-12": 120, "2026-05-13": 360 });
    expect(splitByDate("2026-10-31T22:00", "2026-11-01T06:00")).toEqual({ "2026-10-31": 120, "2026-11-01": 420 });
  });

  it("suspension: a visit dated in a suspension is a Must fix in the engine (SCH-14)", () => {
    const authorization: ServiceAuthorization = {
      id: "auth-1", participantId: "P-TEST-01", program: "CDS", serviceCode: "T1019U2", start: "2026-03-01", end: "2026-10-31",
      state: "active", suspensions: [{ start: "2026-05-10", end: "2026-05-20" }], revision: 1, tasks: [],
    };
    const visit = (date: string): Visit => ({
      id: `v-${date}`, participantId: "P-TEST-01", caregiverId: "c-1", serviceCode: "T1019U2", start: `${date}T09:00`, end: `${date}T10:00`, taskIds: [],
    });
    expect(ruleSCH14VisitDates([visit("2026-05-09")], [authorization])).toEqual([]);
    expect(ruleSCH14VisitDates([visit("2026-05-12")], [authorization]).map((result) => [result.ruleId, result.severity])).toEqual([["SCH-14", "BLOCK"]]);
    // After the authorization ends, no authorization covers the date.
    expect(ruleSCH14VisitDates([visit("2026-11-01")], [authorization])[0]!.message).toBe("No authorization covers 2026-11-01");
  });
});

describe("fixtures F and G end to end", () => {
  it("F: every authorization appears once, events are placed, and the printout changes only by the dates placed", () => {
    const plan = build(fixtureF, "2026-04-15T12:00:00-05:00");
    const ids = [...plan.services.map((state) => state.id), ...plan.visits.map((visit) => visit.id!), ...(plan.others ?? []).map((other) => other.id!)];
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);

    const may = applyEvent(plan, { authorizationId: plan.visits[0]!.id!, kind: "NURSE_VISIT", date: "2026-05-12" }, PACK).plan;
    const both = applyEvent(may, { authorizationId: plan.visits[1]!.id!, kind: "NURSE_VISIT", date: "2026-08-20" }, PACK).plan;
    expect(planEvents(both).map((event) => [event.kind, event.date])).toEqual([
      ["NURSE_VISIT", "2026-05-12"], ["REMINDER", "2026-06-15"], ["NURSE_VISIT", "2026-08-20"], ["REMINDER", "2026-09-15"],
    ]);
    // Every occurrence belongs to one of the five, and each of the five is its own.
    const occurrences = normalizeEvents(both, modelsOf(both), PACK);
    expect(new Set(occurrences.map((occurrence) => occurrence.authorizationId))).toEqual(new Set(ids));
    // The printout is the same but for the Nurse visits page, which shows the dates placed (Nov 17, 2026).
    const placed = planSheets(both, modelsOf(both), PACK, "2026-04-15") as ScheduleSheet[];
    const before = planSheets(plan, modelsOf(plan), PACK, "2026-04-15") as ScheduleSheet[];
    expect(placed.map(({ nurseVisits: _visits, ...sheet }) => sheet)).toEqual(before.map(({ nurseVisits: _visits, ...sheet }) => sheet));
    expect(placed[0]!.nurseVisits!.map((visit) => visit.months.map((month) => month.placed))).toEqual([["May 12"], ["Aug 20"]]);
    expect(before[0]!.nurseVisits!.map((visit) => visit.months.map((month) => month.placed))).toEqual([["–"], ["–"]]);
  });

  it("G: six authorizations, each once; the dated ones take events, the unknown one stays kept and holds nothing", () => {
    const plan = build(fixtureG, "2026-10-31T12:00:00-05:00");
    const others = plan.others!;
    expect([plan.services.length, others.length]).toEqual([1, 5]);
    expect(new Set([plan.services[0]!.id, ...others.map((other) => other.id)]).size).toBe(6);
    expect(eventAuthorizations(plan).map((authorization) => authorization.unit)).toEqual(["meal", "minute", "none", "visit"]);

    const meals = others.find((other) => other.code === "S5170")!;
    const care = others.find((other) => other.code === "S5100HC")!;
    let placed = applyEvent(plan, { authorizationId: meals.id!, kind: "MEAL_DELIVERY", date: "2026-11-03", quantity: 2 }, PACK).plan;
    placed = applyEvent(placed, { authorizationId: care.id!, kind: "ADC_DAY", date: "2026-11-02", quantity: 480 }, PACK).plan;
    const november = occurrencesIn(normalizeEvents(placed, modelsOf(placed), PACK), "2026-11");
    expect(november.filter((occurrence) => occurrence.kind === "MEAL_DELIVERY").map((occurrence) => [occurrence.date, occurrence.quantity, occurrence.unit, occurrence.minutes])).toEqual([
      ["2026-11-03", 2, "meals", null],
    ]);
    expect(november.filter((occurrence) => occurrence.kind === "ADC_DAY").map((occurrence) => [occurrence.date, occurrence.minutes])).toEqual([["2026-11-02", 480]]);
    // Nothing is dropped: all five kept authorizations are still in the plan, as read.
    expect(placed.others).toEqual(plan.others);
    expect(planSheets(placed, modelsOf(placed), PACK, "2026-10-31")).toEqual(planSheets(plan, modelsOf(plan), PACK, "2026-10-31"));
  });
});

describe("plans saved before and after Phase 3", () => {
  it("a plan saved by the version before (no ids on visits and others, no events, changes or day changes) opens", () => {
    const plan = build(fixtureG, "2026-10-31T12:00:00-05:00");
    const old = {
      ...plan,
      services: plan.services.map(({ identity: _identity, amendments: _amendments, dayChanges: _dayChanges, ...rest }) => rest),
      visits: plan.visits.map(({ id: _id, ...rest }) => rest),
      others: plan.others!.map(({ id: _id, ...rest }) => rest),
    };
    sessionStorage.setItem(PLAN_KEY, JSON.stringify(old));
    const loaded = loadPlan()!;
    expect(loaded.others).toHaveLength(5);
    expect(loaded.others!.every((other) => typeof other.id === "string")).toBe(true);
    expect(loaded.events).toBeUndefined();
    expect(buildQuickModel(loaded.services[0]!, PACK).results.filter((result) => result.severity === "BLOCK")).toEqual([]);
  });

  it("a plan with events, a recorded change and a one-day change round-trips, with no name or DCN in storage", () => {
    let plan = build(fixtureF, "2026-04-15T12:00:00-05:00");
    plan = applyEvent(plan, { authorizationId: plan.visits[0]!.id!, kind: "NURSE_VISIT", date: "2026-05-12" }, PACK).plan;
    const task = plan.services[0]!.tasks.find((candidate) => (candidate.minPerDay ?? 0) > 0)!;
    plan = recordAmendment(plan, 0, {
      direction: "decrease", date: "2026-06-10", confirmed: true, units: null,
      tasks: { [task.id]: { minPerDay: 0, daysPerWeek: task.daysPerWeek } },
    }, PACK).plan;
    const first = normalizeEvents(plan, modelsOf(plan), PACK, ["2026-05"]).find((occurrence) => occurrence.kind === "TASK" && occurrence.authorizationId === plan.services[0]!.id)!;
    plan = changeDay(plan, 0, { date: first.date, taskId: first.taskId!, minutes: 0 }, PACK).plan;
    expect(plan.services[0]!.dayChanges).toHaveLength(1);

    savePlan(plan);
    const stored = sessionStorage.getItem(PLAN_KEY)!;
    expect(stored).not.toMatch(/SAMPLE PARTICIPANT|10000006/);
    const loaded = loadPlan()!;
    expect(loaded.events).toEqual(plan.events);
    expect(loaded.services[0]!.amendments).toEqual(plan.services[0]!.amendments);
    expect(loaded.services[0]!.dayChanges).toEqual(plan.services[0]!.dayChanges);
    // What the calendar shows is the same after the reload.
    expect(normalizeEvents(loaded, modelsOf(loaded), PACK)).toEqual(normalizeEvents(plan, modelsOf(plan), PACK));
  });
});
