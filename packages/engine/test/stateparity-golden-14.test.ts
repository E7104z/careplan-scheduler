import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calculate14, type Hcbs14Input, type Hcbs14Result } from "../src/index.js";

const STATE = fileURLToPath(new URL("../../../docs/fixtures/state/", import.meta.url));

interface GoldenWorkbook {
  perTask: { row: number; timesPerWeek_D: number; weeklyMinutes_L: number; units31d_M: number }[];
  dailyMinutes_E27_K27: number[];
  dailyUnits_E30_K30: number[];
  dailyRemainder_E31_K31: number[];
  weeklyUnits_L30: number;
  weeklyAccrual_L31: number;
  monthlyUnits_D37_O37: Record<string, number>;
  twelveMonthTotal_P37: number;
  baseline52wk_P38: number;
  exampleMonth: {
    weekdayCounts_D7_J7: number[];
    taskMonthMinutes_K8_K12: number[];
    monthMinutes_K28: number;
    monthUnits_K31: number;
    monthRemainder_K32: number;
  };
}

interface Golden {
  fixture: string;
  generatedBy: string;
  sources: Record<"14a" | "14b", { title: string; url: string; sha256: string; fileModified: string }>;
  inputs: { startDate: string; exampleMonth: string; tasks: { row: number; name: string; minutesByDay: Record<string, number> }[] };
  expected: Record<"14a" | "14b", GoldenWorkbook>;
  knownStateDefects: { workbook: string; cell: string; detail: string; effectInThisCase: string }[];
}

const golden = JSON.parse(readFileSync(`${STATE}hcbs14-case-01.golden.json`, "utf8")) as Golden;

const input: Hcbs14Input = {
  startDate: golden.inputs.startDate,
  exampleMonth: golden.inputs.exampleMonth,
  tasks: golden.inputs.tasks.map((task) => ({ row: task.row, name: task.name, minutesByDay: task.minutesByDay })),
};

const result: Hcbs14Result = calculate14(input);

/** The golden workbook in the engine's result shape (names filled from the inputs). */
function engineShape(workbook: GoldenWorkbook): Hcbs14Result {
  return {
    perTask: workbook.perTask.map((task, index) => ({
      row: task.row,
      name: golden.inputs.tasks[index]!.name,
      timesPerWeek: task.timesPerWeek_D,
      weeklyMinutes: task.weeklyMinutes_L,
      units31d: task.units31d_M,
    })),
    daily: {
      dailyMinutes: workbook.dailyMinutes_E27_K27,
      dailyUnits: workbook.dailyUnits_E30_K30,
      dailyRemainder: workbook.dailyRemainder_E31_K31,
      weeklyUnits: workbook.weeklyUnits_L30,
      weeklyAccrual: workbook.weeklyAccrual_L31,
    },
    monthlyUnits: workbook.monthlyUnits_D37_O37,
    twelveMonthTotal: workbook.twelveMonthTotal_P37,
    baseline52wk: workbook.baseline52wk_P38,
    exampleMonth: {
      weekdayCounts: workbook.exampleMonth.weekdayCounts_D7_J7,
      taskMonthMinutes: workbook.exampleMonth.taskMonthMinutes_K8_K12,
      monthMinutes: workbook.exampleMonth.monthMinutes_K28,
      monthUnits: workbook.exampleMonth.monthUnits_K31,
      monthRemainder: workbook.exampleMonth.monthRemainder_K32,
    },
  };
}

describe("HCBS 14a/14b golden fixture (hcbs14-case-01)", () => {
  it("commits the exact workbooks its source block cites (SHA-256)", () => {
    expect(createHash("sha256").update(readFileSync(`${STATE}4.00appendix14a.xlsx`)).digest("hex")).toBe(golden.sources["14a"].sha256);
    expect(createHash("sha256").update(readFileSync(`${STATE}4.00appendix14b.xlsx`)).digest("hex")).toBe(golden.sources["14b"].sha256);
  });

  it("reproduces the weekly schedule per task (D7, L, M7)", () => {
    expect(result.perTask).toEqual(engineShape(golden.expected["14b"]).perTask);
  });

  it("reproduces the daily and weekly remainder/accrual (E27:K31, L30:L31)", () => {
    expect(result.daily).toEqual(engineShape(golden.expected["14b"]).daily);
  });

  it("reproduces the 12-month projection, total, and 52-week baseline (D37:O37, P37, P38)", () => {
    expect(result.monthlyUnits).toEqual(golden.expected["14b"].monthlyUnits_D37_O37);
    expect(result.twelveMonthTotal).toBe(golden.expected["14b"].twelveMonthTotal_P37);
    expect(result.baseline52wk).toBe(golden.expected["14b"].baseline52wk_P38);
  });

  it("reproduces the correct Example Month (14b)", () => {
    expect(result.exampleMonth).toEqual(engineShape(golden.expected["14b"]).exampleMonth);
  });

  it("agrees with 14a everywhere except the documented H12 defect", () => {
    const correct = engineShape(golden.expected["14b"]);
    const defective = engineShape(golden.expected["14a"]);
    // Every field other than the Example Month is identical between the two workbooks.
    expect(defective.perTask).toEqual(correct.perTask);
    expect(defective.daily).toEqual(correct.daily);
    expect(defective.monthlyUnits).toEqual(correct.monthlyUnits);
    expect(defective.twelveMonthTotal).toBe(correct.twelveMonthTotal);
    expect(defective.baseline52wk).toBe(correct.baseline52wk);
    // 14a's Example Month drops task E's Thursday minutes (the hardcoded 0 in H12), so the month
    // total is 225 minutes / 15 units short. Everything else in the month agrees.
    expect(defective.exampleMonth.weekdayCounts).toEqual(correct.exampleMonth.weekdayCounts);
    expect(defective.exampleMonth.taskMonthMinutes).toEqual([420, 775, 340, 90, 0]);
    expect(correct.exampleMonth.taskMonthMinutes).toEqual([420, 775, 340, 90, 225]);
    expect(correct.exampleMonth.monthMinutes - defective.exampleMonth.monthMinutes).toBe(225);
    expect(correct.exampleMonth.monthUnits - defective.exampleMonth.monthUnits).toBe(15);
    expect(defective.exampleMonth.monthRemainder).toBe(correct.exampleMonth.monthRemainder);
    // The engine reproduces the correct workbook, not the defective one.
    expect(result.exampleMonth).toEqual(correct.exampleMonth);
    expect(golden.knownStateDefects).toHaveLength(1);
    expect(golden.knownStateDefects[0]).toMatchObject({ workbook: "14a", cell: "'Example Month'!H12" });
  });
});
