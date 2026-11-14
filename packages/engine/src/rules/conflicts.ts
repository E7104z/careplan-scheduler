import { addDays, daysFromCivil, parseYmd, weekdayOf } from "../math/dates.js";
import { splitByDate } from "../calendar/time.js";
import { MO_2026_07 } from "../rulepacks/mo-2026-07.js";
import { serviceByCode } from "../rulepacks/lookup.js";
import type { RulePack } from "../rulepacks/types.js";
import type {
  Caregiver,
  ProgramCode,
  ServiceAuthorization,
  Severity,
  ValidationResult,
  Visit,
  WaiverCode,
  WaiverEnrollment,
  Weekday,
} from "../types.js";

/** A service on the schedule, and whether every one of its care days has a clock time (CP4-1). */
export interface ScheduledService {
  serviceAuthId: string;
  serviceCode: Visit["serviceCode"];
  hasClockTimes: boolean;
}

const RESPITE_CODES: ReadonlySet<string> = new Set(["S5150", "S5150TF"]);

/** An overlap rule never passes on missing data: a service with no clock times is under review. */
function noClockTimes(ruleId: string, service: ScheduledService): ValidationResult {
  return { ruleId, severity: "REVIEW", message: "No clock times yet, so overlaps can't be checked", refs: { serviceAuthId: service.serviceAuthId } };
}

function overlaps(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start < b.end && b.start < a.end;
}

function civilZ(date: string): number {
  const { year, month, day } = parseYmd(date);
  return daysFromCivil(year, month, day);
}

function workweekStartOf(date: string, startDay: Weekday): string {
  const { year, month, day } = parseYmd(date);
  const offset = (weekdayOf(year, month, day) - startDay + 7) % 7;
  return addDays(date, -offset);
}

/** Caregivers with a visit on this authorization's participant and service, inside its dates. */
function assignedCaregiverIds(auth: ServiceAuthorization, visits: Visit[]): Set<string> {
  const ids = new Set<string>();
  for (const visit of visits) {
    const date = visit.start.slice(0, 10);
    if (
      visit.participantId === auth.participantId &&
      visit.serviceCode === auth.serviceCode &&
      auth.start <= date &&
      date <= auth.end
    ) {
      ids.add(visit.caregiverId);
    }
  }
  return ids;
}

/**
 * @rule CON-01
 * @source CDS policy clarification Q5
 */
export function ruleCON01SameServiceOverlap(visits: Visit[], services: readonly ScheduledService[] = []): ValidationResult[] {
  // A service with no clock times can't be checked for overlapping visits: REVIEW, never a pass.
  const results: ValidationResult[] = services.filter((service) => !service.hasClockTimes).map((service) => noClockTimes("CON-01", service));
  const statePlanLike = new Set(["T1019U2", "T1019U6"]);
  for (let i = 0; i < visits.length; i++) {
    for (let j = i + 1; j < visits.length; j++) {
      const a = visits[i]!;
      const b = visits[j]!;
      if (a.participantId !== b.participantId) continue;
      if (a.serviceCode !== b.serviceCode) continue;
      if (!overlaps(a, b)) continue;
      const severity: Severity = statePlanLike.has(a.serviceCode) ? "BLOCK" : "WARN";
      results.push({
        ruleId: "CON-01",
        severity,
        message: `Overlapping ${a.serviceCode} visits for participant ${a.participantId}`,
        refs: { visitId: a.id },
      });
    }
  }
  return results;
}

/**
 * @rule CON-02
 * @source CDS policy clarification Q5; Policy 3.50 (rev. Jul 2026)
 */
export function ruleCON02DifferentServiceOverlap(
  visits: Visit[],
  pack: RulePack,
  services: readonly ScheduledService[] = [],
): ValidationResult[] {
  // With two or more services, one without clock times can't be checked against the others (respite is CON-03's).
  const results: ValidationResult[] =
    services.length < 2
      ? []
      : services
          .filter((service) => !service.hasClockTimes && !RESPITE_CODES.has(service.serviceCode))
          .map((service) => noClockTimes("CON-02", service));
  for (let i = 0; i < visits.length; i++) {
    for (let j = i + 1; j < visits.length; j++) {
      const a = visits[i]!;
      const b = visits[j]!;
      if (a.participantId !== b.participantId) continue;
      if (a.serviceCode === b.serviceCode) continue;
      if (!overlaps(a, b)) continue;
      const programA = serviceByCode(pack, a.serviceCode)?.program;
      const programB = serviceByCode(pack, b.serviceCode)?.program;
      if (!programA || !programB) continue;
      if (programA === "RESPITE" || programB === "RESPITE") continue; // reported by CON-03
      const rule = pack.overlap(programA, programB);
      if (rule === "allowed") continue;
      const severity: Severity = rule === "prohibited" ? "BLOCK" : "REVIEW";
      results.push({
        ruleId: "CON-02",
        severity,
        message: `Overlapping ${a.serviceCode} and ${b.serviceCode}`,
        refs: { visitId: a.id },
      });
    }
  }
  return results;
}

/**
 * @rule CON-03
 * @source Policy 3.50 (rev. Jul 2026)
 */
export function ruleCON03RespiteOverlap(visits: Visit[], services: readonly ScheduledService[] = []): ValidationResult[] {
  // With respite in the plan and another service beside it, any service without clock times leaves respite overlap unchecked.
  const hasRespite = services.some((service) => RESPITE_CODES.has(service.serviceCode));
  const results: ValidationResult[] =
    hasRespite && services.length >= 2
      ? services.filter((service) => !service.hasClockTimes).map((service) => noClockTimes("CON-03", service))
      : [];
  const respite = RESPITE_CODES;
  for (let i = 0; i < visits.length; i++) {
    for (let j = i + 1; j < visits.length; j++) {
      const a = visits[i]!;
      const b = visits[j]!;
      if (a.participantId !== b.participantId) continue;
      if (a.serviceCode === b.serviceCode) continue;
      if (!overlaps(a, b)) continue;
      if (respite.has(a.serviceCode) || respite.has(b.serviceCode)) {
        results.push({
          ruleId: "CON-03",
          severity: "BLOCK",
          message: "Respite overlaps another service",
          refs: { visitId: a.id },
        });
      }
    }
  }
  return results;
}

/**
 * @rule CON-04
 * @source Product decision approved Oct 20, 2026
 */
export function ruleCON04CaregiverOverlap(visits: Visit[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (let i = 0; i < visits.length; i++) {
    for (let j = i + 1; j < visits.length; j++) {
      const a = visits[i]!;
      const b = visits[j]!;
      // Same caregiver, and a real one (a visit with no caregiver assigned yet can't be double-booked).
      if (a.caregiverId === "" || a.caregiverId !== b.caregiverId) continue;
      // Same service for one participant is CON-01's overlap; across participants it is still a double-booking.
      if (a.participantId === b.participantId && a.serviceCode === b.serviceCode) continue;
      if (!overlaps(a, b)) continue;
      results.push({
        ruleId: "CON-04",
        severity: "BLOCK",
        message:
          a.participantId === b.participantId
            ? `Caregiver ${a.caregiverId} is booked in two visits at once`
            : `Caregiver ${a.caregiverId} overlaps across participants`,
        refs: { visitId: a.id },
      });
    }
  }
  return results;
}

/**
 * @rule CON-05
 * @source FLSA; product decision approved Oct 20, 2026
 */
export function ruleCON05CaregiverHours(visits: Visit[], workweekStart: Weekday): ValidationResult[] {
  const byCaregiver = new Map<string, Map<string, number>>();
  for (const visit of visits) {
    for (const [date, minutes] of Object.entries(splitByDate(visit.start, visit.end))) {
      const weekStart = workweekStartOf(date, workweekStart);
      const weeks = byCaregiver.get(visit.caregiverId) ?? new Map<string, number>();
      weeks.set(weekStart, (weeks.get(weekStart) ?? 0) + minutes);
      byCaregiver.set(visit.caregiverId, weeks);
    }
  }
  const results: ValidationResult[] = [];
  for (const [caregiverId, weeks] of byCaregiver) {
    for (const [weekStart, minutes] of weeks) {
      if (minutes > 40 * 60) {
        results.push({
          ruleId: "CON-05",
          severity: "WARN",
          message: `Caregiver ${caregiverId} scheduled ${minutes} min (> 40 h) in workweek ${weekStart}`,
          refs: { date: weekStart },
        });
      }
    }
  }
  return results;
}

/**
 * @rule CON-06
 * @source Policy 3.25 (01/26)
 */
export function ruleCON06AttendantRelationship(
  authorizations: ServiceAuthorization[],
  caregivers: Caregiver[],
  visits: Visit[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const auth of authorizations) {
    if (auth.program !== "CDS" && auth.program !== "ILW") continue;
    const assigned = assignedCaregiverIds(auth, visits);
    for (const caregiver of caregivers) {
      if (!assigned.has(caregiver.id)) continue;
      const rel = caregiver.relationships[auth.participantId];
      if (rel !== "spouse" && rel !== "legal_guardian") continue;
      const severity: Severity = auth.program === "CDS" ? "BLOCK" : "REVIEW";
      results.push({
        ruleId: "CON-06",
        severity,
        message: `${auth.program} attendant is ${rel}`,
        refs: { serviceAuthId: auth.id },
      });
    }
  }
  return results;
}

const FORBIDDEN_FAMILY = new Set([
  "parent", "sibling", "child", "stepchild", "spouse", "grandparent", "grandchild",
]);
const AGENCY_PROGRAMS = new Set(["AGENCY_PC", "APC", "HOMEMAKER", "RESPITE", "CHORE"]);
// Policy 3.05 and 3.10 say PC and APC are also provided in an RCF/ALF, but Policy 3.20 (the facility
// policy) doesn't restate 3.05's aide restrictions, so there they are REVIEW until DSDS confirms.
const FACILITY_PROGRAMS = new Set(["RCF_PC", "RCF_APC"]);
const FACILITY_QUESTION = "Policy 3.05 restricts PC aides; Policy 3.20 (RCF/ALF) doesn't say whether that applies in a facility";

/**
 * @rule CON-07
 * @source Policy 3.05 (04/25); Policy 3.10 (03/25); Policy 3.20 (rev. Mar 2026); Policy 3.45 (Nov 2021); Policy 3.50 (rev. Jul 2026)
 */
export function ruleCON07AgencyAide(
  authorizations: ServiceAuthorization[],
  caregivers: Caregiver[],
  visits: Visit[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const auth of authorizations) {
    const facility = FACILITY_PROGRAMS.has(auth.program);
    if (!AGENCY_PROGRAMS.has(auth.program) && !facility) continue;
    const severity: Severity = auth.program === "CHORE" || facility ? "REVIEW" : "BLOCK";
    const why = facility ? ` (${FACILITY_QUESTION})` : "";
    const assigned = assignedCaregiverIds(auth, visits);
    for (const caregiver of caregivers) {
      if (!assigned.has(caregiver.id)) continue;
      const rel = caregiver.relationships[auth.participantId];
      if (rel !== undefined && FORBIDDEN_FAMILY.has(rel)) {
        results.push({
          ruleId: "CON-07",
          severity,
          message: `${auth.program} aide is ${rel}${why}`,
          refs: { serviceAuthId: auth.id },
        });
      }
      // Only a stated "not an employee" is a finding here; an unanswered question is CON-17's REVIEW.
      if (caregiver.agencyEmployee === false) {
        results.push({
          ruleId: "CON-07",
          severity,
          message: `${auth.program} aide is not an ${facility ? "employee of the facility" : "agency employee"}${why}`,
          refs: { serviceAuthId: auth.id },
        });
      }
    }
  }
  return results;
}

/**
 * @rule CON-10
 * @source Policy 3.15 (04/26) as updated by HCBS 08-26-01; 3.00 Appendix 1 (rev. Jul 2026)
 */
export function ruleCON10NurseVisits(visits: Visit[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  const nurse = visits.filter((v) => v.serviceCode === "T1001");
  const byDate = new Map<string, number>();
  for (const v of nurse) {
    const date = v.start.slice(0, 10);
    byDate.set(date, (byDate.get(date) ?? 0) + 1);
  }
  for (const [date, count] of byDate) {
    if (count > 1) {
      results.push({
        ruleId: "CON-10",
        severity: "BLOCK",
        message: `${count} nurse visits on ${date}`,
        refs: { date },
      });
    }
  }
  const dates = [...new Set(nurse.map((v) => v.start.slice(0, 10)))].sort();
  for (const start of dates) {
    const startZ = civilZ(start);
    const endZ = startZ + 182;
    let count = 0;
    for (const d of dates) {
      const z = civilZ(d);
      if (z >= startZ && z <= endZ) count += 1;
    }
    if (count > 26) {
      results.push({
        ruleId: "CON-10",
        severity: "BLOCK",
        message: `${count} nurse visits within 6 months of ${start}`,
        refs: { date: start },
      });
    }
  }
  return results;
}

/**
 * @rule CON-13
 * @source 13 CSR 70-91.010(1)(B)1; CDS policy clarification Q2
 */
export function ruleCON13FirstVisit(
  authorizations: ServiceAuthorization[],
  visits: Visit[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const auth of authorizations) {
    if (auth.program !== "AGENCY_PC") continue;
    if (auth.receivedDate === undefined) {
      results.push({
        ruleId: "CON-13",
        severity: "REVIEW",
        message: "AGENCY_PC authorization missing receivedDate",
        refs: { serviceAuthId: auth.id },
      });
      continue;
    }
    const first = visits
      .filter((v) => v.participantId === auth.participantId && v.serviceCode === auth.serviceCode)
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    if (!first) continue;
    const firstDate = first.start.slice(0, 10);
    if (firstDate > addDays(auth.receivedDate, 10)) {
      results.push({
        ruleId: "CON-13",
        severity: "WARN",
        message: `First visit ${firstDate} is more than 10 days after receivedDate ${auth.receivedDate}`,
        refs: { serviceAuthId: auth.id, date: firstDate },
      });
    }
  }
  return results;
}

const WAIVER_BY_PROGRAM: Partial<Record<ProgramCode, WaiverCode>> = {
  ILW: "ILW",
  RESPITE: "ADW",
  HOMEMAKER: "ADW",
  CHORE: "ADW",
};

/**
 * @rule CON-16
 * @source Policy 3.05 (04/25)
 */
export function ruleCON16WaiverEnrollments(
  enrollments: WaiverEnrollment[],
  visits: Visit[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (let i = 0; i < enrollments.length; i++) {
    for (let j = i + 1; j < enrollments.length; j++) {
      const a = enrollments[i]!;
      const b = enrollments[j]!;
      if (a.participantId !== b.participantId) continue;
      if (a.start <= b.end && b.start <= a.end) {
        results.push({
          ruleId: "CON-16",
          severity: "BLOCK",
          message: `Waiver ${a.waiver} and ${b.waiver} enrollments overlap`,
          refs: {},
        });
      }
    }
  }
  for (const visit of visits) {
    const program = serviceByCode(MO_2026_07, visit.serviceCode)?.program;
    const waiver = program ? WAIVER_BY_PROGRAM[program] : undefined;
    if (!waiver) continue;
    const date = visit.start.slice(0, 10);
    const covered = enrollments.some(
      (e) =>
        e.participantId === visit.participantId &&
        e.waiver === waiver &&
        e.start <= date &&
        date <= e.end,
    );
    if (!covered) {
      results.push({
        ruleId: "CON-16",
        severity: "REVIEW",
        message: `No ${waiver} enrollment covers ${visit.serviceCode} visit on ${date}`,
        refs: { visitId: visit.id, date },
      });
    }
  }
  return results;
}

/**
 * @rule CON-17
 * @source Policies 3.05, 3.10, 3.15, 3.25; Policy 3.55 (FCSR registration)
 */
export function ruleCON17QualificationData(
  authorizations: ServiceAuthorization[],
  caregivers: Caregiver[],
  visits: Visit[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const auth of authorizations) {
    const assigned = assignedCaregiverIds(auth, visits);
    for (const caregiver of caregivers) {
      if (!assigned.has(caregiver.id)) continue;
      if (auth.program === "ILW" && caregiver.fcsrRegistered !== true) {
        results.push({
          ruleId: "CON-17",
          severity: "REVIEW",
          message: "ILW attendant missing FCSR registration",
          refs: { serviceAuthId: auth.id },
        });
      }
      if (auth.program === "NURSE" && caregiver.nurseLicense !== true) {
        results.push({
          ruleId: "CON-17",
          severity: "REVIEW",
          message: "NURSE caregiver missing nurse licence",
          refs: { serviceAuthId: auth.id },
        });
      }
      if (
        (auth.program === "CDS" || auth.program === "ILW") &&
        caregiver.relationships[auth.participantId] === undefined
      ) {
        results.push({
          ruleId: "CON-17",
          severity: "REVIEW",
          message: "Missing relationship data needed by CON-06",
          refs: { serviceAuthId: auth.id },
        });
      }
      if (
        (AGENCY_PROGRAMS.has(auth.program) || FACILITY_PROGRAMS.has(auth.program)) &&
        caregiver.relationships[auth.participantId] === undefined
      ) {
        results.push({
          ruleId: "CON-17",
          severity: "REVIEW",
          message: "Missing relationship data needed by CON-07",
          refs: { serviceAuthId: auth.id },
        });
      }
      if ((AGENCY_PROGRAMS.has(auth.program) || FACILITY_PROGRAMS.has(auth.program)) && caregiver.agencyEmployee === undefined) {
        results.push({
          ruleId: "CON-17",
          severity: "REVIEW",
          message: "Missing employment data needed by CON-07",
          refs: { serviceAuthId: auth.id },
        });
      }
    }
  }
  return results;
}
