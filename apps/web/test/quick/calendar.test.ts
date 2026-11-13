import { describe, expect, it } from "vitest";
import { MO_2026_07, eventBalance, expandMonth, weekdayOf } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { recordAmendment } from "../../src/features/quick-schedule/amendments";
import { balanceRows, calendarMonths, nextVisitNeeded } from "../../src/features/quick-schedule/balances";
import { amendmentMarkers, calendarCells, listRows, moveDate } from "../../src/features/quick-schedule/calendarView";
import { changeDay } from "../../src/features/quick-schedule/dayChanges";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { normalizeEvents, occurrencesIn } from "../../src/features/quick-schedule/normalizeEvents";
import { applyEvent, eventAuthorizations, planEvents } from "../../src/features/quick-schedule/planEvents";
import type { CarePlan } from "../../src/features/quick-schedule/types";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";
import fixtureG from "@fixtures/fusion/G-care-plan-report-kept.txt?raw";

const PACK = MO_2026_07;

function build(text: string, today: string): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), text), PACK, new Date(today));
  if (outcome.kind !== "ready") throw new Error("The fixture should build");
  return outcome.plan;
}

const modelsOf = (plan: CarePlan) => plan.services.map((state) => buildQuickModel(state, PACK));

// Fixture F on Apr 15, 2026: three services in the week and two evaluations, Feb 1 to Oct 31, 2026.
function planF(): CarePlan {
  return build(fixtureF, "2026-04-15T12:00:00-05:00");
}

function withVisits(plan: CarePlan): CarePlan {
  const may = applyEvent(plan, { authorizationId: plan.visits[0]!.id!, kind: "NURSE_VISIT", date: "2026-05-12" }, PACK).plan;
  return applyEvent(may, { authorizationId: plan.visits[1]!.id!, kind: "NURSE_VISIT", date: "2026-08-20" }, PACK).plan;
}

describe("normalizeEvents: one list of every occurrence", () => {
  it("fixture F: each service's weekly pattern is on real dates, as the engine expands it", () => {
    const plan = planF();
    const models = modelsOf(plan);
    const occurrences = normalizeEvents(plan, models, PACK);
    plan.services.forEach((state, index) => {
      const model = models[index]!;
      const expanded = expandMonth(model.template, [...model.trims, ...model.dayExceptions], 2026, 5, model.auth.start, model.auth.end);
      const expected = Object.entries(expanded).flatMap(([date, tasks]) =>
        Object.entries(tasks).filter(([, minutes]) => minutes > 0).map(([taskId, minutes]) => `${date}|${taskId}|${minutes}`),
      );
      const got = occurrencesIn(occurrences, "2026-05")
        .filter((occurrence) => occurrence.authorizationId === state.id && occurrence.kind === "TASK")
        .map((occurrence) => `${occurrence.date}|${occurrence.taskId}|${occurrence.minutes}`);
      expect(got.sort(), state.serviceLabel ?? "").toEqual(expected.sort());
    });
    // Every date is a real date of the schedule's months, on the weekday the pattern gives.
    for (const occurrence of occurrences) {
      const [year, month, day] = occurrence.date.split("-").map(Number) as [number, number, number];
      expect(weekdayOf(year, month, day)).toBeGreaterThanOrEqual(0);
      expect(occurrence.date >= "2026-04-01" && occurrence.date <= "2026-10-31").toBe(true);
    }
  });

  it("fixture F: the two evaluations are only in their months, and only once placed", () => {
    const plan = planF();
    expect(normalizeEvents(plan, modelsOf(plan), PACK).filter((occurrence) => occurrence.kind === "NURSE_VISIT")).toEqual([]);
    const placed = withVisits(plan);
    const visits = normalizeEvents(placed, modelsOf(placed), PACK).filter((occurrence) => occurrence.kind === "NURSE_VISIT");
    expect(visits.map((occurrence) => [occurrence.date, occurrence.service, occurrence.what, occurrence.quantity, occurrence.unit])).toEqual([
      ["2026-05-12", "GHE", "Nurse visit", 1, "visit"],
      ["2026-08-20", "GHE", "Nurse visit", 1, "visit"],
    ]);
    // Each one's upload reminder is its own occurrence, in the next month, with no quantity.
    const reminders = normalizeEvents(placed, modelsOf(placed), PACK).filter((occurrence) => occurrence.kind === "REMINDER");
    expect(reminders.map((occurrence) => [occurrence.date, occurrence.quantity, occurrence.note])).toEqual([
      ["2026-06-15", null, "Upload the evaluation (HCBS 08-26-01)"],
      ["2026-09-15", null, "Upload the evaluation (HCBS 08-26-01)"],
    ]);
  });

  it("never merges two authorizations: every occurrence carries the one it belongs to", () => {
    const plan = withVisits(planF());
    const occurrences = normalizeEvents(plan, modelsOf(plan), PACK);
    const known = new Set([...plan.services.map((state) => state.id), ...plan.visits.map((visit) => visit.id)]);
    expect(occurrences.every((occurrence) => known.has(occurrence.authorizationId))).toBe(true);
    // A date with two services has an occurrence for each, not one total.
    const date = occurrences.find((occurrence) => occurrence.service === "HC")!.date;
    const services = new Set(occurrences.filter((occurrence) => occurrence.date === date).map((occurrence) => occurrence.authorizationId));
    expect(services.size).toBeGreaterThan(1);
    // The same task name in two services stays two tasks.
    const perService = plan.services.map((state) => occurrences.filter((occurrence) => occurrence.authorizationId === state.id).length);
    expect(perService.every((count) => count > 0)).toBe(true);
    expect(perService.reduce((sum, count) => sum + count, 0)).toBe(occurrences.filter((occurrence) => occurrence.kind === "TASK" || occurrence.kind === "TRANSPORT").length);
  });

  it("transportation is on its day each week, under the service that authorizes it", () => {
    const plan = planF();
    const occurrences = occurrencesIn(normalizeEvents(plan, modelsOf(plan), PACK), "2026-05");
    const transport = occurrences.filter((occurrence) => occurrence.kind === "TRANSPORT");
    expect(new Set(transport.map((occurrence) => occurrence.service))).toEqual(new Set(["PC - CDS"]));
    // Fridays in May 2026: the 1st, 8th, 15th, 22nd and 29th, 120 minutes each.
    expect(transport.map((occurrence) => [occurrence.date, occurrence.minutes])).toEqual([
      ["2026-05-01", 120], ["2026-05-08", 120], ["2026-05-15", 120], ["2026-05-22", 120], ["2026-05-29", 120],
    ]);
  });

  it("one month of the list is the same as that month of the whole list", () => {
    const plan = withVisits(planF());
    const models = modelsOf(plan);
    expect(normalizeEvents(plan, models, PACK, ["2026-05"])).toEqual(occurrencesIn(normalizeEvents(plan, models, PACK), "2026-05"));
  });
});

describe("the grid and the list are two views of one list", () => {
  it("every item in the month's cells is a row of the list, in the same order, and nothing else is", () => {
    const plan = withVisits(planF());
    const models = modelsOf(plan);
    for (const month of ["2026-05", "2026-06", "2026-08"]) {
      const occurrences = normalizeEvents(plan, models, PACK, [month]);
      const cells = calendarCells(occurrences, month, { start: "2026-02-01", end: "2026-10-31" });
      expect(cells.flatMap((cell) => cell.items), month).toEqual(listRows(occurrences, month));
      expect(listRows(occurrences, month).length).toBeGreaterThan(0);
    }
  });

  it("an event placed on a date is in that date's cell and in the list, with its own mark", () => {
    const plan = withVisits(planF());
    const occurrences = normalizeEvents(plan, modelsOf(plan), PACK, ["2026-05"]);
    const cell = calendarCells(occurrences, "2026-05", { start: "2026-02-01", end: "2026-10-31" }).find((candidate) => candidate.date === "2026-05-12")!;
    expect(cell.events).toEqual([{ date: "2026-05-12", service: "GHE", what: "Nurse visit", amount: "1 visit", mark: "Visit", kind: "NURSE_VISIT" }]);
    expect(listRows(occurrences, "2026-05").filter((row) => row.kind === "NURSE_VISIT")).toEqual(cell.events);
    expect(cell.label).toMatch(/^Tuesday, May 12, 2026: .*GHE, Nurse visit, 1 visit$/);
  });

  it("a cell names its date and what it holds; a date with nothing says so", () => {
    const plan = planF();
    const occurrences = normalizeEvents(plan, modelsOf(plan), PACK, ["2026-05"]);
    const cells = calendarCells(occurrences, "2026-05", { start: "2026-02-01", end: "2026-05-20" });
    expect(cells).toHaveLength(31);
    const sunday = cells.find((cell) => cell.date === "2026-05-03")!;
    expect(sunday.label).toBe("Sunday, May 3, 2026: no care");
    expect(cells.find((cell) => cell.date === "2026-05-21")!.label).toBe("Thursday, May 21, 2026: outside the plan");
    const friday = cells.find((cell) => cell.date === "2026-05-01")!;
    expect(friday.bands.map((band) => band.service)).toContain("PC - CDS");
    expect(friday.label).toMatch(/^Friday, May 1, 2026: .*PC - CDS 120 minutes/);
  });

  it("a service's tasks on a date are one item: their names, and their minutes added up", () => {
    const plan = planF();
    const occurrences = normalizeEvents(plan, modelsOf(plan), PACK, ["2026-05"]);
    const date = occurrences.find((occurrence) => occurrence.service === "PC - Agency")!.date;
    const tasks = occurrences.filter((occurrence) => occurrence.date === date && occurrence.service === "PC - Agency" && occurrence.kind === "TASK");
    const row = listRows(occurrences, "2026-05").find((candidate) => candidate.date === date && candidate.service === "PC - Agency")!;
    expect(row.what).toBe(tasks.map((task) => task.what).join(", "));
    expect(row.amount).toBe(`${tasks.reduce((sum, task) => sum + (task.minutes ?? 0), 0)} min`);
  });
});

describe("Change this day: a one-day change over the weekly pattern", () => {
  it("appears on that date only and leaves the pattern and the authorization alone", () => {
    const plan = planF();
    const models = modelsOf(plan);
    const first = normalizeEvents(plan, models, PACK, ["2026-05"]).find((occurrence) => occurrence.kind === "TASK" && occurrence.service === "PC - Agency")!;
    const service = plan.services.findIndex((state) => state.id === first.authorizationId);
    const changed = changeDay(plan, service, { date: first.date, taskId: first.taskId!, minutes: 0 }, PACK);
    expect(changed.refusal).toBeUndefined();

    const after = normalizeEvents(changed.plan, modelsOf(changed.plan), PACK, ["2026-05"]);
    const sameTask = (list: typeof after) => list.filter((occurrence) => occurrence.taskId === first.taskId).map((occurrence) => occurrence.date);
    const before = normalizeEvents(plan, models, PACK, ["2026-05"]);
    expect(sameTask(after)).toEqual(sameTask(before).filter((date) => date !== first.date));
    // The pattern, the tasks and Fusion's figures are untouched; the change is a calendar exception.
    const [stateBefore, stateAfter] = [plan.services[service]!, changed.plan.services[service]!];
    expect(stateAfter.tasks).toEqual(stateBefore.tasks);
    expect(stateAfter.edits).toEqual(stateBefore.edits);
    expect(stateAfter.fusion).toEqual(stateBefore.fusion);
    const model = buildQuickModel(stateAfter, PACK);
    expect(model.entries).toEqual(models[service]!.entries);
    expect(model.dayExceptions).toMatchObject([{ date: first.date, taskId: first.taskId, minutesDelta: -first.minutes!, kind: "change" }]);
  });

  it("is refused with the limit when it would put the month over its units, and nothing changes", () => {
    const plan = planF();
    const first = normalizeEvents(plan, modelsOf(plan), PACK, ["2026-05"]).find((occurrence) => occurrence.kind === "TASK" && occurrence.service === "PC - Agency")!;
    const service = plan.services.findIndex((state) => state.id === first.authorizationId);
    const refused = changeDay(plan, service, { date: first.date, taskId: first.taskId!, minutes: 1440 }, PACK);
    expect(refused.plan).toBe(plan);
    expect(refused.refusal).toMatch(/^Not changed\. That would put .* over /);
  });

  it("setting the pattern's own minutes back leaves no change behind", () => {
    const plan = planF();
    const first = normalizeEvents(plan, modelsOf(plan), PACK, ["2026-05"]).find((occurrence) => occurrence.kind === "TASK" && occurrence.service === "PC - Agency")!;
    const service = plan.services.findIndex((state) => state.id === first.authorizationId);
    const changed = changeDay(plan, service, { date: first.date, taskId: first.taskId!, minutes: 0 }, PACK).plan;
    const back = changeDay(changed, service, { date: first.date, taskId: first.taskId!, minutes: first.minutes! }, PACK).plan;
    expect(back.services[service]!.dayChanges).toEqual([]);
  });

  it("refuses what isn't a day's minutes or a date of the plan", () => {
    const plan = planF();
    const taskId = plan.services[0]!.tasks[0]!.id;
    expect(changeDay(plan, 0, { date: "2026-05-04", taskId, minutes: -5 }, PACK).refusal).toBe("Not changed. Enter the minutes as a whole number from 0 to 1440.");
    expect(changeDay(plan, 0, { date: "2027-01-04", taskId, minutes: 30 }, PACK).refusal).toBe("Not changed. Jan 4, 2027 is outside the plan's dates.");
    expect(changeDay(plan, 0, { date: "2026-05-04", taskId: "nope", minutes: 30 }, PACK).refusal).toBe("Not changed. That task isn't in this service.");
  });
});

describe("authorization balances", () => {
  it("a dated service's balance is the engine's, in its own unit", () => {
    const base = build(fixtureG, "2026-10-31T12:00:00-05:00");
    const meals = base.others!.find((other) => other.code === "S5170")!;
    const plan = applyEvent(base, { authorizationId: meals.id!, kind: "MEAL_DELIVERY", date: "2026-11-03", quantity: 2 }, PACK).plan;
    const row = balanceRows(plan, modelsOf(plan), "2026-11").find((candidate) => candidate.authorizationId === meals.id)!;
    const engine = eventBalance(eventAuthorizations(plan).find((authorization) => authorization.id === meals.id)!, planEvents(plan), "2026-11");
    expect(engine).toEqual({ unit: "meal", authorized: 62, placed: 2, left: 60 });
    expect(row).toEqual({ authorizationId: meals.id, name: "HDM", authorized: "62 meals", used: "2 meals placed", left: "60 meals left" });
    // Day care is time attended; financial management (context) has no balance.
    const names = balanceRows(plan, modelsOf(plan), "2026-11").map((candidate) => candidate.name);
    expect(names).toEqual(["PC - CDS", "HDM", "ADC"]);
  });

  it("a service in the week is in 15-minute units, each authorization on its own row", () => {
    const plan = planF();
    const rows = balanceRows(plan, modelsOf(plan), "2026-05");
    expect(rows.map((row) => [row.name, row.authorized])).toEqual([
      ["PC - Agency", "226 units"], ["PC - CDS", "40 units"], ["HC", "5 units"], ["GHE", "1 visit"],
    ]);
    expect(rows[3]).toMatchObject({ used: "0 visits placed", left: "1 visit left" });
  });

  it("says which nurse visit is next to place, and nothing once all are placed", () => {
    const plan = planF();
    expect(nextVisitNeeded(plan, "2026-04")).toBe("Next nurse visit to place: General Health Evaluation, May 2026");
    expect(nextVisitNeeded(plan, "2026-06")).toBe("Next nurse visit to place: General Health Evaluation, August 2026");
    expect(nextVisitNeeded(withVisits(plan), "2026-04")).toBeNull();
  });

  it("the calendar covers every scheduled month and any month with an event", () => {
    const plan = withVisits(planF());
    expect(calendarMonths(plan, modelsOf(plan))).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  });
});

describe("care plan changes on the calendar", () => {
  it("marks the date a change takes effect, and each date holds the version in effect", () => {
    const base = planF();
    const state = base.services[0]!;
    const task = state.tasks.find((candidate) => (candidate.minPerDay ?? 0) > 0)!;
    const recorded = recordAmendment(base, 0, {
      direction: "decrease", date: "2026-06-10", confirmed: false, units: null,
      tasks: { [task.id]: { minPerDay: 0, daysPerWeek: task.daysPerWeek } },
    }, PACK);
    expect(recorded.refusal).toBeUndefined();
    const plan = recorded.plan;
    const models = modelsOf(plan);
    expect(amendmentMarkers(plan, models)).toEqual({ "2026-07-01": ["Decrease takes effect: PC - Agency"] });
    const occurrences = normalizeEvents(plan, models, PACK);
    const dates = occurrences.filter((occurrence) => occurrence.taskId === task.id).map((occurrence) => occurrence.date);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((date) => date < "2026-07-01")).toBe(true);
    const amendmentId = plan.services[0]!.amendments![0]!.id;
    expect(occurrences.filter((occurrence) => occurrence.authorizationId === state.id && occurrence.date >= "2026-07-01").every((occurrence) => occurrence.amendmentId === amendmentId)).toBe(true);
    expect(occurrences.filter((occurrence) => occurrence.authorizationId === state.id && occurrence.date < "2026-07-01").every((occurrence) => occurrence.amendmentId === null)).toBe(true);
    const cell = calendarCells(occurrencesIn(occurrences, "2026-07"), "2026-07", { start: "2026-02-01", end: "2026-10-31" }, amendmentMarkers(plan, models))[0]!;
    expect(cell.markers).toEqual(["Decrease takes effect: PC - Agency"]);
    expect(cell.label).toMatch(/Decrease takes effect: PC - Agency$/);
  });
});

describe("moving through the grid with the keyboard", () => {
  it("arrows move a day or a week; Home and End go to the week's ends; the month's edges hold", () => {
    expect(moveDate("2026-05-12", "ArrowRight")).toBe("2026-05-13");
    expect(moveDate("2026-05-12", "ArrowLeft")).toBe("2026-05-11");
    expect(moveDate("2026-05-12", "ArrowDown")).toBe("2026-05-19");
    expect(moveDate("2026-05-12", "ArrowUp")).toBe("2026-05-05");
    expect(moveDate("2026-05-12", "Home")).toBe("2026-05-10");
    expect(moveDate("2026-05-12", "End")).toBe("2026-05-16");
    expect(moveDate("2026-05-01", "ArrowLeft")).toBe("2026-05-01");
    expect(moveDate("2026-05-31", "ArrowRight")).toBe("2026-05-31");
    expect(moveDate("2026-05-03", "ArrowUp")).toBe("2026-05-03");
    expect(moveDate("2026-05-28", "ArrowDown")).toBe("2026-05-28");
    expect(moveDate("2026-05-12", "a")).toBe("2026-05-12");
  });
});
