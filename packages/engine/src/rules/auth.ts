import { hcbs3cTaskUnitsFromWeekly, workbookTaskUnits } from "../math/units.js";
import { MO_2026_07 } from "../rulepacks/mo-2026-07.js";
import { serviceByCode } from "../rulepacks/lookup.js";
import type {
  AuthorizedTask,
  MonthlyAuthorization,
  ServiceAuthorization,
  ValidationResult,
} from "../types.js";

/**
 * @rule AUTH-03
 * @source HCBS-3c (10/26) cell Q11; DHSS 4.00 Appendix 14a/14b cell M7
 */
export function ruleAUTH03DerivedTaskUnits(
  tasks: AuthorizedTask[],
  weeklyMinutesByTask: Record<string, number> = {},
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const task of tasks) {
    const weeklyMinutes = weeklyMinutesByTask[task.id] ?? task.minPerDay * task.daysPerWeek;
    const timesPerWeek = task.daysPerWeek;
    const f2b = workbookTaskUnits(weeklyMinutes, timesPerWeek).units;
    const f2a = hcbs3cTaskUnitsFromWeekly(weeklyMinutes, timesPerWeek).units;
    if (f2b !== f2a) {
      results.push({
        ruleId: "AUTH-03",
        severity: "REVIEW",
        message: `Derived task units differ (F-2b ${f2b} vs F-2a ${f2a})`,
        refs: { taskId: task.id, serviceAuthId: task.serviceAuthId },
      });
    }
  }
  return results;
}

const PRORATED_PROGRAMS = new Set(["CDS", "ILW", "AGENCY_PC", "APC", "HOMEMAKER"]);

/**
 * @rule AUTH-05
 * @source INFO 05-25-03 (May 9, 2025); Fusion FAQ (Jun 4, 2025); DHSS 14a/14b cell D37
 */
export function ruleAUTH05DerivedMonthUnits(authorizations: ServiceAuthorization[]): ValidationResult[] {
  return authorizations.map((auth) => ({
    ruleId: "AUTH-05",
    severity: "INFO" as const,
    message: PRORATED_PROGRAMS.has(auth.program)
      ? "Derived month units use F-3 (short-month proration for 7-day tasks)"
      : "Month units are not prorated for this service",
    refs: { serviceAuthId: auth.id },
  }));
}

/**
 * @rule AUTH-06
 * @source INFO 05-25-03 (May 9, 2025)
 */
export function ruleAUTH06MigratedPlan(authorizations: ServiceAuthorization[]): ValidationResult[] {
  return authorizations.filter((auth) => auth.migratedFromWebTool === true).map((auth) => ({
    ruleId: "AUTH-06",
    severity: "WARN" as const,
    message: "per-month figures are derived",
    refs: { serviceAuthId: auth.id },
  }));
}

/**
 * @rule AUTH-07
 * @source Product decision approved Oct 20, 2026 (P-02)
 */
export function ruleAUTH07DerivedVsFusion(
  monthlyAuthorizations: MonthlyAuthorization[],
  derivedUnits: Record<string, number>,
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const ma of monthlyAuthorizations) {
    if (ma.source !== "fusion") continue;
    const derived = derivedUnits[`${ma.serviceAuthId}:${ma.month}`];
    if (derived === undefined) continue;
    if (derived !== ma.units) {
      results.push({
        ruleId: "AUTH-07",
        severity: "REVIEW",
        message: `Derived ${derived} units differ from imported Fusion ${ma.units}; Fusion value kept`,
        refs: { serviceAuthId: ma.serviceAuthId, month: ma.month },
      });
    }
  }
  return results;
}

/**
 * @rule AUTH-08
 * @source Policy 3.25 (01/26); HCBS-3c cell L88
 */
export function ruleAUTH08Transport(authorizations: ServiceAuthorization[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const auth of authorizations) {
    if (auth.transportMinutesPerMonth !== undefined) {
      results.push({
        ruleId: "AUTH-08",
        severity: "INFO",
        message: `Transport allowance ${auth.transportMinutesPerMonth} minutes kept`,
        refs: { serviceAuthId: auth.id },
      });
    }
  }
  return results;
}

/**
 * @rule AUTH-09
 * @source 3.00 Appendix 1 (rev. Jul 2026); Policy 3.50 (rev. Jul 2026); HCBS 06-26-01
 */
export function ruleAUTH09Ceiling(
  authorizations: ServiceAuthorization[],
  monthlyAuthorizations: MonthlyAuthorization[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const authById = new Map(authorizations.map((a) => [a.id, a]));

  const respiteByMonth = new Map<string, number>();
  for (const ma of monthlyAuthorizations) {
    const auth = authById.get(ma.serviceAuthId);
    if (!auth) continue;
    const service = serviceByCode(MO_2026_07, auth.serviceCode);
    if (service?.combinedCeilingGroup === "RESPITE") {
      respiteByMonth.set(ma.month, (respiteByMonth.get(ma.month) ?? 0) + ma.units);
    }
  }
  const respiteCeiling = serviceByCode(MO_2026_07, "S5150")?.monthlyCeiling ?? 0;
  for (const [month, total] of respiteByMonth) {
    if (total > respiteCeiling) {
      results.push({
        ruleId: "AUTH-09",
        severity: "BLOCK",
        message: `Respite Basic + Advanced ${total} units exceed combined ceiling ${respiteCeiling} in ${month}`,
        refs: { month },
      });
    }
  }

  for (const ma of monthlyAuthorizations) {
    const auth = authById.get(ma.serviceAuthId);
    if (!auth) continue;
    const service = serviceByCode(MO_2026_07, auth.serviceCode);
    if (service?.combinedCeilingGroup === "RESPITE") continue;
    const ceiling = service?.monthlyCeiling ?? null;
    if (ceiling !== null && ma.units > ceiling) {
      results.push({
        ruleId: "AUTH-09",
        severity: "REVIEW",
        message: `Imported ${ma.units} units exceed program ceiling ${ceiling}`,
        refs: { serviceAuthId: ma.serviceAuthId, month: ma.month },
      });
    }
  }

  return results;
}

/**
 * @rule AUTH-11
 * @source Policy 3.55 (01/26)
 */
export function ruleAUTH11ProjectIlwSwitch(
  dailyUnits: number[],
  statePlanUnits?: number,
  ilwUnits?: number,
): ValidationResult[] {
  if (statePlanUnits === undefined || ilwUnits === undefined) return [];
  let cumulative = 0;
  for (let i = 0; i < dailyUnits.length; i++) {
    const units = dailyUnits[i] ?? 0;
    if (cumulative + units > statePlanUnits) {
      const statePlanPortion = statePlanUnits - cumulative;
      const ilwPortion = units - statePlanPortion;
      return [{
        ruleId: "AUTH-11",
        severity: "INFO",
        message: `ILW switch projection: day ${i + 1} = ${statePlanPortion} State Plan + ${ilwPortion} ILW units`,
        refs: { date: String(i + 1) },
      }];
    }
    cumulative += units;
  }
  return [];
}

/**
 * @rule AUTH-12
 * @source Policy 3.55 (01/26); 3.00 Appendix 1 (rev. Jul 2026)
 */
export function ruleAUTH12PendingApproval(authorizations: ServiceAuthorization[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const auth of authorizations) {
    if (auth.program === "ILW" && auth.state === "pending_approval") {
      results.push({
        ruleId: "AUTH-12",
        severity: "BLOCK",
        message: "ILW units scheduled while state is pending_approval",
        refs: { serviceAuthId: auth.id },
      });
    }
    if (auth.program === "ILW" && auth.serviceCode === "T1019U2") {
      results.push({
        ruleId: "AUTH-12",
        severity: "BLOCK",
        message: "State Plan authorization must never be created for an ILW participant",
        refs: { serviceAuthId: auth.id },
      });
    }
  }
  return results;
}
