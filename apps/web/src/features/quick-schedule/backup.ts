import { addDays, ruleCON17QualificationData, splitByDate, type CalendarException, type RulePack, type Visit } from "@careplan/engine";
import { niceDate } from "../../lib/format";
import { PARTICIPANT_ID, engineCaregivers, planCaregivers } from "./caregivers.js";
import { newId } from "./ids.js";
import { copyFor } from "./ruleCopy.js";
import type { CarePlan, CoopPriority, PlanBackup, QuickModel } from "./types.js";
import { buildVisits, guardedPlanChange, newBlocks, planVisitResults, type VisitChange } from "./visits.js";

// Backup and emergency coverage (CP4-8; Manual 4.15 and 4.20): when a caregiver is away, the
// visits left uncovered, who could cover each, and the person's choice, recorded as a
// substitute exception. Nothing is ever assigned without the person choosing, the approved
// authorization never changes, and priority is only what the person entered.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RANK: Record<CoopPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const HOURS_LIMIT = 40 * 60;

export const PRIORITY_LABELS: Record<CoopPriority, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

/** The plan's backup records, for caregivers still in the plan; plans saved before CP4-8 have none. */
export function planBackup(plan: CarePlan): PlanBackup {
  const known = new Set(planCaregivers(plan).map((caregiver) => caregiver.id));
  const backup = plan.backup ?? { unavailable: [], substitutes: [], priorities: {} };
  return {
    unavailable: backup.unavailable.filter((away) => known.has(away.caregiverId)),
    substitutes: backup.substitutes.filter((sub) => known.has(sub.caregiverId ?? "")),
    priorities: backup.priorities,
  };
}

function withBackup(plan: CarePlan, patch: Partial<PlanBackup>): CarePlan {
  return { ...plan, backup: { ...planBackup(plan), ...patch } };
}

export function isUnavailable(plan: CarePlan, caregiverId: string, date: string): boolean {
  return planBackup(plan).unavailable.some((away) => away.caregiverId === caregiverId && away.start <= date && date <= away.end);
}

/** Mark a caregiver away for dates. It only records the absence: no one is assigned in their place. */
export function markUnavailable(plan: CarePlan, caregiverId: string, start: string, end: string): VisitChange {
  if (!planCaregivers(plan).some((caregiver) => caregiver.id === caregiverId)) return { plan, refusal: "Not changed. Choose a caregiver." };
  if (!DATE.test(start) || !DATE.test(end)) return { plan, refusal: "Not changed. Enter the first and last day away as dates." };
  if (end < start) return { plan, refusal: "Not changed. The last day away must be on or after the first." };
  return { plan: withBackup(plan, { unavailable: [...planBackup(plan).unavailable, { id: newId(), caregiverId, start, end }] }) };
}

export function removeUnavailable(plan: CarePlan, id: string): CarePlan {
  return withBackup(plan, { unavailable: planBackup(plan).unavailable.filter((away) => away.id !== id) });
}

/** Set (or clear, with null) the priority the person gives a task if it is missed. */
export function setTaskPriority(plan: CarePlan, taskId: string, priority: CoopPriority | null): CarePlan {
  const priorities = { ...planBackup(plan).priorities };
  if (priority === null) delete priorities[taskId];
  else priorities[taskId] = priority;
  return withBackup(plan, { priorities });
}

/** The service a visit belongs to: a task visit's id starts with the service id; a coverage block is the service's. */
function serviceOf(plan: CarePlan, visit: Visit): number {
  return plan.services.findIndex(
    (state) => visit.id.startsWith(`${state.id}:`) || (state.coverage ?? []).some((block) => block.id === visit.id),
  );
}

export interface UncoveredTask {
  taskId: string;
  name: string;
  priority: CoopPriority | null;
}

export interface UncoveredVisit {
  visit: Visit;
  service: number;
  date: string;
  /** The visit's tasks, the highest entered priority first, then care plan order. */
  tasks: UncoveredTask[];
}

function rankOf(priority: CoopPriority | null): number {
  return priority === null ? 3 : RANK[priority];
}

/**
 * The visits whose caregiver is away that day, ordered by the highest priority the person entered
 * for any of their tasks (High, Medium, Low, then not entered), then by date and time.
 */
export function uncoveredVisits(plan: CarePlan, models: QuickModel[], pack: RulePack): UncoveredVisit[] {
  const { priorities } = planBackup(plan);
  const found: UncoveredVisit[] = [];
  for (const visit of buildVisits(plan, models, pack)) {
    const date = visit.start.slice(0, 10);
    if (visit.caregiverId === "" || !isUnavailable(plan, visit.caregiverId, date)) continue;
    const service = serviceOf(plan, visit);
    const names = new Map((plan.services[service]?.tasks ?? []).map((task) => [task.id, task.name]));
    const tasks = [...new Set(visit.taskIds)]
      .map((taskId) => ({ taskId, name: names.get(taskId) ?? "Task", priority: priorities[taskId] ?? null }))
      .sort((a, b) => rankOf(a.priority) - rankOf(b.priority));
    found.push({ visit, service, date, tasks });
  }
  const top = (entry: UncoveredVisit) => Math.min(3, ...entry.tasks.map((task) => rankOf(task.priority)));
  return found.sort((a, b) => top(a) - top(b) || (a.visit.start < b.visit.start ? -1 : a.visit.start > b.visit.start ? 1 : 0));
}

function substituteFor(plan: CarePlan, entry: UncoveredVisit, caregiverId: string): CalendarException {
  return {
    id: newId(), participantId: PARTICIPANT_ID, date: entry.date, taskId: "", minutesDelta: 0,
    reason: "Backup coverage", author: "", createdAt: "", kind: "substitute",
    caregiverId, serviceAuthId: plan.services[entry.service]!.id,
  };
}

function withSubstitute(plan: CarePlan, entry: UncoveredVisit, caregiverId: string): CarePlan {
  const others = planBackup(plan).substitutes.filter(
    (sub) => !(sub.serviceAuthId === plan.services[entry.service]!.id && sub.date === entry.date),
  );
  return withBackup(plan, { substitutes: [...others, substituteFor(plan, entry, caregiverId)] });
}

/** Whether a caregiver's visits put them over 40 hours in any seven days that include `date`. */
export function overFortyHours(visits: Visit[], caregiverId: string, date: string): boolean {
  const daily = new Map<string, number>();
  for (const visit of visits.filter((v) => v.caregiverId === caregiverId)) {
    for (const [day, minutes] of Object.entries(splitByDate(visit.start, visit.end))) daily.set(day, (daily.get(day) ?? 0) + minutes);
  }
  for (let back = 0; back < 7; back++) {
    const first = addDays(date, -back);
    let minutes = 0;
    for (let day = 0; day < 7; day++) minutes += daily.get(addDays(first, day)) ?? 0;
    if (minutes > HOURS_LIMIT) return true;
  }
  return false;
}

export interface Candidate {
  caregiverId: string;
  /** Null when this caregiver can be chosen; else why they aren't offered. */
  reason: string | null;
}

/**
 * Every other caregiver for an uncovered visit, with why each isn't offered: away that day,
 * booked at that time or otherwise barred by a rule (the guard's own check), details the rules
 * need not entered (CON-17), or over 40 hours in a week with this visit.
 */
export function candidates(plan: CarePlan, models: QuickModel[], pack: RulePack, entry: UncoveredVisit): Candidate[] {
  const before = planVisitResults(plan, models, pack);
  const auth = { ...models[entry.service]!.auth, participantId: PARTICIPANT_ID };
  return planCaregivers(plan)
    .filter((caregiver) => caregiver.id !== entry.visit.caregiverId)
    .map(({ id }): Candidate => {
      if (isUnavailable(plan, id, entry.date)) return { caregiverId: id, reason: "Away that day" };
      const next = withSubstitute(plan, entry, id);
      const blocks = newBlocks(before, planVisitResults(next, models, pack));
      if (blocks.some((block) => block.ruleId === "CON-04")) return { caregiverId: id, reason: "Booked at that time" };
      if (blocks.length > 0) return { caregiverId: id, reason: copyFor(blocks[0]!.ruleId, "BLOCK", blocks[0]!.refs)?.title ?? blocks[0]!.message };
      const caregiver = engineCaregivers(plan).filter((c) => c.id === id);
      if (ruleCON17QualificationData([auth], caregiver, [{ ...entry.visit, caregiverId: id }]).length > 0) {
        return { caregiverId: id, reason: "Relationship or qualifications not entered" };
      }
      if (overFortyHours(buildVisits(next, models, pack), id, entry.date)) return { caregiverId: id, reason: "Would be over 40 hours in a week" };
      return { caregiverId: id, reason: null };
    });
}

/**
 * The person's choice of a replacement, recorded as a substitute exception through the guard
 * (APP-SPEC 5.7). A caregiver who isn't offered is refused with the reason.
 */
export function chooseReplacement(plan: CarePlan, models: QuickModel[], pack: RulePack, visitId: string, caregiverId: string): VisitChange {
  const entry = uncoveredVisits(plan, models, pack).find((found) => found.visit.id === visitId);
  if (!entry) return { plan, refusal: "Not changed. That visit isn't uncovered any more." };
  const candidate = candidates(plan, models, pack, entry).find((found) => found.caregiverId === caregiverId);
  if (!candidate) return { plan, refusal: "Not changed. Choose a caregiver." };
  if (candidate.reason !== null) return { plan, refusal: `Not changed. ${candidate.reason} on ${niceDate(entry.date)}.` };
  return guardedPlanChange(plan, withSubstitute(plan, entry, caregiverId), pack, models);
}

/** Take a recorded replacement off again: the visit goes back to its assigned caregiver. */
export function undoReplacement(plan: CarePlan, id: string): CarePlan {
  return withBackup(plan, { substitutes: planBackup(plan).substitutes.filter((sub) => sub.id !== id) });
}
