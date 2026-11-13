import {
  addMinutesLocal,
  ruleCON01SameServiceOverlap,
  ruleCON02DifferentServiceOverlap,
  ruleCON03RespiteOverlap,
  ruleCON04CaregiverOverlap,
  ruleCON06AttendantRelationship,
  ruleCON07AgencyAide,
  ruleCON16WaiverEnrollments,
  ruleCON17QualificationData,
  ruleCDS05FacilityResidents,
  rulePRG01Pace,
  rulePRG02DmhPrograms,
  rulePRG03FundingSequence,
  weekdayOf,
  type RulePack,
  type ScheduledService,
  type ValidationResult,
  type Visit,
  type Weekday,
} from "@careplan/engine";
import { assignedTo, assignmentVisits, engineCaregivers, PARTICIPANT_ID } from "./caregivers.js";
import { weekMinutes } from "./carePlan.js";
import { normalizeEvents } from "./normalizeEvents.js";
import { enginePrograms } from "./programs.js";
import { copyFor } from "./ruleCopy.js";
import type { CarePlan, QuickModel, QuickState } from "./types.js";
import { respiteWeeklyHours } from "./respiteHours.js";
import { sfcResults } from "./sfc.js";
import { engineEnrollments } from "./waivers.js";

export { PARTICIPANT_ID };

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A service's start time on a weekday ("09:00"), or null when none is set. */
export function startTimeOn(state: QuickState, weekday: number): string | null {
  const time = state.startTimes?.[String(weekday)];
  return time !== undefined && CLOCK.test(time) ? time : null;
}

/** The weekdays a service has care on (tasks or transportation), Sunday first. */
export function careWeekdays(state: QuickState, model: QuickModel): Weekday[] {
  return weekMinutes(state, model).flatMap((minutes, weekday) => (minutes > 0 ? [weekday as Weekday] : []));
}

/** The plan's scheduled services, and whether each has a clock time on every care day (CP4-1). */
export function scheduledServices(plan: CarePlan, models: QuickModel[]): ScheduledService[] {
  return plan.services.flatMap((state, index) => {
    const days = careWeekdays(state, models[index]!);
    if (days.length === 0) return [];
    return [{ serviceAuthId: state.id, serviceCode: state.serviceCode, hasClockTimes: days.every((weekday) => startTimeOn(state, weekday) !== null) }];
  });
}

/**
 * The plan's visits as the engine's rules read them: for each service with a start time on a
 * care day, one visit on each such date, from the start time for that date's scheduled minutes
 * (tasks and transportation, from the one occurrence list). The end is computed in America/Chicago
 * by the engine, so a visit past midnight and a clock-change day are right. A service or a day
 * with no start time produces no visit. A COVERAGE_SHIFT service (respite) contributes its
 * coverage blocks: their start/end span is the visit, so the span, not any task, is its duration.
 */
export function buildVisits(plan: CarePlan, models: QuickModel[], pack: RulePack): Visit[] {
  const hasStartTimes = plan.services.some((state) => Object.keys(state.startTimes ?? {}).length > 0);
  const hasCoverage = plan.services.some((state) => (state.coverage ?? []).length > 0);
  if (!hasStartTimes && !hasCoverage) return [];
  const days = new Map<string, { service: number; date: string; minutes: number; taskIds: string[] }>();
  for (const occurrence of normalizeEvents(plan, models, pack)) {
    if (occurrence.kind !== "TASK" && occurrence.kind !== "TRANSPORT") continue;
    const service = plan.services.findIndex((state) => state.id === occurrence.authorizationId);
    if (service < 0) continue;
    const key = `${service}|${occurrence.date}`;
    const day = days.get(key) ?? { service, date: occurrence.date, minutes: 0, taskIds: [] };
    day.minutes += occurrence.minutes ?? 0;
    if (occurrence.taskId !== undefined) day.taskIds.push(occurrence.taskId);
    days.set(key, day);
  }
  const visits: Visit[] = [];
  for (const day of days.values()) {
    const state = plan.services[day.service]!;
    const [year, month, date] = day.date.split("-").map(Number) as [number, number, number];
    const time = startTimeOn(state, weekdayOf(year, month, date));
    if (time === null || day.minutes <= 0) continue;
    const start = `${day.date}T${time}`;
    visits.push({
      // Each visit takes the service's first assigned caregiver; "" while none is assigned.
      id: `${state.id}:${day.date}`, participantId: PARTICIPANT_ID, caregiverId: assignedTo(plan, day.service)[0] ?? "", serviceCode: state.serviceCode,
      start, end: addMinutesLocal(start, day.minutes), taskIds: day.taskIds,
    });
  }
  // Coverage blocks: a span of care is itself the visit (Policy 3.50); activities add nothing.
  plan.services.forEach((state, service) => {
    for (const block of state.coverage ?? []) {
      visits.push({
        id: block.id, participantId: PARTICIPANT_ID, caregiverId: assignedTo(plan, service)[0] ?? "",
        serviceCode: state.serviceCode, start: block.start, end: block.end, taskIds: [],
      });
    }
  });
  return visits.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/**
 * The visit and caregiver rules on the schedule: same-service, different-service and respite
 * overlap on the visits the start times give (a service with no clock times is REVIEW, never a
 * pass), and who can serve this participant (CON-06, CON-07), with missing qualification data
 * asked for by CON-17 (REVIEW) rather than assumed. The existing rule functions are called as
 * they are; none is re-implemented here.
 */
export function planVisitResults(plan: CarePlan, models: QuickModel[], pack: RulePack): ValidationResult[] {
  const visits = buildVisits(plan, models, pack);
  const services = scheduledServices(plan, models);
  // The qualification rules find a service's caregivers from its visits: the assignments say who is on what.
  const assigned = [...visits, ...assignmentVisits(plan, models)];
  const authorizations = models.map((model) => ({ ...model.auth, participantId: PARTICIPANT_ID }));
  const caregivers = engineCaregivers(plan);
  const enrollments = engineEnrollments(plan);
  return [
    ...ruleCON01SameServiceOverlap(visits, services),
    ...ruleCON02DifferentServiceOverlap(visits, pack, services),
    ...ruleCON03RespiteOverlap(visits, services),
    ...ruleCON04CaregiverOverlap(visits),
    ...ruleCON06AttendantRelationship(authorizations, caregivers, assigned),
    ...ruleCON07AgencyAide(authorizations, caregivers, assigned),
    ...ruleCON16WaiverEnrollments(enrollments, visits),
    ...ruleCON17QualificationData(authorizations, caregivers, assigned),
    ...respiteWeeklyHours(plan),
    // Setting and program compatibility (CP4-7), from the plan's services and the programs entered.
    ...ruleCDS05FacilityResidents(authorizations),
    ...rulePRG01Pace(authorizations, enginePrograms(plan)),
    ...rulePRG02DmhPrograms(authorizations, enginePrograms(plan)),
    ...rulePRG03FundingSequence(authorizations, enginePrograms(plan)),
    ...sfcResults(plan),
  ];
}

function resultKey(result: ValidationResult): string {
  return [result.ruleId, result.severity, result.message, result.refs.serviceAuthId ?? "", result.refs.visitId ?? ""].join("|");
}

/** The Must-fix results a change would add: what it would break that wasn't broken before. */
export function newBlocks(before: ValidationResult[], after: ValidationResult[]): ValidationResult[] {
  const standing = new Set(before.filter((result) => result.severity === "BLOCK").map(resultKey));
  return after.filter((result) => result.severity === "BLOCK" && !standing.has(resultKey(result)));
}

/** "Not changed. Respite overlaps another service. Respite can't happen at the same time as any other service." */
export function visitRefusal(block: ValidationResult): string {
  const copy = copyFor(block.ruleId, block.severity, block.refs);
  return copy ? `Not changed. ${copy.title}. ${copy.whatToDo}` : `Not changed. ${block.message}.`;
}

export interface VisitChange {
  plan: CarePlan;
  refusal?: string;
}

/**
 * Set or clear a service's start time on a weekday, through the guard (APP-SPEC 5.7): a time that
 * would make two visits overlap in a way a rule forbids is refused with the rule's words, and
 * nothing changes.
 */
export function setStartTime(plan: CarePlan, service: number, weekday: Weekday, time: string | null, pack: RulePack, models: QuickModel[]): VisitChange {
  const state = plan.services[service];
  if (!state) return { plan, refusal: "Not changed. That service isn't in this care plan." };
  if (time !== null && !CLOCK.test(time)) return { plan, refusal: "Not changed. Enter the time as hours and minutes, like 9:00 AM." };
  const startTimes = { ...(state.startTimes ?? {}) };
  if (time === null) delete startTimes[String(weekday)];
  else startTimes[String(weekday)] = time;
  const next: CarePlan = { ...plan, services: plan.services.map((existing, index) => (index === service ? { ...state, startTimes } : existing)) };
  const blocks = newBlocks(planVisitResults(plan, models, pack), planVisitResults(next, models, pack));
  return blocks.length > 0 ? { plan, refusal: visitRefusal(blocks[0]!) } : { plan: next };
}

/**
 * A change to who gives the care, through the guard (APP-SPEC 5.7): `next` is accepted unless it
 * adds a Must-fix result, such as a spouse as the paid CDS attendant; then the plan is unchanged
 * and the rule's words say why.
 */
export function guardedPlanChange(plan: CarePlan, next: CarePlan, pack: RulePack, models: QuickModel[]): VisitChange {
  const blocks = newBlocks(planVisitResults(plan, models, pack), planVisitResults(next, models, pack));
  return blocks.length > 0 ? { plan, refusal: visitRefusal(blocks[0]!) } : { plan: next };
}

/** A visit's end as the page says it: "ends 11:30 AM", or "ends 1:15 AM the next day". */
export function visitEndText(start: string, end: string, clock: (time: string) => string): string {
  return `ends ${clock(end.slice(11))}${end.slice(0, 10) === start.slice(0, 10) ? "" : " the next day"}`;
}
