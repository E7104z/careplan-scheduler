import { isRealDate } from "./dates.js";
import { pagingTotal } from "./paging.js";
import type { ReadRow } from "./rows.js";
import { ROWS_ONLY_SERVICE_CODE, serviceCodeForLabel } from "./services.js";
import type { ImportedService, ImportedTask, ImportedVisit, ImportIssue, ImportResult, PagingEntry } from "./types.js";

/** What reading one or more pastes produced, before the issues are worked out. */
export interface ResultParts {
  participant: ImportResult["participant"];
  /** Plan dates from the banner (IMP-13); the group row is the fallback. */
  bannerPlan: ImportResult["plan"];
  totalCost: string | null;
  paging: PagingEntry[];
  services: ImportedService[];
  /** Visits authorized in the report (IMP-18), in the report's order. */
  visits: ImportedVisit[];
  /** `duplicate-task` warnings for repeated tasks dropped while reading. */
  duplicates: ImportIssue[];
  /** `not-scheduled` notes for services left out, one per label (IMP-18). */
  skipped: ImportIssue[];
}

export type ServiceBase = Omit<ImportedService, "serviceCode" | "tasks" | "transport" | "unread">;

/** IMP-12: add a task to a service unless that task was already read; a repeat is dropped and reported. */
export function addTask(service: ImportedService, task: ImportedTask, duplicates: ImportIssue[]): void {
  const key = task.name.toLowerCase();
  if (service.tasks.some((existing) => existing.name.toLowerCase() === key)) {
    duplicates.push({ level: "warn", code: "duplicate-task", name: task.name, message: `${task.name} appears twice.` });
    return;
  }
  service.tasks.push(task);
}

/** IMP-04/05/12: put a service's rows into tasks, transportation and unread rows. */
export function buildService(base: ServiceBase, rows: ReadRow[], duplicates: ImportIssue[]): ImportedService {
  const service: ImportedService = {
    label: base.label,
    serviceCode: base.label ? serviceCodeForLabel(base.label) : ROWS_ONLY_SERVICE_CODE,
    provider: base.provider,
    phone: base.phone,
    start: base.start,
    end: base.end,
    units: base.units,
    cost: base.cost,
    pa: base.pa,
    tasks: [],
    transport: null,
    unread: [],
    monthly: base.monthly,
  };
  for (const row of rows) {
    if (row.kind === "unread") {
      service.unread.push({ raw: row.raw, reason: row.reason });
    } else if (row.kind === "transport") {
      service.transport ??= { unitsPerMonth: row.unitsPerMonth, minutesPerMonth: row.minutesPerMonth };
    } else {
      addTask(service, row.task, duplicates);
    }
  }
  return service;
}

/** Rows read for a plan: tasks, transportation and rows we couldn't read. */
function rowCount(services: ImportedService[]): number {
  return services.reduce((n, s) => n + s.tasks.length + (s.transport ? 1 : 0) + s.unread.length, 0);
}

/** IMP-13: the banner's dates, else the first group row that has dates. */
function planFor(parts: ResultParts): ImportResult["plan"] {
  if (parts.bannerPlan) return parts.bannerPlan;
  const dated = parts.services.find((s) => s.start !== null && s.end !== null);
  return dated?.start && dated.end ? { start: dated.start, end: dated.end } : null;
}

/**
 * Work out the issues (IMPORT-SPEC 3.1) from what was read and assemble the result.
 * `leading` issues, such as a refused page, come first. Messages never include the
 * participant's name or DCN (IMP-16).
 */
export function buildResult(parts: ResultParts, leading: ImportIssue[] = []): ImportResult {
  const { services } = parts;
  const rows = rowCount(services);
  const total = pagingTotal(parts.paging);
  const plan = planFor(parts);
  const issues: ImportIssue[] = [...leading];

  if (rows === 0) {
    issues.push({ level: "error", code: "no-rows", message: "We couldn't find care plan tasks in this text." });
  }
  if (total !== null && rows < total) {
    issues.push({
      level: "error", code: "incomplete", have: rows, total,
      message: `This copy has ${rows} of the plan's ${total} rows.`,
    });
  }
  for (const service of services) {
    if (service.label && !service.serviceCode) {
      issues.push({
        level: "input", code: "unknown-service", label: service.label,
        message: `We don't know which service "${service.label}" is yet.`,
      });
    }
    for (const unread of service.unread) {
      issues.push({
        level: "error", code: "unread-row", raw: unread.raw,
        message: `We couldn't read this row: ${unread.raw}`,
      });
    }
    for (const task of service.tasks) {
      if (!task.taskCode) {
        issues.push({
          level: "warn", code: "unknown-task", name: task.name,
          message: `"${task.name}" isn't in our Missouri task list. We'll still schedule it.`,
        });
      }
      if (task.minPerDay % 5 !== 0) {
        issues.push({
          level: "warn", code: "odd-minutes", name: task.name,
          message: `${task.name} has ${task.minPerDay} minutes a day, which isn't a 5-minute step. Check it against Fusion.`,
        });
      }
    }
  }
  issues.push(...parts.duplicates, ...parts.skipped);
  if (!plan && rows > 0) {
    issues.push({ level: "input", code: "no-plan-dates", message: "The plan dates weren't included. Enter them from Fusion." });
  }
  if (plan && (!isRealDate(plan.start) || !isRealDate(plan.end) || plan.end < plan.start)) {
    issues.push({ level: "error", code: "bad-dates", message: "The plan dates don't make sense. Check them against Fusion." });
  }

  return {
    participant: parts.participant,
    plan,
    totalCost: parts.totalCost,
    paging: parts.paging,
    services,
    visits: parts.visits,
    issues,
  };
}
