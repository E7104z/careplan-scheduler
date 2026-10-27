import { describe, expect, it } from "vitest";
import { MO_2026_07, calculate3c } from "@careplan/engine";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { exampleStateA, manualState, reduce, type QuickAction } from "../../src/features/quick-schedule/state";
import type { QuickState } from "../../src/features/quick-schedule/types";
import { emptyWorksheet, worksheetReducer } from "../../src/features/quick-schedule/worksheet/worksheetState";
import { formFor, worksheet3a, worksheet3c, worksheetUnits } from "../../src/features/quick-schedule/worksheet/worksheetView";

const TODAY = new Date("2026-10-21T12:00:00-05:00");
const PACK = MO_2026_07;

function byHand(...actions: QuickAction[]): QuickState {
  return actions.reduce((state, action) => reduce(state, action, PACK).state, manualState(TODAY));
}
const task = (state: QuickState, code: string) => state.tasks.find((t) => t.taskCode === code)!;

describe("formFor", () => {
  it("lays CDS on the 3c's CDS tab, ILW on its ILW tab, and agency and waiver services on the 3a", () => {
    expect(formFor("T1019U2")).toBe("3c-cds");
    expect(formFor("T1019U6")).toBe("3c-ilw");
    for (const code of ["T1019", "T1019TF", "S5130", "S5120", "S5150", "S5150TF"] as const) expect(formFor(code)).toBe("3a");
  });
});

describe("worksheet3c", () => {
  it("puts the example's tasks on DSDS's rows, in DSDS's order, with the engine's numbers", () => {
    const state = exampleStateA(TODAY);
    const view = worksheet3c(state, buildQuickModel(state, PACK), emptyWorksheet(state), PACK);
    expect(view.form).toBe("3c-cds");
    expect(view.rows.map((row) => row.guidance.label)[0]).toBe("Asst. Transfer Device");
    const bathing = view.rows.find((row) => row.task?.taskCode === "BATHING")!;
    expect(bathing.result?.totalUnits).toBe(calculate3c({ tab: "CDS", rows: [{ taskCode: "BATHING", minPerDay: bathing.task!.minPerDay, daysPerWeek: bathing.task!.daysPerWeek }], transportMinutesPerMonth: null }, PACK).totalUnits);
    expect(view.input.transportMinutesPerMonth).toBe(765);
    // The example is Fusion's 466-unit plan: the worksheet's 31-day total says the same.
    expect(worksheetUnits(view)).toBe(466);
    expect(view.notOnForm).toEqual([]);
  });

  it("carries descriptions and the ILW lines from the worksheet's own fields", () => {
    const state = byHand({ type: "setService", code: "T1019U6" }, { type: "addTask", taskCode: "BATHING", name: "Bathing" });
    const fields = worksheetReducer(worksheetReducer(emptyWorksheet(state), { type: "describe", key: task(state, "BATHING").id, text: "Tub transfer" }), { type: "ilwExtra", field: "caseManagementUnits", units: 0 });
    const view = worksheet3c(state, buildQuickModel(state, PACK), fields, PACK);
    expect(view.form).toBe("3c-ilw");
    expect(view.input.rows).toEqual([{ taskCode: "BATHING", minPerDay: task(state, "BATHING").minPerDay, daysPerWeek: task(state, "BATHING").daysPerWeek, description: "Tub transfer" }]);
    expect(view.result.ilwExtras?.caseManagementCents).toBe(45809);
  });
});

describe("worksheet3a", () => {
  it("WS-A03: an agency personal care plan's household tasks sit on Homemaker rows, done under Personal Care", () => {
    const state = byHand({ type: "setService", code: "T1019" }, { type: "addTask", taskCode: "BATHING", name: "Bathing" }, { type: "addTask", taskCode: "CLEAN_KITCHEN", name: "Clean Kitchen" });
    const view = worksheet3a(state, emptyWorksheet(state), PACK);
    expect(view.own).toBe("personalCare");
    expect(view.input.flags.medRelHousehold).toBe(true);
    const kitchen = view.sections.find((s) => s.section === "homemaker")!.rows.find((row) => row.task)!;
    expect([kitchen.guidance.label, kitchen.underPersonalCare]).toEqual(["CLEAN KITCHEN", true]);
    expect(view.result.subtotals.homemakerUnits).toBe(0);
    expect(worksheetUnits(view)).toBe(view.result.subtotals.personalCareUnits);
  });

  it("takes respite from the care plan and every other line from the worksheet's fields", () => {
    const state = byHand({ type: "setService", code: "S5150" }, { type: "addTask", taskCode: "BASIC_RESPITE", name: "Basic Respite" });
    let fields = emptyWorksheet(state);
    fields = worksheetReducer(fields, { type: "line", line: "respiteBasic", entry: { minPerDay: 999, daysPerWeek: 7 } });
    fields = worksheetReducer(fields, { type: "line", line: "adultDayCare", entry: { minPerDay: 360, daysPerWeek: 2 } });
    const view = worksheet3a(state, fields, PACK);
    const basic = view.input.rows.filter((row) => row.section === "respiteBasic");
    expect(basic).toHaveLength(1);
    expect(basic[0]?.minPerDay).toBe(task(state, "BASIC_RESPITE").minPerDay);
    expect(view.input.rows.find((row) => row.section === "adultDayCare")).toMatchObject({ minPerDay: 360, daysPerWeek: 2 });
    expect(view.own).toBe("respiteBasic");
  });

  it("lists a task with no row on the form under \"Not on the DSDS form\"", () => {
    const state = { ...byHand({ type: "setService", code: "T1019TF" }, { type: "addTask", taskCode: "BOWEL_PROGRAM", name: "Bowel Program" }) };
    state.tasks = [...state.tasks, { ...state.tasks[0]!, id: "x", taskCode: null, name: "Read from Fusion only" }];
    const view = worksheet3a(state, emptyWorksheet(state), PACK);
    expect(view.notOnForm.map((t) => t.name)).toEqual(["Read from Fusion only"]);
  });
});

describe("the mapping reads only the state, the worksheet's fields and the pack", () => {
  it("gives the same answer every time and touches no storage", () => {
    sessionStorage.clear();
    localStorage.clear();
    const state = exampleStateA(TODAY);
    const fields = { ...emptyWorksheet(state), name: "P-TEST-01", dcn: "99999999", providerPhone: "555-0100", emergencyName: "P-TEST-02", emergencyPhone: "555-0101" };
    const once = worksheet3c(state, buildQuickModel(state, PACK), fields, PACK);
    const twice = worksheet3c(structuredClone(state), buildQuickModel(state, PACK), structuredClone(fields), PACK);
    expect(twice.result).toEqual(once.result);
    expect(sessionStorage.length + localStorage.length).toBe(0);
  });
});
