import { describe, expect, it } from "vitest";
import { MO_2026_07, type ScheduleValidationResult } from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { fromFusion } from "../../src/features/import/fromFusion";
import { exampleStateA, manualState } from "../../src/features/quick-schedule/initialStates";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { buildScheduleSheet } from "../../src/features/quick-schedule/scheduleSheet";
import type { QuickState } from "../../src/features/quick-schedule/types";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";
import fixtureE from "@fixtures/fusion/E-care-plan-report-229.txt?raw";

/** Before fixture B's plan starts (Dec 1, 2025), so all 11 months are still to come. */
const BEFORE_B = new Date("2025-11-20T12:00:00-06:00");
/** Before fixture E's plan starts (Apr 1, 2026). */
const BEFORE_E = new Date("2026-03-15T12:00:00-05:00");
const TODAY = new Date("2026-10-21T12:00:00-05:00");

function stateFor(fixture: string, today: Date): QuickState {
  return fromFusion(parseFusionText(fixture, MO_2026_07), 0, today);
}

function sheetFor(state: QuickState, today = "2025-11-20") {
  return buildScheduleSheet(state, buildQuickModel(state, MO_2026_07), MO_2026_07, today);
}

describe("printed schedule: what it says", () => {
  it("B: the participant, the service, the plan, Fusion's units, the provider and the PA", () => {
    const sheet = sheetFor(stateFor(fixtureB, BEFORE_B));
    expect(sheet.name).toBe("SAMPLE PARTICIPANT B");
    expect(sheet.facts).toEqual([
      { label: "DCN", value: "10000002" },
      { label: "Service", value: "PC - CDS · T1019U2" },
      { label: "Plan", value: "Dec 1, 2025 to Oct 31, 2026" },
      { label: "Fusion units", value: "455 for a 30-day month" },
      { label: "Provider", value: "TEST HOME CARE LLC" },
      { label: "Prior authorization", value: "20250000000002" },
    ]);
    // B has CDS transportation, so CDS-04 (CP4-7) asks for a look at NEMT trips.
    expect(sheet.status).toEqual({
      title: "Ready to use",
      detail: "Follows every rule we check. 1 item is worth a look in Checks.",
      blocked: false,
    });
    expect(sheet.footer).toBe("Checked with CarePlan Scheduler under rule pack mo-2026-07 on Nov 20, 2025");
  });

  it("B: a row per task in care plan order, then transportation on its usual day", () => {
    const sheet = sheetFor(stateFor(fixtureB, BEFORE_B));
    expect(sheet.rows).toHaveLength(16);
    expect(sheet.rows[0]).toMatchObject({ name: "Assistance with Toileting", detail: "10 min · every day", transport: false, weekMinutes: 70 });
    expect(sheet.rows[0]!.cells.map((cell) => cell?.minutes ?? null)).toEqual([10, 10, 10, 10, 10, 10, 10]);
    const laundry = sheet.rows.find((row) => row.name === "Laundry (Off Site)")!;
    expect(laundry.detail).toBe("140 min · 1 day a week");
    expect(laundry.cells.filter((cell) => cell !== null)).toHaveLength(1);
    expect(sheet.rows[15]).toMatchObject({ name: "Essential transportation", detail: "Set aside, not a task", transport: true, weekMinutes: 60 });
    expect(sheet.rows[15]!.cells.map((cell) => cell?.minutes ?? null)).toEqual([60, null, null, null, null, null, null]);
  });

  it("B: Sunday to Saturday with each visit's length, minutes and units (APP-SPEC 5.4 daily task list)", () => {
    const sheet = sheetFor(stateFor(fixtureB, BEFORE_B));
    expect(sheet.days.map((day) => day.name)).toEqual(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
    // Sunday: 175 minutes of tasks and 60 of transportation.
    expect(sheet.days[0]).toEqual({ name: "Sunday", care: true, visit: "3 h 55 min", minutes: "235", units: "15 + 10 min" });
    expect(sheet.days[1]).toEqual({ name: "Monday", care: true, visit: "5 h 15 min", minutes: "315", units: "21" });
    expect(sheet.week).toEqual({ visit: "25 h 25 min", minutes: "1,525", units: "101 + 10 min" });
    expect(sheet.summary).toEqual([
      { label: "Task minutes a week", value: "1,465", note: "97 units + 10 min" },
      { label: "Care days", value: "7 a week", note: "Sunday to Saturday" },
      { label: "Essential transportation", value: "60 min on Sunday", note: "345 minutes a month (23 units), set aside before tasks" },
    ]);
  });

  it("B: every month's units, with Fusion's figure counted for each month's days", () => {
    const sheet = sheetFor(stateFor(fixtureB, BEFORE_B));
    expect(sheet.months).toHaveLength(11);
    // December 2025: 175 minutes of daily tasks x 31 days, the 1-day tasks on their weekdays (1,150
    // minutes) and 23 units of transportation: 6,920 minutes, so 115 of Fusion's 469 units are left.
    expect(sheet.months[0]).toEqual({ label: "Dec 2025", authorized: "469", scheduled: "461 + 5 min", left: "7 + 10 min", over: false, cut: "", cutFrom: "" });
    expect(sheet.months[2]).toMatchObject({ label: "Feb 2026", authorized: "434" });
    expect(sheet.authorizedNote).toBe("Authorized is Fusion's figure, counted for each month's days as Fusion does.");
    expect(sheet.cutNote).toBeNull();
    expect(sheet.checks.map((check) => [check.label, check.title])).toEqual([["Needs review", "Check CDS transportation against NEMT"]]);
  });

  it("B at 440 units: the months cut at the end, from which date, and what to do", () => {
    const sheet = sheetFor(stateFor(fixtureB.replaceAll("455 units", "440 units"), BEFORE_B));
    expect(sheet.months[0]).toMatchObject({ label: "Dec 2025", authorized: "440", cut: "320 min", cutFrom: "Dec 30" });
    expect(sheet.months[2]).toMatchObject({ label: "Feb 2026", cut: "", cutFrom: "" });
    expect(sheet.cutNote).toBe(
      "When a month's units run out, its last visits are shorter, starting on the date shown. If the units run out every " +
        "month, the care plan needs more than Fusion authorizes. DSDS says a consistent need to change a task should " +
        "prompt a request to the care plan change team (INFO 09-25-02).",
    );
  });

  it("E: days without care are shaded and have no visit", () => {
    const sheet = sheetFor(stateFor(fixtureE, BEFORE_E), "2026-03-15");
    expect(sheet.days[0]).toEqual({ name: "Sunday", care: false, visit: null, minutes: "", units: "" });
    expect(sheet.days[1]).toMatchObject({ name: "Monday", care: true, visit: "4 h 5 min" });
    expect(sheet.summary).toContainEqual({ label: "Care days", value: "3 a week", note: "Monday, Tuesday, Wednesday" });
    expect(sheet.rows.some((row) => row.transport)).toBe(false);
    expect(sheet.authorizedNote).toBe("Authorized is Fusion's figure for each month.");
  });

  it("a minute change is marked, and so are minutes above the task's own", () => {
    const state = stateFor(fixtureB, BEFORE_B);
    const sheet = sheetFor({ ...state, edits: { [`${state.tasks[1]!.id}:1`]: 30, [`${state.tasks[1]!.id}:2`]: 60 } });
    const bathing = sheet.rows.find((row) => row.name === "Bathing")!;
    expect(bathing.cells[1]).toEqual({ minutes: 30, changed: true, over: false });
    expect(bathing.cells[2]).toEqual({ minutes: 60, changed: true, over: true });
    expect(bathing.cells[3]).toEqual({ minutes: 45, changed: false, over: false });
  });

  it("Must fix, Needs review and Worth checking are printed with their task and months; Good to know isn't", () => {
    const state = stateFor(fixtureB, BEFORE_B);
    const model = buildQuickModel(state, MO_2026_07);
    const bathing = state.tasks.find((task) => task.name === "Bathing")!.id;
    const result = (ruleId: string, severity: ScheduleValidationResult["severity"], refs: ScheduleValidationResult["refs"]) => ({
      ruleId, severity, refs, message: `${ruleId} message`, rulePackVersion: MO_2026_07.id,
    });
    const results: ScheduleValidationResult[] = [
      result("AUTH-05", "INFO", {}),
      result("AUTH-03", "REVIEW", { taskId: bathing, month: "2025-12" }),
      result("SCH-08", "BLOCK", { taskId: bathing, month: "2026-01" }),
      result("SCH-08", "BLOCK", { taskId: bathing, month: "2026-02" }),
    ];
    const sheet = buildScheduleSheet(state, { ...model, results }, MO_2026_07, "2025-11-20");
    expect(sheet.checks).toEqual([
      { severity: "BLOCK", label: "Must fix", title: expect.any(String), context: "Bathing, 2 of 11 months" },
      { severity: "REVIEW", label: "Needs review", title: "Two state formulas give different units", context: "Bathing, December 2025" },
    ]);
    expect(sheet.status).toMatchObject({ title: "1 thing to fix", blocked: true });
  });

  it("a date reviewed with the participant is printed; without one there's a line to write it on", () => {
    const state = stateFor(fixtureB, BEFORE_B);
    expect(sheetFor(state).reviewed).toBeNull();
    expect(sheetFor({ ...state, reviewed: "2025-11-19" }).reviewed).toBe("Nov 19, 2025");
  });

  it("by hand: no name or DCN, so the printout has lines to write them on", () => {
    const sheet = sheetFor(manualState(TODAY), "2026-10-21");
    expect(sheet.name).toBeNull();
    expect(sheet.facts.map((fact) => fact.label)).toEqual(["Service", "Plan"]);
  });

  it("the example says it's the example and carries no DCN", () => {
    const sheet = sheetFor(exampleStateA(TODAY), "2026-10-21");
    expect(sheet.name).toBe("Example care plan");
    expect(sheet.facts.map((fact) => fact.label)).not.toContain("DCN");
  });
});
