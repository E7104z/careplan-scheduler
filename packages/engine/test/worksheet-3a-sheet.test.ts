import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHORE_TASK_LABELS, MO_2026_07, NURSE_TASK_LABELS } from "../src/index.js";

const STATE = fileURLToPath(new URL("../../../docs/fixtures/state/", import.meta.url));

interface Box { cell: string; linkedCell: string | null; label: string | null }
interface RateRow { row: number; service: string | null; note: string | null; rate: number | string; fill: string | null }
const guidance = JSON.parse(readFileSync(`${STATE}worksheet-guidance.json`, "utf8")) as {
  "3a": { edition: string; checkboxes: Box[]; rateSheet: { rows: RateRow[]; legend: { fill: string | null; meaning: string }[] } };
};
const MANUAL_3A = readFileSync(`${STATE}pages/manual-hcbs3a-in-home-services-worksheet.txt`, "utf8");
const sheet = MO_2026_07.worksheet3a!;
const boxes = guidance["3a"].checkboxes;
const rowOf = (cell: string): number => Number(cell.replace(/\D/g, ""));
const cents = (value: number | string): number[] => String(value).match(/\d+\.\d\d/g)!.map((amount) => Math.round(Number(amount) * 100));

describe("the 3a's 19 checkboxes", () => {
  it("WS-A26 the 8 nurse task boxes are the labels DSDS prints, linked to no cell", () => {
    const nurse = boxes.filter((box) => rowOf(box.cell) >= 92 && rowOf(box.cell) <= 95);
    expect(new Set(nurse.map((box) => box.label))).toEqual(new Set(Object.values(NURSE_TASK_LABELS)));
    expect(nurse.every((box) => box.linkedCell === null)).toBe(true);
  });

  it("WS-A25 the 6 chore task boxes are the labels DSDS prints, linked to no cell", () => {
    const chore = boxes.filter((box) => rowOf(box.cell) >= 114 && rowOf(box.cell) <= 118);
    expect(new Set(chore.map((box) => box.label))).toEqual(new Set(Object.values(CHORE_TASK_LABELS)));
    expect(chore.every((box) => box.linkedCell === null)).toBe(true);
  });

  it("WS-A01 only Personal Care, APC and Nurse Visits have an RCF/ALF box; with Medically Related they are the only boxes any formula reads", () => {
    expect(boxes).toHaveLength(19);
    expect(boxes.filter((box) => box.linkedCell).map((box) => [box.cell, box.linkedCell])).toEqual([
      ["D9", "Sheet2!H9"], ["D31", "Sheet2!L2"], ["D67", "Sheet2!H10"], ["D91", "Sheet2!H11"],
    ]);
    // The one other unlabeled box is the CDS box beside "CDS" in K5 (WS-H11); there is no Homemaker RCF/ALF box.
    expect(boxes.filter((box) => !box.label && !box.linkedCell).map((box) => box.cell)).toEqual(["K5"]);
  });
});

describe("the 3a's rate sheet (Sheet2)", () => {
  const rows = guidance["3a"].rateSheet.rows;
  const rate = (service: string): RateRow => rows.find((row) => row.service === service)!;

  it("names each rate the rule pack uses", () => {
    expect(cents(rate("Basic Respite").rate)).toEqual([sheet.rates.respiteBasic]);
    expect(cents(rate("Advanced").rate)).toEqual([sheet.rates.respiteAdvanced]);
    expect(cents(rate("Personal Care").rate)).toEqual([sheet.rates.personalCareRcfAlf, sheet.rates.personalCare]);
    expect(cents(rate("APC").rate)).toEqual([sheet.rates.apcRcfAlf, sheet.rates.apc]);
    expect(cents(rate("RN").rate)).toEqual([sheet.rates.nurseVisitRcfAlf, sheet.rates.nurseVisit]);
    expect(cents(rate("ADC").rate)).toEqual([sheet.rates.adultDayCare]);
    expect(cents(rate("HC/Chore").rate)).toEqual([sheet.rates.homemakerChore]);
    expect(cents(rate("DM").rate)).toEqual([sheet.rates.homeDeliveredMeals]);
  });

  it("prints \"Max 2/day\" beside the meals rate, the rule pack's WS-R09 limit", () => {
    expect(rate("DM").note).toBe(`Max ${sheet.hdmMaxUnitsPerDayNote}/day`);
  });

  it("colours the block respite and nurse respite rates as \"retired\" in its own legend; the rule pack has none of them", () => {
    const retired = guidance["3a"].rateSheet.legend.find((entry) => entry.meaning === "retired")!.fill;
    const retiredRows = rows.filter((row) => row.fill === retired);
    expect(retiredRows.map((row) => row.row)).toEqual([4, 6, 7, 8]);
    const used = new Set(Object.values(sheet.rates));
    expect(retiredRows.flatMap((row) => cents(row.rate)).filter((amount) => used.has(amount))).toEqual([]);
  });
});

describe("limits the 3a's manual page states (W-1)", () => {
  it("Advanced Personal Care with one task: 15-minute increments", () => {
    expect(MANUAL_3A).toContain(`When entering only one task, the task needs to be in ${sheet.apcSingleTaskStep}-minute increments.`);
  });

  it("Adult Day Care: multiples of 15, at most 10 hours a day and 5 days a week", () => {
    const { minuteStep, maxMinutesPerDay, maxDaysPerWeek } = sheet.adultDayCare;
    expect(MANUAL_3A).toContain(`A number in multiples of ${minuteStep}, which cannot exceed ${maxMinutesPerDay / 60} hours per day. The maximum number of days per week cannot exceed five (${maxDaysPerWeek}).`);
  });
});
