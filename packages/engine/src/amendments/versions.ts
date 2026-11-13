import { expandMonth } from "../calendar/expand.js";
import { addDays, daysInMonth, formatYmd } from "../math/dates.js";
import type {
  AuthorizationChain,
  AuthorizationVersion,
  CalendarException,
  ScheduleTemplate,
  ServiceAuthorization,
  VersionedOccurrence,
} from "../types.js";

/** An authorization with no amendment: one version, in effect from its start. */
export function chainOf(authorization: ServiceAuthorization, template: ScheduleTemplate): AuthorizationChain {
  return {
    serviceAuthId: authorization.id,
    versions: [{ amendmentId: null, direction: null, effectiveFrom: authorization.start, authorization, template }],
  };
}

/** What an amendment adds: everything of a version except that it is never the original. */
export type AmendmentVersion = AuthorizationVersion & { amendmentId: string };

/**
 * Add an amendment as the next version. History is never rewritten: the new version must take
 * effect after every version already in the chain, inside the authorization's dates, under an
 * amendment id not used before. Returns a new chain; the one passed in is untouched.
 */
export function addVersion(chain: AuthorizationChain, version: AmendmentVersion): AuthorizationChain {
  const first = chain.versions[0];
  const last = chain.versions[chain.versions.length - 1];
  if (!first || !last) throw new Error("An authorization chain needs its original version");
  if (chain.versions.some((existing) => existing.amendmentId === version.amendmentId)) {
    throw new Error(`Amendment ${version.amendmentId} is already in the chain`);
  }
  if (version.effectiveFrom <= last.effectiveFrom) {
    throw new Error(`An amendment takes effect after the version before it (${last.effectiveFrom})`);
  }
  const { start, end } = first.authorization;
  if (version.effectiveFrom < start || version.effectiveFrom > end) {
    throw new Error(`An amendment takes effect inside the authorization (${start} to ${end})`);
  }
  return { serviceAuthId: chain.serviceAuthId, versions: [...chain.versions, version] };
}

/** The last date a version is in effect: its own end, else the day before the next, else the authorization's end. */
function lastDateOf(chain: AuthorizationChain, index: number): string {
  const version = chain.versions[index]!;
  const next = chain.versions[index + 1];
  const authEnd = chain.versions[0]!.authorization.end;
  const ownEnd = version.effectiveTo ?? (next ? addDays(next.effectiveFrom, -1) : authEnd);
  return ownEnd < authEnd ? ownEnd : authEnd;
}

/**
 * The version in effect on a date: the latest one that has taken effect. A version that ended
 * (`effectiveTo`) leaves no version in effect until the next one starts; an earlier version never
 * comes back. Null outside the authorization's dates.
 */
export function versionOn(chain: AuthorizationChain, date: string): AuthorizationVersion | null {
  const first = chain.versions[0];
  if (!first || date < first.authorization.start || date > first.authorization.end) return null;
  for (let index = chain.versions.length - 1; index >= 0; index--) {
    const version = chain.versions[index]!;
    if (version.effectiveFrom <= date) return date <= lastDateOf(chain, index) ? version : null;
  }
  return null;
}

/**
 * One month of a chain: every scheduled occurrence, each tagged with the version in effect on its
 * date (`amendmentId`, null for the original). Each version is expanded only over its own dates,
 * so a later amendment cannot change an occurrence before its effective date. Sorted by date,
 * then task id. Days with nothing scheduled give no occurrence.
 */
export function expandChainMonth(
  chain: AuthorizationChain,
  exceptions: CalendarException[],
  year: number,
  month: number,
): VersionedOccurrence[] {
  const monthStart = formatYmd(year, month, 1);
  const monthEnd = formatYmd(year, month, daysInMonth(year, month));
  const authStart = chain.versions[0]?.authorization.start ?? monthStart;
  const occurrences: VersionedOccurrence[] = [];
  chain.versions.forEach((version, index) => {
    const from = [version.effectiveFrom, authStart, monthStart].sort().at(-1)!;
    const to = [lastDateOf(chain, index), monthEnd].sort()[0]!;
    if (from > to) return;
    const expanded = expandMonth(version.template, exceptions, year, month, from, to);
    for (const [date, tasks] of Object.entries(expanded)) {
      for (const [taskId, minutes] of Object.entries(tasks)) {
        if (minutes > 0) {
          occurrences.push({ date, taskId, minutes, amendmentId: version.amendmentId, serviceAuthId: chain.serviceAuthId });
        }
      }
    }
  });
  return occurrences.sort((a, b) => (a.date === b.date ? a.taskId.localeCompare(b.taskId) : a.date < b.date ? -1 : 1));
}
