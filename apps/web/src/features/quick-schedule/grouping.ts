import type { ScheduleValidationResult } from "@careplan/engine";
import type { CheckGroup } from "./types.js";
import { monthName } from "../../lib/format";

/**
 * APP-SPEC 5.5: group results by ruleId + severity + taskId, keeping each group's months in
 * chronological order, and order the groups Must fix, Needs review, Check, Good to know.
 */
export function groupResults(results: ScheduleValidationResult[]): CheckGroup[] {
  const byKey = new Map<string, CheckGroup>();
  for (const result of results) {
    const key = `${result.ruleId}|${result.severity}|${result.refs.taskId ?? ""}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        ruleId: result.ruleId,
        severity: result.severity,
        taskId: result.refs.taskId,
        months: [],
        messages: [],
        rulePackVersion: result.rulePackVersion,
      };
      byKey.set(key, group);
    }
    if (result.refs.month && !group.months.includes(result.refs.month)) {
      group.months.push(result.refs.month);
    }
    group.messages.push(result.message);
  }

  const ordered: CheckGroup[] = [];
  for (const severity of ["BLOCK", "REVIEW", "WARN", "INFO"] as const) {
    for (const group of byKey.values()) {
      if (group.severity === severity) {
        group.months.sort();
        ordered.push(group);
      }
    }
  }
  return ordered;
}

/**
 * "8 of 11 months", "every month of the plan", or the single month's name. Null when the group
 * has no months (e.g. a task-level SCH-02 result has no month ref).
 */
export function monthsContext(months: string[], monthCount: number): string | null {
  if (months.length === 0) return null;
  if (months.length === 1) return monthName(months[0]!);
  if (months.length === monthCount) return "every month of the plan";
  return `${months.length} of ${monthCount} months`;
}

/** "Bathing, 8 of 11 months" — the task name and month context joined when both exist. */
export function contextFor(
  group: CheckGroup,
  taskName: string | undefined,
  monthCount: number,
): string {
  return [taskName, monthsContext(group.months, monthCount)]
    .filter((part): part is string => Boolean(part))
    .join(", ");
}
