import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { exampleStateA, exampleStateB, manualState, reduce } from "../../src/features/quick-schedule/state";
import type { QuickState } from "../../src/features/quick-schedule/types";

const TODAY = new Date("2026-10-21T12:00:00-05:00");

function addTask(state: QuickState, taskCode: string, name: string): QuickState {
  return reduce(state, { type: "addTask", taskCode, name }, MO_2026_07).state;
}

describe("Quick Schedule state", () => {
  it("manualState defaults to T1019U2, next month through 11 months later", () => {
    const state = manualState(TODAY);
    expect(state.source).toBe("manual");
    expect(state.serviceCode).toBe("T1019U2");
    expect(state.plan.start).toBe("2026-11-01");
    expect(state.plan.end).toBe("2027-10-31");
    expect(state.viewMonth).toBe("2026-11");
  });

  it("QS-04: addTask assigns a UUID with 15 min/day, every day, unpinned", () => {
    const state = addTask(manualState(TODAY), "BATHING", "Bathing");
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]).toMatchObject({
      minPerDay: 15,
      daysPerWeek: 7,
      pinned: null,
      locked: false,
    });
    expect(state.tasks[0]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("QS-02: changing service removes unavailable tasks and returns their names", () => {
    const pack = MO_2026_07;
    const cdsOnly = pack.tasks.find(
      (t) => t.programs.includes("CDS") && !t.programs.includes("HOMEMAKER") && !t.isTransport,
    )!;
    const homemaker = pack.services.find((s) => s.program === "HOMEMAKER")!;
    // QS-04 only offers tasks of the plan's program, so the kept task is one CDS shares with Homemaker.
    const shared = pack.tasks.find(
      (t) => t.programs.includes("HOMEMAKER") && t.programs.includes("CDS") && !t.isTransport,
    )!;

    let state = manualState(TODAY);
    state = addTask(state, cdsOnly.taskCode, cdsOnly.name);
    state = addTask(state, shared.taskCode, shared.name);

    const result = reduce(state, { type: "setService", code: homemaker.code }, pack);
    expect(result.removed).toEqual([cdsOnly.name]);
    expect(result.state.tasks.map((t) => t.name)).toEqual([shared.name]);
    expect(result.state.serviceCode).toBe(homemaker.code);
  });

  it("QS-03: changing the plan start clears Fusion units", () => {
    const state: QuickState = {
      ...manualState(TODAY),
      fusion: { "2026-11": 100 },
    };
    const result = reduce(state, { type: "setPlanStart", month: "2027-01" }, MO_2026_07);
    expect(result.state.fusion).toEqual({});
    expect(result.state.plan.start).toBe("2027-01-01");
  });

  it("QS-06: lowering days per week drops the latest pinned days", () => {
    let state = addTask(manualState(TODAY), "BATHING", "Bathing");
    const task = state.tasks[0]!;
    state = {
      ...state,
      tasks: [{ ...task, pinned: [1, 2, 3] }],
    };
    const result = reduce(state, { type: "setDaysPerWeek", taskId: task.id, days: 2 }, MO_2026_07);
    expect(result.state.tasks[0]!.pinned).toEqual([1, 2]);
  });

  it("QS-08: turning a care day off drops it from pinned sets and clears cell changes", () => {
    let state = addTask(manualState(TODAY), "BATHING", "Bathing");
    const task = state.tasks[0]!;
    state = {
      ...state,
      tasks: [{ ...task, pinned: [1, 2] }],
      edits: { [`${task.id}:1`]: 30 },
    };
    // Sunday (0) is on by default; turning it off leaves Monday/Tuesday untouched but clears edits.
    const result = reduce(state, { type: "toggleCareDay", weekday: 0 }, MO_2026_07);
    expect(result.state.activeDays[0]).toBe(false);
    expect(result.state.edits).toEqual({});
    expect(result.state.tasks[0]!.pinned).toEqual([1, 2]);
  });

  it("QS-05: changing minutes clears that task's cell changes", () => {
    let state = addTask(manualState(TODAY), "BATHING", "Bathing");
    const task = state.tasks[0]!;
    state = {
      ...state,
      edits: { [`${task.id}:1`]: 30 },
    };
    const result = reduce(state, { type: "setMinutes", taskId: task.id, minutes: 45 }, MO_2026_07);
    expect(result.state.edits).toEqual({});
    expect(result.state.tasks[0]!.minPerDay).toBe(45);
  });

  it("QS-09: transport minutes per trip treat invalid or zero as none", () => {
    const state = manualState(TODAY);
    const result = reduce(state, { type: "setTransportMinPerTrip", value: -5 }, MO_2026_07);
    expect((result.state.transport as { minPerTrip: number }).minPerTrip).toBe(0);
  });

  it("QS-04: an agency plan by hand can have the household tasks Fusion lists under PC - Agency", () => {
    const agency = reduce(manualState(TODAY), { type: "setService", code: "T1019" }, MO_2026_07).state;
    const state = addTask(addTask(addTask(agency, "BATHING", "Bathing"), "TRASH", "Trash"), "LAUNDRY", "Laundry");
    expect(state.tasks.map((task) => task.name)).toEqual(["Bathing", "Trash", "Laundry"]);
    // QS-02: switching to Homemaker keeps the household tasks and removes Bathing.
    const homemaker = reduce(state, { type: "setService", code: "S5130" }, MO_2026_07);
    expect(homemaker.removed).toEqual(["Bathing"]);
  });

  it("QS-03: a plan can't start in a month that's already over", () => {
    const state = manualState(TODAY);
    expect(reduce(state, { type: "setPlanStart", month: "2026-09" }, MO_2026_07).state).toBe(state);
    expect(reduce(state, { type: "setPlanStart", month: "2026-10" }, MO_2026_07).state.plan.start).toBe("2026-10-01");
  });

  it("QS-12: the examples start this month, keeping their length (the fixtures are from 2025)", () => {
    const a = exampleStateA(TODAY);
    expect(a.plan).toEqual({ start: "2026-10-01", end: "2027-08-31" });
    expect([a.fromMonth, a.viewMonth, a.isExample]).toEqual(["2026-10", "2026-10", true]);
    expect(exampleStateB(TODAY).plan).toEqual({ start: "2026-10-01", end: "2027-08-31" });
  });

  it("reviewed with the participant: a date or nothing, and any change to the schedule clears it", () => {
    let state = addTask(manualState(TODAY), "BATHING", "Bathing");
    expect(reduce(state, { type: "setReviewed", date: "Oct 20" }, MO_2026_07).state).toBe(state);
    state = reduce(state, { type: "setReviewed", date: "2026-10-20" }, MO_2026_07).state;
    expect(state.reviewed).toBe("2026-10-20");
    // Looking at another month isn't a change to the schedule.
    expect(reduce(state, { type: "setViewMonth", month: "2027-01" }, MO_2026_07).state.reviewed).toBe("2026-10-20");
    const changed = reduce(state, { type: "setMinutes", taskId: state.tasks[0]!.id, minutes: 30 }, MO_2026_07).state;
    expect(changed.reviewed).toBeNull();
    expect(reduce(state, { type: "undoCellChanges" }, MO_2026_07).state.reviewed).toBeNull();
  });
});
