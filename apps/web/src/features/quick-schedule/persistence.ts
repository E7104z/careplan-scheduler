import { MO_2026_07 } from "@careplan/engine";
import { singlePlan } from "./carePlan.js";
import type { CarePlan, QuickState } from "./types.js";

/** APP-SPEC 5.8: the participant's whole care plan. */
export const PLAN_KEY = "cps.quick.v3";
/** A single service's state, as saved before APP-SPEC 5.8; still read, so a reload keeps it. */
export const STATE_KEY = "cps.quick.v2";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
const SERVICE_CODES = new Set<string>(MO_2026_07.services.map((service) => service.code));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

const isWeekday = (value: unknown): boolean => isInt(value, 0, 6);
const isStringOrNull = (value: unknown): boolean => value === null || typeof value === "string";

function isTask(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isStringOrNull(value.taskCode) &&
    (value.minPerDay === null || isInt(value.minPerDay, 0)) &&
    isInt(value.daysPerWeek, 1, 7) &&
    (value.pinned === null || (Array.isArray(value.pinned) && value.pinned.every(isWeekday))) &&
    typeof value.locked === "boolean"
  );
}

function isTransport(value: unknown, source: unknown): boolean {
  if (!isRecord(value) || !isWeekday(value.day)) return false;
  return source === "fusion"
    ? isInt(value.minutesPerMonth, 0)
    : isInt(value.minPerTrip, 0) && isInt(value.tripsPerWeek, 1, 7);
}

function isNote(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.level === "string" &&
    typeof value.message === "string"
  );
}

/**
 * Everything buildQuickModel relies on, so a stored copy from an older version (or one edited by
 * hand) falls back to the example instead of breaking the page.
 */
function isQuickState(value: unknown): value is QuickState {
  return (
    isRecord(value) &&
    (value.source === "fusion" || value.source === "manual") &&
    typeof value.serviceCode === "string" &&
    SERVICE_CODES.has(value.serviceCode) &&
    isRecord(value.plan) &&
    typeof value.plan.start === "string" &&
    ISO_DATE.test(value.plan.start) &&
    typeof value.plan.end === "string" &&
    ISO_DATE.test(value.plan.end) &&
    typeof value.viewMonth === "string" &&
    ISO_MONTH.test(value.viewMonth) &&
    typeof value.fromMonth === "string" &&
    ISO_MONTH.test(value.fromMonth) &&
    (value.reviewed === null || (typeof value.reviewed === "string" && ISO_DATE.test(value.reviewed))) &&
    (value.headerUnits === null || isInt(value.headerUnits, 0)) &&
    isStringOrNull(value.provider) &&
    isStringOrNull(value.pa) &&
    isStringOrNull(value.serviceLabel) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTask) &&
    isInt(value.nextId, 1) &&
    Array.isArray(value.activeDays) &&
    value.activeDays.length === 7 &&
    value.activeDays.every((day) => typeof day === "boolean") &&
    isTransport(value.transport, value.source) &&
    isRecord(value.edits) &&
    Object.values(value.edits).every((minutes) => isInt(minutes, 0, 1440)) &&
    isRecord(value.fusion) &&
    Object.values(value.fusion).every((units) => isInt(units, 0)) &&
    typeof value.isExample === "boolean" &&
    Array.isArray(value.notes) &&
    value.notes.every(isNote) &&
    isInt(value.rowsRead, 0)
  );
}

function isVisit(value: unknown): boolean {
  return (
    isRecord(value) &&
    isStringOrNull(value.label) &&
    typeof value.serviceCode === "string" &&
    SERVICE_CODES.has(value.serviceCode) &&
    typeof value.name === "string" &&
    isStringOrNull(value.provider) &&
    typeof value.start === "string" &&
    ISO_DATE.test(value.start) &&
    typeof value.end === "string" &&
    ISO_DATE.test(value.end) &&
    isInt(value.units, 0) &&
    isStringOrNull(value.pa)
  );
}

function isCarePlan(value: unknown): value is CarePlan {
  if (!isRecord(value) || !Array.isArray(value.services) || value.services.length === 0) return false;
  const count = value.services.length;
  return (
    value.services.every(isQuickState) &&
    Array.isArray(value.visits) &&
    value.visits.every(isVisit) &&
    Array.isArray(value.notes) &&
    value.notes.every(isNote) &&
    ((value.view === "plan" && count > 1) || isInt(value.view, 0, count - 1))
  );
}

function withoutIdentity(state: QuickState): Omit<QuickState, "identity"> {
  const { identity: _identity, ...rest } = state;
  return rest;
}

/** Persist the whole care plan, every service without `identity` (APP-SPEC 5.6, 5.8). Never throws. */
export function savePlan(plan: CarePlan): void {
  try {
    sessionStorage.setItem(PLAN_KEY, JSON.stringify({ ...plan, services: plan.services.map(withoutIdentity) }));
  } catch {
    // Storage can be unavailable (private mode, quota). Quick Schedule keeps working.
  }
}

/**
 * Restore the care plan if its shape validates, else a single service saved by an earlier version,
 * else null (the page then shows the example). The identity is never in storage.
 */
export function loadPlan(): CarePlan | null {
  try {
    const raw = sessionStorage.getItem(PLAN_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (!isCarePlan(parsed)) return null;
      return { ...parsed, services: parsed.services.map((state) => ({ ...state, identity: null })) };
    }
    const old = sessionStorage.getItem(STATE_KEY);
    if (old === null) return null;
    const state: unknown = JSON.parse(old);
    return isQuickState(state) ? singlePlan({ ...state, identity: null }) : null;
  } catch {
    return null;
  }
}

/** A plan of this one service, saved as the tab's plan. Never throws. */
export function saveQuickState(state: QuickState): void {
  savePlan(singlePlan(state));
}

/** The saved plan's first service, or null. */
export function loadQuickState(): QuickState | null {
  return loadPlan()?.services[0] ?? null;
}
