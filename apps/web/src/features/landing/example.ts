import { MO_2026_07, composeWeek, ruleById, type AuthorizedTask, type RuleCatalogEntry } from "@careplan/engine";
import { monthName } from "../../lib/format";
import { checksumLines } from "../quick-schedule/checksumText";
import { cellRefusal } from "../quick-schedule/guard";
import { groupResults } from "../quick-schedule/grouping";
import { exampleStateA } from "../quick-schedule/initialStates";
import { buildQuickModel } from "../quick-schedule/model";
import type { QuickState } from "../quick-schedule/types";

/**
 * The landing page's figures, computed by the same code Quick Schedule uses (APP-SPEC 12):
 * fixture A read with @careplan/import and built with the Quick Schedule model and guard, as the
 * 5-day example Quick Schedule opens with (starting this month).
 */
function exampleState(today: Date): QuickState {
  return exampleStateA(today);
}

export interface ExampleDayTotals {
  /** Minutes per weekday, Sunday first. */
  dayTotals: number[];
  activeDays: boolean[];
  /** The Quick Schedule status (APP-SPEC 5.4): "Ready to use", or how many things to fix. */
  status: string;
}

/** APP-SPEC 12: the headline figure, the example plan's Day total row and its checked status. */
export function exampleDayTotals(today = new Date()): ExampleDayTotals {
  const state = exampleState(today);
  const model = buildQuickModel(state, MO_2026_07);
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of model.entries) dayTotals[entry.weekday] = (dayTotals[entry.weekday] ?? 0) + entry.minutes;
  const toFix = groupResults(model.results).filter((group) => group.severity === "BLOCK").length;
  return {
    dayTotals,
    activeDays: state.activeDays,
    status: toFix === 0 ? "Ready to use" : `${toFix} ${toFix === 1 ? "thing" : "things"} to fix`,
  };
}

/** APP-SPEC 12.1: the checksum line for fixture A, from our total and Fusion's figure. */
export function exampleMatchLine(today = new Date()): string {
  const checksum = buildQuickModel(exampleState(today), MO_2026_07).checksum;
  if (!checksum) throw new Error("The example care plan has no Fusion figure to check against.");
  const { lead, detail } = checksumLines(checksum);
  return `${lead} ${detail}`;
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
 * APP-SPEC 12.3: the refusal box Quick Schedule shows for raising Bathing on Tuesday to 50
 * minutes in the example plan, from the real guard (APP-SPEC 5.7), viewing the first plan month
 * where Bathing has no room left (one with 23 weekdays).
 */
export function exampleRefusal(today = new Date()): ExampleRefusal {
  const base = exampleState(today);
  const bathing = base.tasks.find((task) => task.name === "Bathing");
  if (!bathing) throw new Error("The example care plan has no Bathing task.");
  for (const month of buildQuickModel(base, MO_2026_07).months) {
    const refusal = cellRefusal({ ...base, viewMonth: month }, `${bathing.id}:2`, 50, MO_2026_07);
    if (refusal && refusal.useMinutes === null && refusal.sentence.includes(monthName(month))) {
      return { sentence: refusal.sentence, fix: refusal.hint };
    }
  }
  throw new Error("The example change was not refused.");
}

/** APP-SPEC 12.4: one rule card with its source line. */
export function exampleRuleCard(): RuleCatalogEntry {
  const entry = ruleById("SCH-08");
  if (!entry) {
    throw new Error("Rule SCH-08 is missing from the catalog.");
  }
  return entry;
}
