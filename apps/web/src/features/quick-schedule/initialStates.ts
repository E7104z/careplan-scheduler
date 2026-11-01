import { MO_2026_07 } from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { addMonths, lastDayIso, localMonth, monthsBetween } from "./model.js";
import { fromFusion } from "../import/fromFusion.js";
import { newId } from "./ids.js";
import type { QuickState } from "./types.js";
import fixtureA from "@fixtures/fusion/A-run-together-5day-466.txt?raw";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";

/** APP-SPEC 5.2 QS-01/QS-03: an empty by-hand schedule starting next calendar month. */
export function manualState(today: Date): QuickState {
  const start = addMonths(localMonth(today), 1);
  return {
    source: "manual",
    identity: null,
    provider: null,
    pa: null,
    serviceLabel: null,
    serviceCode: "T1019U2",
    plan: { start: `${start}-01`, end: lastDayIso(addMonths(start, 11)) },
    headerUnits: null,
    tasks: [],
    id: newId(),
    activeDays: [true, true, true, true, true, true, true],
    transport: { minPerTrip: 0, tripsPerWeek: 1, day: 1 },
    edits: {},
    fusion: {},
    fromMonth: localMonth(today),
    viewMonth: start,
    reviewed: null,
    isExample: false,
    notes: [],
    rowsRead: 0,
  };
}

/**
 * QS-12: an example plan, moved to start this month. The de-identified fixtures are real plans
 * from 2025, and a schedule only covers months still to come, so the example keeps its length
 * and tasks but not its dates. Fixtures A and B come from the care plan screen, so they have no
 * figures for single months to move.
 */
export function currentExample(state: QuickState, today: Date): QuickState {
  const month = localMonth(today);
  const length = monthsBetween(state.plan.start, state.plan.end).length;
  return {
    ...state,
    plan: { start: `${month}-01`, end: lastDayIso(addMonths(month, length - 1)) },
    fusion: {},
    fromMonth: month,
    viewMonth: month,
    isExample: true,
  };
}

/** The de-identified fixture A, imported as if pasted (QS-12), starting this month. */
export function exampleStateA(today: Date): QuickState {
  return currentExample(fromFusion(parseFusionText(fixtureA, MO_2026_07), 0, today), today);
}

/** The de-identified fixture B, imported as if pasted (QS-12), starting this month. */
export function exampleStateB(today: Date): QuickState {
  return currentExample(fromFusion(parseFusionText(fixtureB, MO_2026_07), 0, today), today);
}
