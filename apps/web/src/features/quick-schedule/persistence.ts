import { MO_2026_07 } from "@careplan/engine";
import type { SourceRef } from "@careplan/import";
import { singlePlan } from "./carePlan.js";
import { newId } from "./ids.js";
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
const isSourceRef = (value: unknown): value is SourceRef =>
  isRecord(value) && isInt(value.page, 1) && isInt(value.line, 1);

function isTask(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isStringOrNull(value.taskCode) &&
    (value.minPerDay === null || isInt(value.minPerDay, 0)) &&
    isInt(value.daysPerWeek, 1, 7) &&
    (value.pinned === null || (Array.isArray(value.pinned) && value.pinned.every(isWeekday))) &&
    typeof value.locked === "boolean" &&
    (value.raw === undefined || value.raw === null || typeof value.raw === "string") &&
    (value.source === undefined || value.source === null || isSourceRef(value.source))
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
 * hand) falls back to the example instead of breaking the page. `id` (JOIN-03) is optional here so
 * a plan saved before task UUIDs still loads.
 */
function isStoredState(value: unknown): value is StoredState {
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
    (value.id === undefined || typeof value.id === "string") &&
    (value.sourceRef === undefined || value.sourceRef === null || isSourceRef(value.sourceRef)) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTask) &&
    Array.isArray(value.activeDays) &&
    value.activeDays.length === 7 &&
    value.activeDays.every((day) => typeof day === "boolean") &&
    isTransport(value.transport, value.source) &&
    isRecord(value.edits) &&
    Object.values(value.edits).every((minutes) => isInt(minutes, 0, 1440)) &&
    isRecord(value.fusion) &&
    Object.values(value.fusion).every((units) => isInt(units, 0)) &&
    Array.isArray(value.notes) &&
    value.notes.every(isNote) &&
    typeof value.isExample === "boolean" &&
    isInt(value.rowsRead, 0)
  );
}

/** A QuickState as it may be stored: `id` (JOIN-03) is optional so a copy saved before it still loads. */
type StoredState = Omit<QuickState, "id"> & { id?: string };
/** A CarePlan as it may be stored, with services that may predate task UUIDs. */
type StoredCarePlan = Omit<CarePlan, "services"> & { services: StoredState[] };

const EVENT_KINDS = new Set(["NURSE_VISIT", "ADC_DAY", "MEAL_DELIVERY", "SFC_DAY", "REMINDER"]);
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const isOptional = (value: unknown, test: (value: unknown) => boolean): boolean => value === undefined || test(value);

/** A dated event (Coverage Phase 3), validated the way `others` are: a bad one drops the saved plan. */
function isEvent(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.authorizationId === "string" &&
    typeof value.kind === "string" &&
    EVENT_KINDS.has(value.kind) &&
    typeof value.date === "string" &&
    ISO_DATE.test(value.date) &&
    isInt(value.quantity, 0) &&
    typeof value.billable === "boolean" &&
    value.billable === (value.kind !== "REMINDER") &&
    isOptional(value.start, (time) => typeof time === "string" && LOCAL_TIME.test(time)) &&
    isOptional(value.end, (time) => typeof time === "string" && LOCAL_TIME.test(time)) &&
    isOptional(value.transportMinutes, (minutes) => isInt(minutes, 0, 1440)) &&
    isOptional(value.evaluation, (flag) => typeof flag === "boolean") &&
    isOptional(value.note, (note) => typeof note === "string" && note.length <= 500)
  );
}

/** JOIN-03: give a stored authorization without a UUID a fresh one so every authorization has one. */
function migrateState(state: StoredState): QuickState {
  return { ...state, id: state.id ?? newId() };
}

/**
 * Authorizations saved before Coverage Phase 3 get the UUID their dated events point at; an event
 * whose authorization is no longer in the plan is dropped rather than left pointing at nothing.
 */
function migratePlan(plan: StoredCarePlan): CarePlan {
  const visits = plan.visits.map((visit) => ({ ...visit, id: visit.id ?? newId() }));
  const others = plan.others?.map((other) => ({ ...other, id: other.id ?? newId() }));
  const ids = new Set([...visits, ...(others ?? [])].map((authorization) => authorization.id));
  const events = plan.events?.filter((event) => ids.has(event.authorizationId));
  return {
    ...plan,
    services: plan.services.map(migrateState),
    visits,
    ...(others ? { others } : {}),
    ...(events ? { events } : {}),
  };
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
    isStringOrNull(value.pa) &&
    isOptional(value.id, (id) => typeof id === "string")
  );
}

const isDateOrNull = (value: unknown): boolean => value === null || (typeof value === "string" && ISO_DATE.test(value));

function isOther(value: unknown): boolean {
  return (
    isRecord(value) &&
    isStringOrNull(value.label) &&
    isStringOrNull(value.code) &&
    isStringOrNull(value.registryId) &&
    isStringOrNull(value.provider) &&
    isStringOrNull(value.pa) &&
    isDateOrNull(value.start) &&
    isDateOrNull(value.end) &&
    Array.isArray(value.monthly) &&
    value.monthly.every(
      (month) =>
        isRecord(month) &&
        typeof month.start === "string" && ISO_DATE.test(month.start) &&
        typeof month.end === "string" && ISO_DATE.test(month.end) &&
        isInt(month.units, 0),
    ) &&
    Array.isArray(value.rows) &&
    value.rows.every((row) => typeof row === "string") &&
    isOptional(value.id, (id) => typeof id === "string")
  );
}

function isStoredCarePlan(value: unknown): value is StoredCarePlan {
  if (!isRecord(value) || !Array.isArray(value.services) || value.services.length === 0) return false;
  const count = value.services.length;
  return (
    value.services.every(isStoredState) &&
    Array.isArray(value.visits) &&
    value.visits.every(isVisit) &&
    // Kept authorizations (IMP-19); plans saved before them have none.
    (value.others === undefined || (Array.isArray(value.others) && value.others.every(isOther))) &&
    // Dated events (Coverage Phase 3); plans saved before them have none.
    (value.events === undefined || (Array.isArray(value.events) && value.events.every(isEvent))) &&
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
      if (!isStoredCarePlan(parsed)) return null;
      const plan = migratePlan(parsed);
      return { ...plan, services: plan.services.map((state) => ({ ...state, identity: null })) };
    }
    const old = sessionStorage.getItem(STATE_KEY);
    if (old === null) return null;
    const state: unknown = JSON.parse(old);
    return isStoredState(state) ? singlePlan({ ...migrateState(state), identity: null }) : null;
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
