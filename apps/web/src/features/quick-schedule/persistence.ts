import type { QuickState } from "../quick-schedule/types.js";

const KEY = "cps.quick.v2";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuickState(value: unknown): value is QuickState {
  if (!isRecord(value)) return false;
  if (value.source !== "fusion" && value.source !== "manual") return false;
  if (!isRecord(value.plan)) return false;
  if (typeof value.plan.start !== "string" || typeof value.plan.end !== "string") return false;
  if (typeof value.serviceCode !== "string") return false;
  if (typeof value.nextId !== "number") return false;
  if (typeof value.viewMonth !== "string") return false;
  if (!Array.isArray(value.activeDays) || value.activeDays.length !== 7) return false;
  if (!Array.isArray(value.tasks)) return false;
  if (!Array.isArray(value.notes)) return false;
  if (typeof value.rowsRead !== "number") return false;
  if (!isRecord(value.edits)) return false;
  if (!isRecord(value.fusion)) return false;
  if (!isRecord(value.transport) || typeof value.transport.day !== "number") return false;
  for (const task of value.tasks) {
    if (!isRecord(task)) return false;
    if (typeof task.id !== "string" || typeof task.name !== "string") return false;
    if (typeof task.daysPerWeek !== "number") return false;
    if (typeof task.locked !== "boolean") return false;
  }
  return true;
}

/** Persist everything except `identity` (APP-SPEC 5.6). Never throws. */
export function saveQuickState(state: QuickState): void {
  try {
    const { identity: _identity, ...rest } = state;
    sessionStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // Storage can be unavailable (private mode, quota). Quick Schedule keeps working.
  }
}

/** Restore if the shape validates, else null. The identity is never in storage. */
export function loadQuickState(): QuickState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isQuickState(parsed)) return null;
    return { ...parsed, identity: null, isExample: false };
  } catch {
    return null;
  }
}
