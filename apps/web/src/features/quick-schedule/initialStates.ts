import { MO_2026_07 } from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { addMonths, lastDayIso, localMonth } from "./model.js";
import { fromFusion } from "../import/fromFusion.js";
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
    nextId: 1,
    activeDays: [true, true, true, true, true, true, true],
    transport: { minPerTrip: 0, tripsPerWeek: 1, day: 1 },
    edits: {},
    fusion: {},
    viewMonth: start,
    isExample: false,
    notes: [],
    rowsRead: 0,
  };
}

/** The de-identified fixture A, imported as if pasted (QS-12). */
export function exampleStateA(today: Date): QuickState {
  const parsed = parseFusionText(fixtureA, MO_2026_07);
  return { ...fromFusion(parsed, 0, today), isExample: true };
}

/** The de-identified fixture B, imported as if pasted (QS-12). */
export function exampleStateB(today: Date): QuickState {
  const parsed = parseFusionText(fixtureB, MO_2026_07);
  return { ...fromFusion(parsed, 0, today), isExample: true };
}
