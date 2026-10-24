import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { manualState, reduce } from "../../src/features/quick-schedule/state";
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

  it("QS-04: addTask assigns qt-N with 15 min/day, every day, unpinned", () => {
    const state = addTask(manualState(TODAY), "BATHING", "Bathing");
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]).toMatchObject({
      id: "qt-1",
      minPerDay: 15,
      daysPerWeek: 7,
      pinned: null,
      locked: false,
    });
    expect(state.nextId).toBe(2);
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
});
