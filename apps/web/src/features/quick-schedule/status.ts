import { groupResults } from "./grouping";
import { hasSchedule, monthFigures } from "./model";
import type { QuickModel, QuickState } from "./types";

export interface ScheduleStatus {
  /** "Add tasks to start", "Ready to use" or "2 things to fix". */
  title: string;
  detail: string;
  /** Any Must fix group (only possible when the imported plan itself breaks a rule). */
  blocked: boolean;
  weekMinutes: number;
  /** Authorized units in the viewed month. */
  monthUnits: number;
  careDays: number;
}

/**
 * APP-SPEC 5.4 Status: whether the schedule is ready to use, from the grouped check results (one
 * group = one card in Checks), with the week's minutes, the viewed month's units and the care
 * days. The screen's status panel and the printed schedule both say it this way.
 */
export function scheduleStatus(state: QuickState, model: QuickModel): ScheduleStatus {
  if (!hasSchedule(model)) {
    return {
      title: "Add tasks to start",
      detail: "Your schedule and checks appear here.",
      blocked: false,
      weekMinutes: 0,
      monthUnits: 0,
      careDays: 0,
    };
  }

  const groups = groupResults(model.results);
  const blocks = groups.filter((group) => group.severity === "BLOCK").length;
  const attention = groups.filter((group) => group.severity === "REVIEW" || group.severity === "WARN").length;

  // The schedule starts this month when the plan started earlier (APP-SPEC 5.3 step 5).
  const count = model.months.length;
  const left = model.auth.start > state.plan.start;
  const span =
    count === 1
      ? left ? "for the one month left in the plan" : "for its one month"
      : left ? `for the ${count} months left in the plan` : `for all ${count} months`;

  return {
    title: blocks > 0 ? `${blocks} ${blocks === 1 ? "thing" : "things"} to fix` : "Ready to use",
    detail:
      blocks > 0
        ? "This care plan itself breaks a Missouri rule. Details are in Checks."
        : attention > 0
          ? `Follows every rule we check. ${attention} ${attention === 1 ? "item is" : "items are"} worth a look in Checks.`
          : `Follows every rule we check, ${span}.`,
    blocked: blocks > 0,
    // Transportation alone (a CDS service with no tasks): the week is its set-aside time.
    weekMinutes: model.tasks.length > 0 ? model.entries.reduce((sum, entry) => sum + entry.minutes, 0) : (model.allowance?.weeklyMinutes ?? 0),
    monthUnits: monthFigures(model, state.viewMonth).authorizedUnits,
    careDays: model.tasks.length > 0 ? new Set(model.entries.map((entry) => entry.weekday)).size : 1,
  };
}
