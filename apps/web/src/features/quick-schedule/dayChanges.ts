import type { RulePack } from "@careplan/engine";
import { niceDate } from "../../lib/format";
import { refusalText, tryChange } from "./guard.js";
import type { CarePlan, DayChange, QuickState } from "./types.js";

export interface DayChangeResult {
  plan: CarePlan;
  refusal?: string;
}

/**
 * "Change this day" (CP3-7): set the minutes a task has on one date, as a calendar exception over
 * the weekly pattern. The pattern and the authorization are never edited. It goes through the
 * guard (APP-SPEC 5.7): a change that would break a Must-fix rule, such as putting the month over
 * its units, is refused with the limit and nothing changes. Setting the pattern's own minutes back
 * removes the change.
 */
export function changeDay(plan: CarePlan, service: number, change: DayChange, pack: RulePack): DayChangeResult {
  const state = plan.services[service];
  const refuse = (why: string): DayChangeResult => ({ plan, refusal: `Not changed. ${why}` });
  if (!state) return refuse("That service isn't in this care plan.");
  if (!Number.isInteger(change.minutes) || change.minutes < 0 || change.minutes > 1440) {
    return refuse("Enter the minutes as a whole number from 0 to 1440.");
  }
  if (!state.tasks.some((task) => task.id === change.taskId)) return refuse("That task isn't in this service.");
  if (change.date < state.plan.start || change.date > state.plan.end) {
    return refuse(`${niceDate(change.date)} is outside the plan's dates.`);
  }
  const others = (state.dayChanges ?? []).filter((existing) => !(existing.date === change.date && existing.taskId === change.taskId));
  const next: QuickState = { ...state, dayChanges: [...others, change], reviewed: null };
  const result = tryChange(next, pack, state);
  if (!result.ok) return refuse(refusalText(result.blocks, { ...next, viewMonth: change.date.slice(0, 7) }, result.model));
  // A change equal to what the pattern gives that date is no change: it leaves no exception behind.
  const kept = result.model.dayExceptions.some((exception) => exception.date === change.date && exception.taskId === change.taskId);
  const services = plan.services.map((existing, index) =>
    index === service ? { ...next, dayChanges: kept ? next.dayChanges : others } : existing,
  );
  return { plan: { ...plan, services } };
}
