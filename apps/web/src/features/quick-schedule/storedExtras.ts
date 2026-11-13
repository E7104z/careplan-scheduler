// What Coverage Phases 3 and 4 added to a saved plan, validated the way the rest of it is
// (persistence.ts): every field is optional, so a plan saved by an earlier version still opens,
// and a malformed one drops the saved plan rather than opening it wrong.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIRECTIONS = new Set(["increase", "decrease", "reduction-immediate"]);
const EVENT_KINDS = new Set(["NURSE_VISIT", "ADC_DAY", "MEAL_DELIVERY", "SFC_DAY", "REMINDER"]);
const RELATIONSHIPS = new Set([
  "spouse", "legal_guardian", "parent", "sibling", "child", "stepchild", "grandparent", "grandchild", "other_family", "none",
]);
const WAIVER_CODES = new Set(["ILW", "ADW", "ADCW", "SFCW"]);
const PROGRAM_CODES = new Set(["PACE", "DD_SHARED_LIVING", "DD_RESIDENTIAL_HABILITATION", "DD_ISL", "DMH_SELF_DIRECTED", "DD_WAIVER_PERSONAL_ASSISTANT"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

const isOptional = (value: unknown, test: (value: unknown) => boolean): boolean => value === undefined || test(value);
const isStringList = (value: unknown): boolean => Array.isArray(value) && value.every((item) => typeof item === "string");
const isFlag = (value: unknown): boolean => value === null || typeof value === "boolean";

/** A dated event (Coverage Phase 3). */
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

/** A recorded care plan change (Coverage Phase 3). */
function isAmendment(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.direction === "string" &&
    DIRECTIONS.has(value.direction) &&
    typeof value.date === "string" &&
    ISO_DATE.test(value.date) &&
    typeof value.confirmed === "boolean" &&
    (value.units === null || isInt(value.units, 0)) &&
    isRecord(value.tasks) &&
    Object.values(value.tasks).every((task) => isRecord(task) && isInt(task.minPerDay, 0, 1440) && isInt(task.daysPerWeek, 1, 7))
  );
}

function isDayChange(value: unknown): boolean {
  return (
    isRecord(value) && typeof value.date === "string" && ISO_DATE.test(value.date) &&
    typeof value.taskId === "string" && isInt(value.minutes, 0, 1440)
  );
}

function isStartTimes(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(([weekday, time]) => /^[0-6]$/.test(weekday) && typeof time === "string" && CLOCK_TIME.test(time))
  );
}

function isCoverageBlock(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.serviceAuthId === "string" &&
    typeof value.start === "string" && LOCAL_TIME.test(value.start) &&
    typeof value.end === "string" && LOCAL_TIME.test(value.end)
  );
}

/** A waiver enrollment (Coverage Phase 4) as the person entered it: a code and its dates. */
function isWaiver(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.waiver === "string" &&
    WAIVER_CODES.has(value.waiver) &&
    typeof value.start === "string" && ISO_DATE.test(value.start) &&
    typeof value.end === "string" && ISO_DATE.test(value.end)
  );
}

/** A program outside DSDS (CP4-7) as the person entered it: a code and its dates. */
function isProgram(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.program === "string" &&
    PROGRAM_CODES.has(value.program) &&
    typeof value.start === "string" && ISO_DATE.test(value.start) &&
    typeof value.end === "string" && ISO_DATE.test(value.end)
  );
}

/**
 * A caregiver (Coverage Phase 4) as storage may hold one: an id and the qualifications the person
 * entered. A stored caregiver with a `name` is refused: names live in memory only, like the
 * participant's, and savePlan never writes one.
 */
function isCaregiver(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.name === undefined &&
    (value.relationship === null || (typeof value.relationship === "string" && RELATIONSHIPS.has(value.relationship))) &&
    isFlag(value.agencyEmployee) &&
    isFlag(value.nurseLicense) &&
    isFlag(value.fcsrRegistered)
  );
}

/** The optional fields Phases 3 and 4 put on a service: recorded changes, one-day changes, start times, caregivers. */
export function stateExtrasValid(value: Record<string, unknown>): boolean {
  return (
    isOptional(value.amendments, (list) => Array.isArray(list) && list.every(isAmendment)) &&
    isOptional(value.dayChanges, (list) => Array.isArray(list) && list.every(isDayChange)) &&
    isOptional(value.startTimes, isStartTimes) &&
    isOptional(value.coverage, (list) => Array.isArray(list) && list.every(isCoverageBlock)) &&
    isOptional(value.caregiverIds, isStringList)
  );
}

/** The optional fields Phases 3 and 4 put on the plan: dated events, caregivers, waivers and other programs. */
export function planExtrasValid(value: Record<string, unknown>): boolean {
  return (
    isOptional(value.events, (list) => Array.isArray(list) && list.every(isEvent)) &&
    isOptional(value.caregivers, (list) => Array.isArray(list) && list.every(isCaregiver)) &&
    isOptional(value.waivers, (list) => Array.isArray(list) && list.every(isWaiver)) &&
    isOptional(value.programs, (list) => Array.isArray(list) && list.every(isProgram))
  );
}

/** The optional fields on a visit or a kept authorization: its id, and a covered-day service's primary and backup caregivers. */
export function authorizationExtrasValid(value: Record<string, unknown>): boolean {
  return (
    isOptional(value.id, (id) => typeof id === "string") &&
    isOptional(
      value.sfcCaregivers,
      (pair) => isRecord(pair) && (pair.primary === null || typeof pair.primary === "string") && (pair.backup === null || typeof pair.backup === "string"),
    )
  );
}
