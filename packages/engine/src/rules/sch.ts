import { daysInMonth } from "../math/dates.js";
import { monthTaskUnits } from "../math/units.js";
import { expandMonth, monthTaskMinutes } from "../calendar/expand.js";
import type {
  AuthorizedTask,
  CalendarException,
  MonthlyAuthorization,
  ScheduleTemplate,
  ServiceAuthorization,
  ValidationResult,
  Visit,
} from "../types.js";

/**
 * @rule SCH-02
 * @source 3.00 Appendix 1 (rev. Jul 2026)
 */
export function ruleSCH02TemplateDays(
  template: ScheduleTemplate,
  tasks: AuthorizedTask[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const task of tasks) {
    const weekdays = new Set(
      template.entries.filter((entry) => entry.taskId === task.id).map((entry) => entry.weekday),
    );
    const count = weekdays.size;
    if (count > task.daysPerWeek) {
      results.push({
        ruleId: "SCH-02",
        severity: "BLOCK",
        message: `Task scheduled on ${count} weekdays exceeds daysPerWeek ${task.daysPerWeek}`,
        refs: { taskId: task.id },
      });
    } else if (count < task.daysPerWeek) {
      results.push({
        ruleId: "SCH-02",
        severity: "WARN",
        message: `Task scheduled on ${count} weekdays below daysPerWeek ${task.daysPerWeek}`,
        refs: { taskId: task.id },
      });
    }
  }
  return results;
}

/**
 * @rule SCH-03
 * @source 3.00 Appendix 1 (rev. Jul 2026)
 */
export function ruleSCH03TemplateMinutes(
  template: ScheduleTemplate,
  tasks: AuthorizedTask[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const entry of template.entries) {
    const task = byId.get(entry.taskId);
    if (task && entry.minutes > task.minPerDay) {
      results.push({
        ruleId: "SCH-03",
        severity: "WARN",
        message: `Occurrence ${entry.minutes} min exceeds minPerDay ${task.minPerDay}`,
        refs: { taskId: task.id },
      });
    }
  }
  return results;
}

/**
 * @rule SCH-08
 * @source 3.00 Appendix 1 (rev. Jul 2026)
 */
export function ruleSCH08CalendarCheck(
  template: ScheduleTemplate,
  exceptions: CalendarException[],
  months: string[],
  tasks: AuthorizedTask[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const month of months) {
    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const monthNum = Number(monthStr);
    const expanded = expandMonth(template, exceptions, year, monthNum, template.start, template.end);
    const scheduled = monthTaskMinutes(expanded);
    for (const [taskId, minutes] of Object.entries(scheduled)) {
      const task = byId.get(taskId);
      if (!task) continue;
      const units = monthTaskUnits(task.minPerDay * task.daysPerWeek, task.daysPerWeek, daysInMonth(year, monthNum)).units;
      if (minutes > 15 * units) {
        results.push({
          ruleId: "SCH-08",
          severity: "BLOCK",
          message: `Scheduled ${minutes} min exceeds ${15 * units} min (${units} units) in ${month}`,
          refs: { taskId, month },
        });
      }
    }
  }
  return results;
}

function monthsBetween(startMonth: string, endMonth: string): string[] {
  const [sy, sm] = startMonth.split("-").map((n) => Number(n));
  const [ey, em] = endMonth.split("-").map((n) => Number(n));
  const months: string[] = [];
  let year = sy!;
  let month = sm!;
  while (year < ey! || (year === ey && month <= em!)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    if (month === 12) {
      year += 1;
      month = 1;
    } else {
      month += 1;
    }
  }
  return months;
}

/**
 * @rule SCH-11
 * @source 3.00 Appendix 1 (rev. Jul 2026)
 */
export function ruleSCH11RepeatedExceptions(exceptions: CalendarException[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  const monthsByTask = new Map<string, Set<string>>();
  for (const ex of exceptions) {
    const month = ex.date.slice(0, 7);
    const set = monthsByTask.get(ex.taskId) ?? new Set<string>();
    set.add(month);
    monthsByTask.set(ex.taskId, set);
  }
  for (const [taskId, months] of monthsByTask) {
    const sorted = [...months].sort();
    for (let i = 0; i < sorted.length - 1; i++) {
      const [y1, m1] = sorted[i]!.split("-").map((n) => Number(n));
      const [y2, m2] = sorted[i + 1]!.split("-").map((n) => Number(n));
      const consecutive = (y1 === y2 && m2 === m1! + 1) || (y2 === y1! + 1 && m1 === 12 && m2 === 1);
      if (consecutive) {
        results.push({
          ruleId: "SCH-11",
          severity: "WARN",
          message: "Exception repeated in consecutive months; consider a care plan change request",
          refs: { taskId },
        });
        break;
      }
    }
  }
  return results;
}

/**
 * @rule SCH-12
 * @source 3.00 Appendix 1 (rev. Jul 2026)
 */
export function ruleSCH12PartialMonth(
  authorizations: ServiceAuthorization[],
  monthlyAuthorizations: MonthlyAuthorization[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const imported = new Set(
    monthlyAuthorizations
      .filter((ma) => ma.source === "fusion")
      .map((ma) => `${ma.serviceAuthId}:${ma.month}`),
  );
  for (const auth of authorizations) {
    for (const month of monthsBetween(auth.start.slice(0, 7), auth.end.slice(0, 7))) {
      const [year, monthNum] = month.split("-").map((n) => Number(n));
      const first = `${month}-01`;
      const last = `${month}-${String(daysInMonth(year!, monthNum!)).padStart(2, "0")}`;
      const partial = auth.start > first || auth.end < last;
      if (partial && !imported.has(`${auth.id}:${month}`)) {
        results.push({
          ruleId: "SCH-12",
          severity: "REVIEW",
          message: `Partial month ${month} has no imported figure`,
          refs: { serviceAuthId: auth.id, month },
        });
      }
    }
  }
  return results;
}

/**
 * @rule SCH-14
 * @source 3.00 Appendix 1 (rev. Jul 2026)
 */
export function ruleSCH14VisitDates(
  visits: Visit[],
  authorizations: ServiceAuthorization[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const authByKey = new Map<string, ServiceAuthorization>();
  for (const auth of authorizations) {
    authByKey.set(`${auth.participantId}:${auth.serviceCode}`, auth);
  }
  for (const visit of visits) {
    const auth = authByKey.get(`${visit.participantId}:${visit.serviceCode}`);
    if (!auth) continue;
    const date = visit.start.slice(0, 10);
    if (date < auth.start || date > auth.end) {
      results.push({
        ruleId: "SCH-14",
        severity: "BLOCK",
        message: `Visit on ${date} outside authorization ${auth.start}..${auth.end}`,
        refs: { visitId: visit.id, date },
      });
    }
    for (const suspension of auth.suspensions) {
      if (date >= suspension.start && date <= suspension.end) {
        results.push({
          ruleId: "SCH-14",
          severity: "BLOCK",
          message: `Visit on ${date} during suspension ${suspension.start}..${suspension.end}`,
          refs: { visitId: visit.id, date },
        });
      }
    }
    if (auth.state === "future") {
      results.push({
        ruleId: "SCH-14",
        severity: "INFO",
        message: "draft only",
        refs: { visitId: visit.id, date },
      });
    }
  }
  return results;
}
