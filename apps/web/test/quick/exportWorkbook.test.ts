// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { exampleStateA, manualState, reduce, type QuickAction } from "../../src/features/quick-schedule/state";
import type { QuickState } from "../../src/features/quick-schedule/types";
import {
  CHORE_BOXES, NURSE_BOXES, ROWS_3A, WORKBOOK_FILES, applyWrites, workbookWrites, type WorkbookWrites,
} from "../../src/features/quick-schedule/worksheet/exportWorkbook";
import { sheetPaths } from "../../src/features/quick-schedule/worksheet/workbookXml";
import type { WorksheetSource } from "../../src/features/quick-schedule/worksheet/worksheetPrintout";
import { emptyWorksheet, type WorksheetFields } from "../../src/features/quick-schedule/worksheet/worksheetState";
import { worksheet3a, worksheet3c } from "../../src/features/quick-schedule/worksheet/worksheetView";

const ROOT = join(import.meta.dirname, "../../../..");
const STATE = join(ROOT, "docs/fixtures/state");
const PUBLIC = join(import.meta.dirname, "../../public/state");
const TODAY = new Date("2026-10-21T12:00:00-05:00");
const PACK = MO_2026_07;

function byHand(...actions: QuickAction[]): QuickState {
  return actions.reduce((state, action) => reduce(state, action, PACK).state, manualState(TODAY));
}
const source = (state: QuickState, fields: WorksheetFields): WorksheetSource => ({ state, model: buildQuickModel(state, PACK), pack: PACK, fields });

/** Three plans covering every kind of input: the 3c's CDS and ILW tabs, and the 3a. */
function samples(): Record<string, WorksheetSource> {
  const a = exampleStateA(TODAY);
  const cds = { ...emptyWorksheet(a), providerPhone: "555-0100", emergencyName: "P-TEST-02", emergencyPhone: "555-0101", comments: "Reviewed with the participant & family; costs < $500?", ihs: true };
  cds.descriptions[a.tasks[0]!.id] = "Needs help in and out of the tub.";
  const ilwState = byHand({ type: "setService", code: "T1019U6" }, { type: "addTask", taskCode: "BATHING", name: "Bathing" }, { type: "addTask", taskCode: "MEDICATIONS", name: "Medications" });
  const ilw = { ...emptyWorksheet(ilwState), name: "P-TEST-01", ilwExtras: { fmsUnits: 1, caseManagementUnits: 0, smsUnits: 3, smeUnits: null, eaaUnits: 2 } };
  const agency = byHand({ type: "setService", code: "T1019" }, { type: "addTask", taskCode: "BATHING", name: "Bathing" }, { type: "addTask", taskCode: "CLEAN_KITCHEN", name: "Clean Kitchen" });
  const threeA = {
    ...emptyWorksheet(agency), personalCareRcfAlf: true, nurseRcfAlf: true, cdsBox: true, nurseVisits: 2, nurseTasks: ["GENERAL_HEALTH_EVALUATION" as const, "NAIL_CARE" as const],
    hdmUnitsPerDay: 2, hdmDaysPerWeek: 5, choreTasks: ["SHAMPOO_RUGS" as const], comments: "GHE in March and September.",
    lines: { ...emptyWorksheet(agency).lines, adultDayCare: { minPerDay: 360, daysPerWeek: 2 }, chore: { minPerDay: 60, daysPerWeek: 1 } },
  };
  return { cds: source(a, cds), ilw: source(ilwState, ilw), "3a": source(agency, threeA) };
}

/** Cells of a sheet's XML by reference, as written. */
function cells(xml: string): Map<string, string> {
  return new Map([...xml.matchAll(/<c r="([A-Z]+\d+)"(?=[ />])[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)].map((m) => [m[1]!, m[0]]));
}

/** The style indexes whose cells DSDS left unlocked (`<protection locked="0"/>`): its input cells. */
function unlockedStyles(styles: string): Set<number> {
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)![1]!;
  const list = [...xfs.matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map((m) => m[0]);
  return new Set(list.flatMap((xf, i) => (/<protection[^>]*locked="0"/.test(xf) ? [i] : [])));
}

function compare(writes: WorkbookWrites) {
  const original = new Uint8Array(readFileSync(join(STATE, writes.file)));
  const exported = unzipSync(applyWrites(original, writes));
  const before = unzipSync(original);
  return { before, exported, paths: sheetPaths(strFromU8(before["xl/workbook.xml"]!), strFromU8(before["xl/_rels/workbook.xml.rels"]!)) };
}

describe("WS-X08 export into DSDS's own workbook", () => {
  it("bundles DSDS's workbooks unchanged (their SHA-256 is the README's)", () => {
    const readme = readFileSync(join(STATE, "README.md"), "utf8");
    for (const file of Object.values(WORKBOOK_FILES)) {
      const sha = createHash("sha256").update(readFileSync(join(PUBLIC, file))).digest("hex");
      expect(readme).toContain(`| \`${file}\` |`);
      expect(readme).toContain(`\`${sha}\``);
    }
  });

  it.each(Object.keys(samples()))("%s: only the input cells written differ, each one unlocked by DSDS, and never a formula, staff name or date", (name) => {
    const writes = workbookWrites(samples()[name]!);
    const { before, exported, paths } = compare(writes);
    const unlocked = unlockedStyles(strFromU8(before["xl/styles.xml"]!));
    const sheetFiles = new Set(Object.keys(writes.cells).map((sheet) => paths[sheet]!));
    for (const [path, data] of Object.entries(before)) {
      const after = exported[path]!;
      expect(after, path).toBeDefined();
      if (sheetFiles.has(path)) continue;
      if (path === "xl/workbook.xml") {
        expect(strFromU8(after)).toBe(strFromU8(data).replace("<calcPr ", `<calcPr fullCalcOnLoad="1" `));
      } else if (!path.startsWith("xl/ctrlProps/")) {
        expect(Buffer.compare(Buffer.from(after), Buffer.from(data)), path).toBe(0);
      }
    }
    expect(Object.keys(exported).sort()).toEqual(Object.keys(before).sort());
    for (const [sheet, written] of Object.entries(writes.cells)) {
      const was = cells(strFromU8(before[paths[sheet]!]!));
      const now = cells(strFromU8(exported[paths[sheet]!]!));
      const changed = [...new Set([...was.keys(), ...now.keys()])].filter((ref) => was.get(ref) !== now.get(ref));
      // Every cell that changed is one the export meant to write (a write equal to what was there changes nothing).
      expect(changed.length).toBeGreaterThan(0);
      expect(changed.filter((ref) => !(ref in written))).toEqual([]);
      for (const ref of changed) {
        const style = Number(/ s="(\d+)"/.exec(was.get(ref) ?? "")?.[1] ?? -1);
        expect(was.get(ref) ?? "", `${ref} must not be a formula`).not.toMatch(/<f[ >]/);
        if (sheet !== "Sheet2") expect(unlocked.has(style), `${sheet}!${ref} is an input cell`).toBe(true);
      }
      for (const never of ["A100", "H100", "A106", "H106", "A128"]) expect(written[never]).toBeUndefined();
    }
  });

  it("writes the plan's numbers where DSDS's formulas read them", () => {
    const { cds, ilw } = samples();
    const writes = workbookWrites(cds!);
    const bathing = worksheet3c(cds!.state, cds!.model, cds!.fields, PACK).rows.find((row) => row.task?.taskCode === "BATHING")!;
    expect(writes.cells.CDS).toMatchObject({
      [`L${bathing.guidance.row}`]: bathing.task!.minPerDay, [`N${bathing.guidance.row}`]: bathing.task!.daysPerWeek,
      F88: 765, G9: 466, L8: "555-0100", K100: "P-TEST-02 555-0101", P9: "Oct 1, 2026",
    });
    expect(workbookWrites(ilw!).cells.ILW).toMatchObject({ O96: 1, O97: 0, O98: 3, O100: 2, A6: "P-TEST-01" });
    expect(workbookWrites(ilw!).cells.ILW!.O99).toBeUndefined();
  });

  it("puts every typed character in the file as typed, escaped", () => {
    const writes = workbookWrites(samples().cds!);
    const { exported, paths } = compare(writes);
    expect(strFromU8(exported[paths.CDS!]!)).toContain("Reviewed with the participant &amp; family; costs &lt; $500?");
  });

  it("finds the 3a's rows and boxes where DSDS's workbook has them", () => {
    const guidance = JSON.parse(readFileSync(join(STATE, "worksheet-guidance.json"), "utf8")) as {
      "3a": { services: { row: number; label: string }[]; checkboxes: { cell: string; label: string | null }[] };
    };
    expect(Object.values(ROWS_3A).sort((x, y) => x - y)).toEqual(guidance["3a"].services.map((s) => s.row).filter((r) => r !== 106).concat(106).sort((x, y) => x - y));
    const cellOf = ([column, row]: [number, number]) => `${String.fromCharCode(65 + column)}${row + 1}`;
    for (const [task, at] of [...Object.entries(NURSE_BOXES), ...Object.entries(CHORE_BOXES)]) {
      expect(guidance["3a"].checkboxes.find((box) => box.cell === cellOf(at)), task).toBeDefined();
    }
    const writes = workbookWrites(samples()["3a"]!);
    const { exported } = compare(writes);
    const checked = Object.entries(exported).filter(([path, data]) => path.startsWith("xl/ctrlProps/") && strFromU8(data).includes(`checked="Checked"`));
    expect(checked).toHaveLength(4); // the CDS box, two nurse tasks, one chore task
    expect(writes.cells.Sheet2).toEqual({ H9: true, H10: false, H11: true, L2: true });
    const view = worksheet3a(samples()["3a"]!.state, samples()["3a"]!.fields, PACK);
    expect(view.input.flags.medRelHousehold).toBe(true);
  });

  // Manual (scripts/state/verify-export.py): writes the samples and what the engine expects of them.
  it.runIf(Boolean(process.env.EXPORT_DIR))("writes sample exports for verify-export.py", () => {
    const dir = process.env.EXPORT_DIR!;
    const expected: Record<string, Record<string, number>> = {};
    for (const [name, sample] of Object.entries(samples())) {
      const writes = workbookWrites(sample);
      writeFileSync(join(dir, `${name}.xlsx`), applyWrites(new Uint8Array(readFileSync(join(STATE, writes.file))), writes));
      if (name === "3a") {
        const { result } = worksheet3a(sample.state, sample.fields, PACK);
        expected[name] = { N30: result.subtotals.personalCareUnits, N66: result.subtotals.homemakerUnits, N90: result.subtotals.apcUnits, O122: result.totalCostCents };
      } else {
        const { result } = worksheet3c(sample.state, sample.model, sample.fields, PACK);
        expected[name] = { L93: result.totalUnits, O93: result.costCents };
      }
    }
    writeFileSync(join(dir, "expected.json"), JSON.stringify(expected, null, 1));
  });
});
