import type { RulePack, Weekday } from "@careplan/engine";
import { buildQuickModel, localMonth } from "./model.js";
import type { CarePlan, PlanVisit, QuickModel, QuickState } from "./types.js";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** A plan of one service: the examples, a plan by hand, or a care plan with one authorization. */
export function singlePlan(state: QuickState): CarePlan {
  return { services: [state], visits: [], notes: [], view: 0 };
}

/** The service being looked at in detail, or null on the whole care plan. */
export function activeIndex(plan: CarePlan): number | null {
  if (plan.services.length === 1) return 0;
  return plan.view === "plan" ? null : plan.view;
}

/** "PC - Agency", else the rule pack's name for the service. */
export function serviceName(state: QuickState, model: QuickModel): string {
  return state.serviceLabel ?? model.svc.name;
}

/** Minutes the service has in the week on each day, Sunday to Saturday: tasks and transportation. */
export function weekMinutes(state: QuickState, model: QuickModel): number[] {
  const minutes = WEEKDAYS.map(() => 0);
  for (const entry of model.entries) minutes[entry.weekday]! += entry.minutes;
  if (model.allowance) minutes[state.transport.day]! += model.allowance.weeklyMinutes;
  return minutes;
}

/** Minutes a day across several services, Sunday to Saturday. */
export function dayLoad(states: QuickState[], pack: RulePack): number[] {
  const load = WEEKDAYS.map(() => 0);
  for (const state of states) {
    weekMinutes(state, buildQuickModel(state, pack)).forEach((minutes, day) => (load[day]! += minutes));
  }
  return load;
}

/** How many distinct days of the week carry service, across every service in the plan. */
export function serviceDays(plan: CarePlan, models: QuickModel[]): number {
  const days = new Set<Weekday>();
  plan.services.forEach((state, index) => {
    weekMinutes(state, models[index]!).forEach((minutes, day) => {
      if (minutes > 0) days.add(day as Weekday);
    });
  });
  return days.size;
}

/** The largest days-per-week across the plan's tasks (transportation alone counts as one day). */
export function maxServiceDays(models: QuickModel[]): number {
  return models.reduce((max, model) => {
    const daysPerWeek = model.tasks.reduce((largest, task) => Math.max(largest, task.daysPerWeek), 1);
    return Math.max(max, daysPerWeek);
  }, 0);
}

/** The warning when the week has more service days than the plan's largest days-a-week (after a manual edit); null when it fits. */
export function serviceDayWarning(plan: CarePlan, models: QuickModel[]): string | null {
  const days = serviceDays(plan, models);
  const max = maxServiceDays(models);
  if (days <= max) return null;
  return `This week has more service days than the plan's ${max} ${max === 1 ? "day" : "days"} a week. Check each service's care days.`;
}

export interface PlanDayItem {
  /** Index of the service in the plan. */
  service: number;
  name: string;
  minutes: number;
  transport: boolean;
}

export interface PlanDay {
  weekday: Weekday;
  items: PlanDayItem[];
  /** Minutes for each service that day, by service index. */
  byService: number[];
  minutes: number;
}

/** The two services of a CDS+ILW plan, or null when the plan isn't one. */
export function cdsIlwPair(models: QuickModel[]): { cds: number; ilw: number } | null {
  const cds = models.findIndex((model) => model.svc.code === "T1019U2");
  const ilw = models.findIndex((model) => model.svc.code === "T1019U6");
  return cds >= 0 && ilw >= 0 ? { cds, ilw } : null;
}

/** Task names that appear in both the State Plan and ILW authorization: one pool, shown once. */
function sharedTaskNames(cds: QuickModel, ilw: QuickModel): Set<string> {
  const ilwNames = new Set(ilw.tasks.map((task) => task.name));
  return new Set(cds.tasks.map((task) => task.name).filter((name) => ilwNames.has(name)));
}

/**
 * APP-SPEC 5.8: the participant's one week, Sunday to Saturday. Each day lists every service's
 * tasks (in care plan order, services in Fusion's order) and transportation, each item keeping
 * the service it belongs to. CP4-5: CDS and ILW are one task pool, so a task in both shows once,
 * under the State Plan (CDS) authorization, which pays for it before the ILW units begin.
 */
export function planWeek(plan: CarePlan, models: QuickModel[]): PlanDay[] {
  const pool = cdsIlwPair(models);
  const shared = pool ? sharedTaskNames(models[pool.cds]!, models[pool.ilw]!) : null;
  return WEEKDAYS.map((weekday) => {
    const items: PlanDayItem[] = [];
    plan.services.forEach((state, service) => {
      const model = models[service]!;
      const order = new Map(model.tasks.map((task, index) => [task.id, index]));
      const names = new Map(model.tasks.map((task) => [task.id, task.name]));
      model.entries
        .filter((entry) => entry.weekday === weekday)
        .sort((a, b) => (order.get(a.taskId) ?? 0) - (order.get(b.taskId) ?? 0))
        .forEach((entry) => {
          const name = names.get(entry.taskId) ?? entry.taskId;
          if (pool && shared?.has(name) && service === pool.ilw) return;
          items.push({ service, name, minutes: entry.minutes, transport: false });
        });
      if (model.allowance && model.allowance.weeklyMinutes > 0 && state.transport.day === weekday) {
        items.push({ service, name: "Essential transportation", minutes: model.allowance.weeklyMinutes, transport: true });
      }
    });
    const byService = plan.services.map((_, service) =>
      items.filter((item) => item.service === service).reduce((sum, item) => sum + item.minutes, 0),
    );
    return { weekday, items, byService, minutes: byService.reduce((sum, minutes) => sum + minutes, 0) };
  });
}

/** Whether a visit's month is still to come (or is this month), on the person's calendar. */
export function isUpcoming(visit: PlanVisit, today: Date): boolean {
  return visit.end.slice(0, 7) >= localMonth(today);
}
