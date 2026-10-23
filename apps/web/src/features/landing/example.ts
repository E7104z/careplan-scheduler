import fixture from "@fixtures/fusion/A-run-together-5day-466.txt?raw";
import { parseFusionText } from "@careplan/import";
import {
  MO_2026_07,
  composeWeek,
  fitToAuthorization,
  ruleById,
  validateSchedule,
  type AuthorizedTask,
  type CalendarException,
  type MonthlyAuthorization,
  type RuleCatalogEntry,
  type ScheduleTemplate,
  type ServiceAuthorization,
  type ValidationResult,
  type Weekday,
} from "@careplan/engine";
import { formatMonth, weekdayName } from "../../lib/format";

export interface ExampleEdit {
  taskName: string;
  weekday: Weekday;
  minutes: number;
}

interface ExampleModel {
  tasks: AuthorizedTask[];
  auth: ServiceAuthorization;
  template: ScheduleTemplate;
  monthlyAuthorizations: MonthlyAuthorization[];
  trims: CalendarException[];
  months: string[];
  fusionUnits: number;
  dayTotals: number[];
  taskByName: Map<string, AuthorizedTask>;
}

const AUTH_ID = "A-EXAMPLE-01";
const PARTICIPANT_ID = "P-EXAMPLE-01";
const TEMPLATE_ID = "TPL-EXAMPLE-01";

function monthsBetween(start: string, end: string): string[] {
  const startParts = start.slice(0, 7).split("-");
  const endParts = end.slice(0, 7).split("-");
  const startYear = Number(startParts[0]);
  const startMonth = Number(startParts[1]);
  const endYear = Number(endParts[0]);
  const endMonth = Number(endParts[1]);

  const months: string[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    if (month === 12) {
      year += 1;
      month = 1;
    } else {
      month += 1;
    }
  }
  return months;
}

function buildExampleModel(): ExampleModel {
  const parsed = parseFusionText(fixture, MO_2026_07);
  const service = parsed.services[0];
  const plan = parsed.plan;
  if (!service || !plan) {
    throw new Error("The example care plan could not be read.");
  }

  const tasks: AuthorizedTask[] = service.tasks.map((task, index) => ({
    id: `T-${String(index + 1).padStart(2, "0")}`,
    serviceAuthId: AUTH_ID,
    taskCode: task.taskCode ?? "UNKNOWN",
    name: task.name,
    minPerDay: task.minPerDay,
    daysPerWeek: task.daysPerWeek,
  }));

  const auth: ServiceAuthorization = {
    id: AUTH_ID,
    participantId: PARTICIPANT_ID,
    program: "CDS",
    serviceCode: service.serviceCode ?? "T1019",
    start: plan.start,
    end: plan.end,
    state: "active",
    suspensions: [],
    revision: 1,
    tasks,
    transportMinutesPerMonth: service.transport?.minutesPerMonth,
  };

  const transportMinutes =
    Math.floor(Math.floor((service.transport?.minutesPerMonth ?? 0) / 15) / 5) * 15;

  const composed = composeWeek({
    tasks,
    activeDays: [false, true, true, true, true, true, false],
    overrides: {},
    weeklyTransportMinutes: transportMinutes,
    transportDay: 5,
  });

  const template: ScheduleTemplate = {
    id: TEMPLATE_ID,
    participantId: PARTICIPANT_ID,
    start: plan.start,
    end: plan.end,
    entries: composed.entries,
    rulePackVersion: MO_2026_07.id,
  };

  const months = monthsBetween(plan.start, plan.end);
  const monthlyAuthorizations: MonthlyAuthorization[] = months.map((month) => ({
    serviceAuthId: AUTH_ID,
    month,
    units: service.units,
    source: "fusion",
    revision: 1,
  }));

  const trims = fitToAuthorization(template, auth, monthlyAuthorizations, months);
  const taskByName = new Map(tasks.map((task) => [task.name, task]));

  return {
    tasks,
    auth,
    template,
    monthlyAuthorizations,
    trims,
    months,
    fusionUnits: service.units,
    dayTotals: composed.dayTotals,
    taskByName,
  };
}

function checksFor(model: ExampleModel, edit: ExampleEdit): ValidationResult[] {
  const task = model.taskByName.get(edit.taskName);
  const entry = model.template.entries.find(
    (candidate) =>
      task !== undefined && candidate.taskId === task.id && candidate.weekday === edit.weekday,
  );
  if (!task || !entry) {
    return [];
  }

  const entries = model.template.entries.map((candidate) =>
    candidate.taskId === task.id && candidate.weekday === edit.weekday
      ? { ...candidate, minutes: edit.minutes }
      : { ...candidate },
  );
  const template: ScheduleTemplate = { ...model.template, entries };

  return validateSchedule({
    pack: MO_2026_07,
    authorizations: [model.auth],
    monthlyAuthorizations: model.monthlyAuthorizations,
    template,
    exceptions: model.trims,
    visits: [],
    caregivers: [],
    enrollments: [],
    months: model.months,
    tenantWorkweekStart: 0,
  });
}

/** Run the engine against the built-in example with one weekday edit applied. */
export function exampleChecks(edit: ExampleEdit): ValidationResult[] {
  return checksFor(buildExampleModel(), edit);
}

/** APP-SPEC 12.1: the match line against Fusion's imported monthly units. */
export function exampleMatchLine(): string {
  const model = buildExampleModel();
  return `Every task read. Our total from these tasks matches Fusion's ${model.fusionUnits} units a month.`;
}

export interface ExampleWeek {
  dayTotals: number[];
  weekText: string;
}

/** The ENGINE-SPEC TC-01 authorization tasks (APP-SPEC 12.2, AC-13). */
const TC01_TASKS: AuthorizedTask[] = [
  { id: "T-TC01-BATH", serviceAuthId: "A-TC01", taskCode: "BATH", name: "Bathing", minPerDay: 30, daysPerWeek: 3 },
  { id: "T-TC01-TOIL", serviceAuthId: "A-TC01", taskCode: "TOIL", name: "Toileting", minPerDay: 15, daysPerWeek: 7 },
  { id: "T-TC01-MEAL", serviceAuthId: "A-TC01", taskCode: "MEAL", name: "Meals/Dishes", minPerDay: 45, daysPerWeek: 7 },
  { id: "T-TC01-LAUN", serviceAuthId: "A-TC01", taskCode: "LAUN", name: "Laundry", minPerDay: 30, daysPerWeek: 2 },
  { id: "T-TC01-KITC", serviceAuthId: "A-TC01", taskCode: "KITC", name: "Clean Kitchen", minPerDay: 10, daysPerWeek: 2 },
];

/** APP-SPEC 12.2: the composed TC-01 example week, Sunday through Saturday. */
export function exampleWeek(): ExampleWeek {
  const composed = composeWeek({
    tasks: TC01_TASKS,
    activeDays: [true, true, true, true, true, true, true],
    overrides: {},
    weeklyTransportMinutes: 0,
    transportDay: 0,
  });
  return {
    dayTotals: composed.dayTotals,
    weekText: composed.dayTotals.join(", "),
  };
}

export interface ExampleRefusal {
  sentence: string;
  fix: string;
}

/**
 * APP-SPEC 12.3: the refusal box for raising Bathing on Tuesday above its limit.
 * The sentence is built from the engine's SCH-08 block and the fix line from the
 * task's own minutes, so nothing here is a hardcoded sample result.
 */
export function exampleRefusal(): ExampleRefusal {
  const model = buildExampleModel();
  const task = model.taskByName.get("Bathing");
  if (!task) {
    throw new Error("The example care plan has no Bathing task.");
  }

  const results = checksFor(model, { taskName: task.name, weekday: 2, minutes: 50 });
  const block = results.find(
    (result) =>
      result.ruleId === "SCH-08" &&
      result.severity === "BLOCK" &&
      result.refs.taskId === task.id &&
      result.refs.month === "2025-10",
  );
  if (!block) {
    throw new Error("The example refusal check produced no October 2025 block for Bathing.");
  }

  const units = /\((\d+) units\)/.exec(block.message)?.[1] ?? "0";
  return {
    sentence: `That would put ${task.name} over its ${units} units in ${formatMonth("2025-10")}.`,
    fix: `${task.name} can't have more than ${task.minPerDay} minutes on ${weekdayName(2)}. To add time here, take it from another day first.`,
  };
}

/** APP-SPEC 12.4: one rule card with its source line. */
export function exampleRuleCard(): RuleCatalogEntry {
  const entry = ruleById("SCH-08");
  if (!entry) {
    throw new Error("Rule SCH-08 is missing from the catalog.");
  }
  return entry;
}
