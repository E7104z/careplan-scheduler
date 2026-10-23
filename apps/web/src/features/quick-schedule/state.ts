import {
  MO_2026_07,
  type DaysPerWeek,
  type RulePack,
  type ServiceCode,
  type Weekday,
} from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { addMonths, lastDayIso } from "./model.js";
import { refusalText, tryChange } from "./guard.js";
import { fromFusion } from "../import/fromFusion.js";
import type { ManualTransport, QuickState, QuickTask } from "./types.js";
import fixtureA from "@fixtures/fusion/A-run-together-5day-466.txt?raw";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";

export interface ReducerResult {
  state: QuickState;
  /** Set when a guarded change was refused: the sentence or pin-limit hint. */
  refusal?: string;
  /** Task names removed by a service change, for the toast. */
  removed?: string[];
}

export type QuickAction =
  | { type: "setService"; code: ServiceCode }
  | { type: "setPlanStart"; month: string }
  | { type: "addTask"; taskCode: string; name: string }
  | { type: "removeTask"; taskId: string }
  | { type: "setMinutes"; taskId: string; minutes: number | null }
  | { type: "setDaysPerWeek"; taskId: string; days: DaysPerWeek }
  | { type: "togglePinDay"; taskId: string; weekday: Weekday; placedDays: Weekday[] }
  | { type: "unpin"; taskId: string }
  | { type: "toggleCareDay"; weekday: Weekday }
  | { type: "setCell"; key: string; minutes: number }
  | { type: "undoCellChanges" }
  | { type: "setTransportMinPerTrip"; value: number }
  | { type: "setTransportTripsPerWeek"; value: DaysPerWeek }
  | { type: "setTransportDay"; day: Weekday }
  | { type: "setFusionUnits"; month: string; units: number | null }
  | { type: "setViewMonth"; month: string }
  | { type: "replace"; state: QuickState };

function clone(state: QuickState): QuickState {
  return structuredClone(state);
}

function taskById(state: QuickState, id: string): QuickTask | undefined {
  return state.tasks.find((task) => task.id === id);
}

/** QS-10: changing a task's minutes, days or pins clears that task's cell changes. */
function dropEdits(state: QuickState, taskId: string): void {
  for (const key of Object.keys(state.edits)) {
    if (key.startsWith(`${taskId}:`)) delete state.edits[key];
  }
}

/** Apply a person's change through the guard; a refused change returns the original state. */
function guard(
  state: QuickState,
  pack: RulePack,
  mutate: (next: QuickState) => void,
): ReducerResult {
  const next = clone(state);
  mutate(next);
  const result = tryChange(next, pack);
  if (!result.ok) {
    return { state, refusal: refusalText(result.blocks, next, result.model) };
  }
  return { state: next };
}

/**
 * QS-07: pinning starts from the composer's days (or the current pinned set) and toggles the
 * day. Returns null when adding the day would exceed the task's days per week.
 */
function computePinned(
  task: QuickTask,
  weekday: Weekday,
  placedDays: Weekday[],
): Weekday[] | null {
  const base = new Set(task.pinned && task.pinned.length > 0 ? task.pinned : placedDays);
  if (!base.has(weekday) && base.size >= task.daysPerWeek) return null;
  if (base.has(weekday)) base.delete(weekday);
  else base.add(weekday);
  return [...base].sort((a, b) => a - b);
}

/** APP-SPEC 5.2 QS-01/QS-03: an empty by-hand schedule starting next calendar month. */
export function manualState(today: Date): QuickState {
  const start = addMonths(today.toISOString().slice(0, 7), 1);
  return {
    source: "manual",
    identity: null,
    provider: null,
    pa: null,
    serviceLabel: null,
    serviceCode: "T1019U2",
    plan: { start: `${start}-01`, end: lastDayIso(addMonths(start, 11)) },
    headerUnits: null,
    tasks: [],
    nextId: 1,
    activeDays: [true, true, true, true, true, true, true],
    transport: { minPerTrip: 0, tripsPerWeek: 1, day: 1 },
    edits: {},
    fusion: {},
    viewMonth: start,
    isExample: false,
    notes: [],
    rowsRead: 0,
  };
}

/** The de-identified fixture A, imported as if pasted (QS-12). */
export function exampleStateA(today: Date): QuickState {
  const parsed = parseFusionText(fixtureA, MO_2026_07);
  return { ...fromFusion(parsed, 0, today), isExample: true };
}

/** The de-identified fixture B, imported as if pasted (QS-12). */
export function exampleStateB(today: Date): QuickState {
  const parsed = parseFusionText(fixtureB, MO_2026_07);
  return { ...fromFusion(parsed, 0, today), isExample: true };
}


/** APP-SPEC 5.6: the single reducer that owns QuickState. */
export function reduce(state: QuickState, action: QuickAction, pack: RulePack): ReducerResult {
  switch (action.type) {
    case "setService": {
      const svc = pack.services.find((service) => service.code === action.code);
      if (!svc) return { state };
      // QS-02: remove tasks whose taskCode is not available to the new program, keep care days.
      const removed = state.tasks.filter(
        (task) =>
          !pack.tasks.find((def) => def.taskCode === task.taskCode)?.programs.includes(svc.program),
      );
      const removedIds = new Set(removed.map((task) => task.id));
      const next = clone(state);
      next.serviceCode = action.code;
      if (removed.length > 0) next.tasks = next.tasks.filter((task) => !removedIds.has(task.id));
      next.edits = {};
      return { state: next, removed: removed.map((task) => task.name) };
    }
    case "setPlanStart": {
      // QS-03: end = start + 11 months; changing the start clears Fusion units.
      const next = clone(state);
      next.plan = { start: `${action.month}-01`, end: lastDayIso(addMonths(action.month, 11)) };
      next.viewMonth = action.month;
      next.fusion = {};
      return { state: next };
    }
    case "addTask": {
      // QS-04: new tasks default to 15 min/day, every day, not pinned.
      const next = clone(state);
      const id = `qt-${next.nextId}`;
      next.nextId += 1;
      next.tasks.push({
        id,
        taskCode: action.taskCode,
        name: action.name,
        minPerDay: 15,
        daysPerWeek: 7,
        pinned: null,
        locked: false,
      });
      return { state: next };
    }
    case "removeTask": {
      const next = clone(state);
      next.tasks = next.tasks.filter((task) => task.id !== action.taskId);
      dropEdits(next, action.taskId);
      return { state: next };
    }
    case "setMinutes": {
      const task = taskById(state, action.taskId);
      if (!task || task.locked) return { state };
      return guard(state, pack, (next) => {
        const target = taskById(next, action.taskId)!;
        target.minPerDay = action.minutes;
        dropEdits(next, action.taskId);
      });
    }
    case "setDaysPerWeek": {
      const task = taskById(state, action.taskId);
      if (!task || task.locked) return { state };
      return guard(state, pack, (next) => {
        const target = taskById(next, action.taskId)!;
        target.daysPerWeek = action.days;
        if (target.pinned && target.pinned.length > action.days) {
          target.pinned = target.pinned.slice(0, action.days);
        }
        dropEdits(next, action.taskId);
      });
    }
    case "togglePinDay": {
      const task = taskById(state, action.taskId);
      if (!task) return { state };
      const pinned = computePinned(task, action.weekday, action.placedDays);
      if (pinned === null) {
        return {
          state,
          refusal: `${task.name} is authorized for ${task.daysPerWeek} ${
            task.daysPerWeek === 1 ? "day" : "days"
          } a week. Unselect a day first.`,
        };
      }
      return guard(state, pack, (next) => {
        const target = taskById(next, action.taskId)!;
        target.pinned = pinned;
        dropEdits(next, action.taskId);
      });
    }
    case "unpin": {
      const task = taskById(state, action.taskId);
      if (!task) return { state };
      return guard(state, pack, (next) => {
        const target = taskById(next, action.taskId)!;
        target.pinned = null;
        dropEdits(next, action.taskId);
      });
    }
    case "toggleCareDay": {
      // QS-08: turning a day off removes it from every pinned set and clears minute changes.
      return guard(state, pack, (next) => {
        next.activeDays[action.weekday] = !next.activeDays[action.weekday];
        for (const task of next.tasks) {
          if (task.pinned) task.pinned = task.pinned.filter((day) => next.activeDays[day]);
        }
        next.edits = {};
      });
    }
    case "setCell": {
      return guard(state, pack, (next) => {
        next.edits[action.key] = action.minutes;
      });
    }
    case "undoCellChanges": {
      const next = clone(state);
      next.edits = {};
      return { state: next };
    }
    case "setTransportMinPerTrip": {
      if (state.source !== "manual") return { state };
      return guard(state, pack, (next) => {
        const transport = next.transport as ManualTransport;
        transport.minPerTrip =
          Number.isInteger(action.value) && action.value > 0 ? action.value : 0;
      });
    }
    case "setTransportTripsPerWeek": {
      if (state.source !== "manual") return { state };
      return guard(state, pack, (next) => {
        (next.transport as ManualTransport).tripsPerWeek = action.value;
      });
    }
    case "setTransportDay": {
      return guard(state, pack, (next) => {
        next.transport.day = action.day;
      });
    }
    case "setFusionUnits": {
      const next = clone(state);
      if (action.units === null) delete next.fusion[action.month];
      else next.fusion[action.month] = action.units;
      return { state: next };
    }
    case "setViewMonth": {
      const next = clone(state);
      next.viewMonth = action.month;
      return { state: next };
    }
    case "replace": {
      return { state: action.state };
    }
  }
}
