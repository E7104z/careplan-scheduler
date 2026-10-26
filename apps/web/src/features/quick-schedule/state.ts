import { type DaysPerWeek, type RulePack, type ServiceCode, type Weekday } from "@careplan/engine";
import { addMonths, lastDayIso } from "./model.js";
import { refusalText, tryChange } from "./guard.js";
import type { ManualTransport, QuickState, QuickTask } from "./types.js";

// The starting states (by hand, and the two examples) live in their own file.
export { exampleStateA, exampleStateB, manualState } from "./initialStates.js";

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
  | { type: "setReviewed"; date: string | null }
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

/** Whole minutes in a day: 0 to 1440. */
function isDayMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 1440;
}

/**
 * Apply a person's change through the guard (APP-SPEC 5.7, .clinerules 19a); a refused change
 * returns the original state and the sentence explaining why. An accepted change also drops cell
 * changes whose task is no longer on that day (QS-10), so they can't come back later, and clears
 * "reviewed with the participant": that review was of the schedule before the change.
 */
function guard(
  state: QuickState,
  pack: RulePack,
  mutate: (next: QuickState) => void,
): ReducerResult {
  const next = clone(state);
  mutate(next);
  const result = tryChange(next, pack, state);
  if (!result.ok) {
    return { state, refusal: refusalText(result.blocks, next, result.model) };
  }
  const placed = new Set(result.model.pattern.map((entry) => `${entry.taskId}:${entry.weekday}`));
  for (const key of Object.keys(next.edits)) {
    if (!placed.has(key)) delete next.edits[key];
  }
  next.reviewed = null;
  return { state: next };
}

/**
 * QS-07: pinning starts from the composer's days (or the current pinned set, even an empty one)
 * and toggles the day. Returns null when adding the day would exceed the task's days per week.
 */
function computePinned(
  task: QuickTask,
  weekday: Weekday,
  placedDays: Weekday[],
): Weekday[] | null {
  const base = new Set(task.pinned ?? placedDays);
  if (!base.has(weekday) && base.size >= task.daysPerWeek) return null;
  if (base.has(weekday)) base.delete(weekday);
  else base.add(weekday);
  return [...base].sort((a, b) => a - b);
}

/**
 * APP-SPEC 5.6: the single reducer that owns QuickState. Every change a person makes to the
 * schedule goes through the guard. Service, plan dates, tasks and Fusion units are by-hand inputs
 * only; a plan read from Fusion keeps them (APP-SPEC 5.2), so those actions leave it unchanged.
 */
export function reduce(state: QuickState, action: QuickAction, pack: RulePack): ReducerResult {
  switch (action.type) {
    case "setService": {
      const svc = pack.services.find((service) => service.code === action.code);
      // QS-01: only the 15-minute services; nurse visits are visits, not tasks.
      if (state.source !== "manual" || !svc || svc.unit !== "15min") return { state };
      // QS-02: remove tasks whose taskCode is not available to the new program, keep care days.
      const removed = state.tasks.filter(
        (task) =>
          !pack.tasks.find((def) => def.taskCode === task.taskCode)?.programs.includes(svc.program),
      );
      const removedIds = new Set(removed.map((task) => task.id));
      const result = guard(state, pack, (next) => {
        next.serviceCode = action.code;
        next.tasks = next.tasks.filter((task) => !removedIds.has(task.id));
        next.edits = {};
      });
      return result.refusal === undefined
        ? { ...result, removed: removed.map((task) => task.name) }
        : result;
    }
    case "setPlanStart": {
      // QS-03: a whole month, not before the month the schedule was started (that's over).
      if (state.source !== "manual" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(action.month) || action.month < state.fromMonth) {
        return { state };
      }
      // QS-03: end = start + 11 months; changing the start clears Fusion units.
      return guard(state, pack, (next) => {
        next.plan = { start: `${action.month}-01`, end: lastDayIso(addMonths(action.month, 11)) };
        next.viewMonth = action.month;
        next.fusion = {};
      });
    }
    case "addTask": {
      // QS-04: a task of the service's program, not transportation, not already added.
      const svc = pack.services.find((service) => service.code === state.serviceCode);
      const def = pack.tasks.find((task) => task.taskCode === action.taskCode);
      if (
        state.source !== "manual" ||
        !svc ||
        !def ||
        def.isTransport === true ||
        !def.programs.includes(svc.program) ||
        state.tasks.some((task) => task.taskCode === action.taskCode)
      ) {
        return { state };
      }
      // New tasks default to 15 min/day, every day, not pinned.
      return guard(state, pack, (next) => {
        next.tasks.push({
          id: `qt-${next.nextId}`,
          taskCode: action.taskCode,
          name: action.name,
          minPerDay: 15,
          daysPerWeek: 7,
          pinned: null,
          locked: false,
        });
        next.nextId += 1;
      });
    }
    case "removeTask": {
      if (state.source !== "manual" || !taskById(state, action.taskId)) return { state };
      return guard(state, pack, (next) => {
        next.tasks = next.tasks.filter((task) => task.id !== action.taskId);
        dropEdits(next, action.taskId);
      });
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
      // QS-07: non-care days can't be chosen.
      if (!task || state.activeDays[action.weekday] !== true) return { state };
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
      // QS-08: turning a day off removes it from every pinned set and clears minute changes. A set
      // left empty goes back to our choice, so the task keeps its days.
      return guard(state, pack, (next) => {
        next.activeDays[action.weekday] = !next.activeDays[action.weekday];
        for (const task of next.tasks) {
          if (!task.pinned || task.pinned.length === 0) continue;
          const kept = task.pinned.filter((day) => next.activeDays[day]);
          task.pinned = kept.length > 0 ? kept : null;
        }
        next.edits = {};
      });
    }
    case "setCell": {
      // QS-10: whole minutes only; 0 removes that day for that task.
      if (!isDayMinutes(action.minutes)) return { state };
      return guard(state, pack, (next) => {
        next.edits[action.key] = action.minutes;
      });
    }
    case "undoCellChanges": {
      // Back to the pattern, which fits by construction; not guarded, so it is always possible.
      const next = clone(state);
      next.edits = {};
      next.reviewed = null;
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
      // QS-11: the care plan's own figure, entered by hand. Like loading a plan it isn't guarded:
      // a figure that breaks a rule is shown in Checks, not hidden.
      if (state.source !== "manual") return { state };
      if (action.units !== null && !(Number.isInteger(action.units) && action.units >= 0)) {
        return { state };
      }
      const next = clone(state);
      if (action.units === null) delete next.fusion[action.month];
      else next.fusion[action.month] = action.units;
      next.reviewed = null;
      return { state: next };
    }
    case "setViewMonth": {
      const next = clone(state);
      next.viewMonth = action.month;
      return { state: next };
    }
    case "setReviewed": {
      // Not a change to the schedule, so not guarded: a record that it was gone over with the
      // participant (INFO 09-25-02), on a real date.
      if (action.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(action.date)) return { state };
      const next = clone(state);
      next.reviewed = action.date;
      return { state: next };
    }
    case "replace": {
      return { state: action.state };
    }
  }
}
