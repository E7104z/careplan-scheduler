import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MO_2026_07, type Weekday } from "@careplan/engine";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { exampleStateB, manualState, reduce, type QuickAction } from "../../src/features/quick-schedule/state";
import type { QuickState } from "../../src/features/quick-schedule/types";

const TODAY = new Date("2026-10-21T12:00:00-05:00");
const pack = MO_2026_07;

function run(state: QuickState, ...actions: QuickAction[]): QuickState {
  return actions.reduce((current, action) => reduce(current, action, pack).state, state);
}

function blocks(state: QuickState) {
  return buildQuickModel(state, pack).results.filter((result) => result.severity === "BLOCK");
}

function placedDay(state: QuickState, taskId: string): Weekday {
  return buildQuickModel(state, pack).entries.find((entry) => entry.taskId === taskId)!.weekday;
}

describe("APP-SPEC 5.7 / .clinerules 19a: every schedule change goes through the guard", () => {
  it("QS-04: adding a task that would put a month over its Fusion units is accepted and flagged", () => {
    // Clean Bath 20 min once a week, raised to 21 on its day: fits its 7 units (105 min) in every month.
    let state = run(manualState(TODAY), { type: "addTask", taskCode: "CLEAN_BATH", name: "Clean Bath" });
    const cleanBath = state.tasks[0]!.id;
    state = run(
      state,
      { type: "setDaysPerWeek", taskId: cleanBath, days: 1 },
      { type: "setMinutes", taskId: cleanBath, minutes: 20 },
    );
    state = run(state, { type: "setCell", key: `${cleanBath}:${placedDay(state, cleanBath)}`, minutes: 21 });
    // November's Fusion figure is exactly Clean Bath's 7 units.
    state = run(state, { type: "setFusionUnits", month: "2026-11", units: 7 });
    expect(blocks(state)).toEqual([]);

    // Bathing pushes November over 7 units. That is a warning now (SCH-08), not a refusal.
    const result = reduce(state, { type: "addTask", taskCode: "BATHING", name: "Bathing" }, pack);
    expect(result.refusal).toBeUndefined();
    expect(result.state.tasks.map((task) => task.name)).toContain("Bathing");
  });

  it("a plan that already breaks a rule can still be changed, and over-authorization is a warning, not a new break", () => {
    // Respite over its 868-unit monthly limit is a BLOCK (AUTH-09) that comes from the plan's own
    // figure, not from anything the person changed (APP-SPEC 5.7: "no new Must fix").
    const state = run(
      manualState(TODAY),
      { type: "setService", code: "S5150" },
      { type: "addTask", taskCode: "BASIC_RESPITE", name: "Basic Respite" },
      { type: "addTask", taskCode: "ADVANCED_RESPITE", name: "Advanced Respite" },
      { type: "setFusionUnits", month: "2026-11", units: 900 },
    );
    expect(blocks(state).map((result) => result.ruleId)).toEqual(["AUTH-09"]);

    const removed = reduce(state, { type: "removeTask", taskId: state.tasks[1]!.id }, pack);
    expect(removed.refusal).toBeUndefined();
    expect(removed.state.tasks.map((task) => task.name)).toEqual(["Basic Respite"]);
    expect(blocks(removed.state).map((result) => result.ruleId)).toEqual(["AUTH-09"]);

    // Raising Monday to 60 minutes no longer adds a break of its own: over-authorization is a
    // warning now, so the change is accepted while the plan's own AUTH-09 break stays.
    const basic = removed.state.tasks[0]!.id;
    const raised = reduce(removed.state, { type: "setCell", key: `${basic}:1`, minutes: 60 }, pack);
    expect(raised.refusal).toBeUndefined();
    expect(raised.state.edits[`${basic}:1`]).toBe(60);
    expect(blocks(raised.state).map((result) => result.ruleId)).toEqual(["AUTH-09"]);
  });
});

describe("QS-07 / QS-10: days and minute changes follow the tasks", () => {
  const entryOf = (state: QuickState, taskId: string) =>
    buildQuickModel(state, pack).entries.filter((entry) => entry.taskId === taskId);

  it("a minute change is dropped when its task moves to another day, and doesn't come back", () => {
    // Fixture B: Laundry (140 min, once a week) sits on Monday while transportation is on Sunday.
    const state = exampleStateB(TODAY);
    const laundry = state.tasks.find((task) => task.name === "Laundry (Off Site)")!.id;
    expect(entryOf(state, laundry).map((entry) => entry.weekday)).toEqual([1]);

    let next = run(state, { type: "setCell", key: `${laundry}:1`, minutes: 100 });
    expect(next.edits).toEqual({ [`${laundry}:1`]: 100 });

    // Transportation on Monday makes Monday the heaviest day, so Laundry moves to Tuesday.
    next = run(next, { type: "setTransportDay", day: 1 });
    expect(entryOf(next, laundry).map((entry) => entry.weekday)).toEqual([2]);
    expect(next.edits).toEqual({});

    // Moving transportation back puts Laundry back on Monday at its full 140 minutes.
    next = run(next, { type: "setTransportDay", day: 0 });
    expect(entryOf(next, laundry)).toEqual([{ taskId: laundry, weekday: 1, minutes: 140 }]);
  });

  it("a task authorized for one day can be moved: unselect its day, then choose another", () => {
    const state = exampleStateB(TODAY);
    const cleanBath = state.tasks.find((task) => task.name === "Clean Bath")!;
    const placed = entryOf(state, cleanBath.id).map((entry) => entry.weekday);
    const day = placed[0]!;
    const other: Weekday = day === 3 ? 4 : 3;

    // Another day first is refused (AC-10).
    const refused = reduce(state, { type: "togglePinDay", taskId: cleanBath.id, weekday: other, placedDays: placed }, pack);
    expect(refused.refusal).toBe("Clean Bath is authorized for 1 day a week. Unselect a day first.");

    // Unselecting its day takes it off the week (it does not jump back to the same day)...
    const off = run(state, { type: "togglePinDay", taskId: cleanBath.id, weekday: day, placedDays: placed });
    expect(off.tasks.find((task) => task.id === cleanBath.id)!.pinned).toEqual([]);
    expect(entryOf(off, cleanBath.id)).toEqual([]);
    expect(blocks(off)).toEqual([]);

    // ...and choosing another day puts it there.
    const moved = run(off, { type: "togglePinDay", taskId: cleanBath.id, weekday: other, placedDays: [] });
    expect(entryOf(moved, cleanBath.id).map((entry) => entry.weekday)).toEqual([other]);

    // "Let us choose" gives the day back to the composer.
    const unpinned = run(moved, { type: "unpin", taskId: cleanBath.id });
    expect(entryOf(unpinned, cleanBath.id).map((entry) => entry.weekday)).toEqual(placed);
  });

  it("QS-08: turning off a task's only pinned day hands its days back to the composer", () => {
    let state = run(manualState(TODAY), { type: "addTask", taskCode: "CLEAN_BATH", name: "Clean Bath" });
    const id = state.tasks[0]!.id;
    state = run(state, { type: "setDaysPerWeek", taskId: id, days: 1 });
    const placed = entryOf(state, id).map((entry) => entry.weekday);
    const other: Weekday = placed[0] === 3 ? 4 : 3;
    state = run(
      state,
      { type: "togglePinDay", taskId: id, weekday: placed[0]!, placedDays: placed },
      { type: "togglePinDay", taskId: id, weekday: other, placedDays: [] },
    );
    expect(state.tasks[0]!.pinned).toEqual([other]);

    state = run(state, { type: "toggleCareDay", weekday: other });
    expect(state.tasks[0]!.pinned).toBeNull();
    expect(entryOf(state, id)).toHaveLength(1);
  });
});

describe("Fusion plans keep their plan values (APP-SPEC 5.2)", () => {
  const fusion = exampleStateB(TODAY);
  const someTask = fusion.tasks[0]!;
  const locked: QuickAction[] = [
    { type: "setService", code: "S5130" },
    { type: "setPlanStart", month: "2027-01" },
    { type: "addTask", taskCode: "MAKE_BED", name: "Make Bed" },
    { type: "removeTask", taskId: someTask.id },
    { type: "setMinutes", taskId: someTask.id, minutes: 30 },
    { type: "setDaysPerWeek", taskId: someTask.id, days: 3 },
    { type: "setFusionUnits", month: "2026-01", units: 100 },
  ];
  for (const action of locked) {
    it(`ignores ${action.type} on a plan read from Fusion`, () => {
      expect(reduce(fusion, action, pack).state).toBe(fusion);
    });
  }
});

describe("the reducer only accepts what the inputs allow", () => {
  it("QS-01: does not switch to nurse visits, which are visits, not tasks", () => {
    const state = manualState(TODAY);
    expect(reduce(state, { type: "setService", code: "T1001" }, pack).state).toBe(state);
  });

  it("QS-04: adds only tasks of the service's program that aren't transportation or already added", () => {
    let state = run(manualState(TODAY), { type: "addTask", taskCode: "BATHING", name: "Bathing" });
    for (const action of [
      { type: "addTask", taskCode: "BATHING", name: "Bathing" },
      { type: "addTask", taskCode: "ESSENTIAL_TRANSPORTATION", name: "Essential Transportation" },
      { type: "addTask", taskCode: "IRON_MEND", name: "Iron/Mend" },
      { type: "addTask", taskCode: "NOT_A_TASK", name: "Not a task" },
    ] satisfies QuickAction[]) {
      expect(reduce(state, action, pack).state).toBe(state);
    }
    state = run(state, { type: "addTask", taskCode: "TRASH", name: "Trash" });
    expect(state.tasks.map((task) => task.name)).toEqual(["Bathing", "Trash"]);
  });

  it("QS-10: ignores cell minutes that aren't whole minutes from 0 to 1440", () => {
    const state = exampleStateB(TODAY);
    const key = `${state.tasks[1]!.id}:1`;
    for (const minutes of [-5, 7.5, 1441, Number.NaN]) {
      expect(reduce(state, { type: "setCell", key, minutes }, pack).state).toBe(state);
    }
    expect(reduce(state, { type: "setCell", key, minutes: 30 }, pack).state.edits[key]).toBe(30);
  });

  it("QS-07: does not pin a day that isn't a care day", () => {
    const state = run(manualState(TODAY), { type: "addTask", taskCode: "BATHING", name: "Bathing" });
    const offSunday = run(state, { type: "toggleCareDay", weekday: 0 });
    const task = offSunday.tasks[0]!;
    const action: QuickAction = { type: "togglePinDay", taskId: task.id, weekday: 0, placedDays: [1, 2, 3, 4, 5, 6] };
    expect(reduce(offSunday, action, pack).state).toBe(offSunday);
  });

  it("QS-11: ignores Fusion units that aren't whole numbers of 0 or more", () => {
    const state = manualState(TODAY);
    for (const units of [-1, 2.5]) {
      expect(reduce(state, { type: "setFusionUnits", month: "2026-11", units }, pack).state).toBe(state);
    }
  });
});

describe("months come from the person's own calendar, not UTC", () => {
  let savedTz: string | undefined;
  beforeAll(() => {
    savedTz = process.env.TZ;
    process.env.TZ = "America/Chicago";
  });
  afterAll(() => {
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  // 10 pm on Oct 31 in Missouri is already Nov 1 in UTC.
  const halloweenNight = new Date("2026-10-31T22:00:00-05:00");

  it("QS-03: a by-hand plan starts next calendar month (November), not December", () => {
    expect(manualState(halloweenNight).plan.start).toBe("2026-11-01");
  });

  it("IMPORT-SPEC 4: an imported plan shows the current month (October 2026)", () => {
    expect(exampleStateB(halloweenNight).viewMonth).toBe("2026-10");
  });
});
