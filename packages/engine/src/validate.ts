import { daysInMonth, formatYmd } from "./math/dates.js";
import { derivedServiceMonthUnits } from "./math/units.js";
import { expandMonth } from "./calendar/expand.js";
import { splitByDate } from "./calendar/time.js";
import {
  ruleAUTH03DerivedTaskUnits,
  ruleAUTH05DerivedMonthUnits,
  ruleAUTH06MigratedPlan,
  ruleAUTH07DerivedVsFusion,
  ruleAUTH08Transport,
  ruleAUTH09Ceiling,
  ruleAUTH11ProjectIlwSwitch,
  ruleAUTH12PendingApproval,
} from "./rules/auth.js";
import {
  ruleSCH02TemplateDays,
  ruleSCH03TemplateMinutes,
  ruleSCH08CalendarCheck,
  ruleSCH11RepeatedExceptions,
  ruleSCH12PartialMonth,
  ruleSCH14VisitDates,
} from "./rules/sch.js";
import {
  ruleCON01SameServiceOverlap,
  ruleCON02DifferentServiceOverlap,
  ruleCON03RespiteOverlap,
  ruleCON04CaregiverOverlap,
  ruleCON05CaregiverHours,
  ruleCON06AttendantRelationship,
  ruleCON07AgencyAide,
  ruleCON09WeeklyHours,
  ruleCON10NurseVisits,
  ruleCON13FirstVisit,
  ruleCON16WaiverEnrollments,
  ruleCON17QualificationData,
  type WeeklyHourGroup,
} from "./rules/conflicts.js";
import type { RulePack } from "./rulepacks/types.js";
import type {
  CalendarException,
  Caregiver,
  MonthlyAuthorization,
  ProgramCode,
  ScheduleTemplate,
  ServiceAuthorization,
  ServiceCode,
  Severity,
  ValidationResult,
  Visit,
  WaiverEnrollment,
  Weekday,
} from "./types.js";

export interface ValidateScheduleInput {
  pack: RulePack;
  authorizations: ServiceAuthorization[];
  monthlyAuthorizations: MonthlyAuthorization[];
  template: ScheduleTemplate;
  exceptions: CalendarException[];
  visits: Visit[];
  caregivers: Caregiver[];
  enrollments: WaiverEnrollment[];
  months: string[];
  tenantWorkweekStart: Weekday;
}

/** A validation result stamped with the rule-pack version it was validated under. */
export interface ScheduleValidationResult extends ValidationResult {
  rulePackVersion: string;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  BLOCK: 0,
  REVIEW: 1,
  WARN: 2,
  INFO: 3,
};

/** CON-09 limit group of each service subject to the 49 h/week cap. */
const WEEKLY_HOUR_GROUPS: Partial<Record<ServiceCode, WeeklyHourGroup>> = {
  T1019U6: "ILW",
  S5150: "RESPITE",
  S5150TF: "RESPITE",
};

function parseMonth(month: string): { year: number; month: number } {
  const [year, monthNum] = month.split("-");
  return { year: Number(year), month: Number(monthNum) };
}

/** Derived month units (tasks + transport) per serviceAuthId and month, keyed `serviceAuthId:month`. */
function derivedMonthUnits(
  authorizations: ServiceAuthorization[],
  months: string[],
): Record<string, number> {
  const derived: Record<string, number> = {};
  for (const auth of authorizations) {
    for (const month of months) {
      const { year, month: monthNum } = parseMonth(month);
      derived[`${auth.id}:${month}`] = derivedServiceMonthUnits(auth, year, monthNum);
    }
  }
  return derived;
}

/** Whole 15-minute units scheduled on each day of a month for the given task ids. */
function dailyUnitsForMonth(
  template: ScheduleTemplate,
  exceptions: CalendarException[],
  month: string,
  taskIds: Set<string>,
): number[] {
  const { year, month: monthNum } = parseMonth(month);
  const expanded = expandMonth(template, exceptions, year, monthNum, template.start, template.end);
  const units: number[] = [];
  for (let day = 1; day <= daysInMonth(year, monthNum); day++) {
    const dayMap = expanded[formatYmd(year, monthNum, day)] ?? {};
    const minutes = Object.entries(dayMap).reduce((sum, [taskId, m]) => (taskIds.has(taskId) ? sum + m : sum), 0);
    units.push(Math.floor(minutes / 15));
  }
  return units;
}

/** Sum of imported Fusion units for a program in a month, or undefined when none exist. */
function importedUnitsForProgram(
  authorizations: ServiceAuthorization[],
  monthlyAuthorizations: MonthlyAuthorization[],
  program: ProgramCode,
  month: string,
): number | undefined {
  const ids = new Set(authorizations.filter((a) => a.program === program).map((a) => a.id));
  const fusion = monthlyAuthorizations.filter(
    (ma) => ma.source === "fusion" && ma.month === month && ids.has(ma.serviceAuthId),
  );
  if (fusion.length === 0) return undefined;
  return fusion.reduce((sum, ma) => sum + ma.units, 0);
}

interface WeeklyHourMinutes {
  participantId: string;
  group: WeeklyHourGroup;
  daily: Record<string, number>;
}

/** Per-date minutes for each participant and CON-09 limit group, split by calendar date (SCH-15). */
function weeklyHoursDailyMinutes(visits: Visit[]): WeeklyHourMinutes[] {
  const byScope = new Map<string, WeeklyHourMinutes>();
  for (const visit of visits) {
    const group = WEEKLY_HOUR_GROUPS[visit.serviceCode];
    if (!group) continue;
    const key = `${visit.participantId}:${group}`;
    const scope = byScope.get(key) ?? { participantId: visit.participantId, group, daily: {} };
    for (const [date, minutes] of Object.entries(splitByDate(visit.start, visit.end))) {
      scope.daily[date] = (scope.daily[date] ?? 0) + minutes;
    }
    byScope.set(key, scope);
  }
  return [...byScope.values()];
}

/**
 * Entry point: run every rule, attach the rule-pack version (AUTH-13) to each result,
 * and return results ordered BLOCK, REVIEW, WARN, INFO.
 * @rule AUTH-13
 * @source Product decision approved Oct 20, 2026 (P-06)
 */
export function validateSchedule(input: ValidateScheduleInput): ScheduleValidationResult[] {
  const {
    pack,
    authorizations,
    monthlyAuthorizations,
    template,
    exceptions,
    visits,
    caregivers,
    enrollments,
    months,
    tenantWorkweekStart,
  } = input;

  const tasks = authorizations.flatMap((auth) => auth.tasks);
  const results: ValidationResult[] = [];

  // Authorization rules (AUTH-*)
  results.push(...ruleAUTH03DerivedTaskUnits(tasks));
  results.push(...ruleAUTH05DerivedMonthUnits(authorizations));
  results.push(...ruleAUTH06MigratedPlan(authorizations));
  results.push(...ruleAUTH07DerivedVsFusion(monthlyAuthorizations, derivedMonthUnits(authorizations, months)));
  results.push(...ruleAUTH08Transport(authorizations));
  results.push(...ruleAUTH09Ceiling(authorizations, monthlyAuthorizations));
  // The ILW switch projection counts only State Plan (CDS) and ILW task time.
  const projectionTaskIds = new Set(
    authorizations
      .filter((auth) => auth.program === "CDS" || auth.program === "ILW")
      .flatMap((auth) => auth.tasks.map((task) => task.id)),
  );
  for (const month of months) {
    const dailyUnits = dailyUnitsForMonth(template, exceptions, month, projectionTaskIds);
    const statePlanUnits = importedUnitsForProgram(authorizations, monthlyAuthorizations, "CDS", month);
    const ilwUnits = importedUnitsForProgram(authorizations, monthlyAuthorizations, "ILW", month);
    results.push(...ruleAUTH11ProjectIlwSwitch(dailyUnits, statePlanUnits, ilwUnits));
  }
  results.push(...ruleAUTH12PendingApproval(authorizations));

  // Schedule rules (SCH-*)
  results.push(...ruleSCH02TemplateDays(template, tasks));
  results.push(...ruleSCH03TemplateMinutes(template, tasks));
  results.push(...ruleSCH08CalendarCheck(authorizations, monthlyAuthorizations, template, exceptions, months));
  results.push(...ruleSCH11RepeatedExceptions(exceptions));
  results.push(...ruleSCH12PartialMonth(authorizations, monthlyAuthorizations));
  results.push(...ruleSCH14VisitDates(visits, authorizations));

  // Conflict and eligibility rules (CON-*)
  results.push(...ruleCON01SameServiceOverlap(visits));
  results.push(...ruleCON02DifferentServiceOverlap(visits, pack));
  results.push(...ruleCON03RespiteOverlap(visits));
  results.push(...ruleCON04CaregiverOverlap(visits));
  results.push(...ruleCON05CaregiverHours(visits, tenantWorkweekStart));
  results.push(...ruleCON06AttendantRelationship(authorizations, caregivers, visits));
  results.push(...ruleCON07AgencyAide(authorizations, caregivers, visits));
  for (const { participantId, group, daily } of weeklyHoursDailyMinutes(visits)) {
    results.push(...ruleCON09WeeklyHours(daily, { participantId, group }));
  }
  results.push(...ruleCON10NurseVisits(visits));
  results.push(...ruleCON13FirstVisit(authorizations, visits));
  results.push(...ruleCON16WaiverEnrollments(enrollments, visits));
  results.push(...ruleCON17QualificationData(authorizations, caregivers, visits));

  return results
    .map((result) => ({ ...result, rulePackVersion: pack.id }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

