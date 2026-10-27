import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import type { ChoreTask, NurseTask } from "@careplan/engine";
import { niceDate } from "../../../lib/format";
import { checkboxAt, fullCalcOnLoad, setCell, setChecked, sheetPaths, type CellValue } from "./workbookXml";
import type { WorksheetSource } from "./worksheetPrintout";
import { formFor, worksheet3a, worksheet3c } from "./worksheetView";

/** DSDS's two workbooks, bundled unchanged in `public/state/` (their SHA-256 is tested). */
export const WORKBOOK_FILES = { "3c": "4.00appendix4da-3cform.xlsx", "3a": "4.00appendix3da3aform.xlsx" } as const;

/** One checkbox to set: its top-left cell (0-based column and row) on a sheet. */
export interface BoxWrite { sheet: string; column: number; row: number; checked: boolean }

/** Every input the export writes: cells by sheet name, and checkboxes. Nothing else is touched. */
export interface WorkbookWrites {
  file: (typeof WORKBOOK_FILES)[keyof typeof WORKBOOK_FILES];
  cells: Record<string, Record<string, CellValue>>;
  boxes: BoxWrite[];
}

// The 3a's one-row lines and blocks, by sheet row (worksheet-guidance.json `3a.services`; tested).
export const ROWS_3A = { nurse: 96, respiteBasic: 100, respiteAdvanced: 103, hdm: 106, adultDayCare: 109, adultDayCareWaiver: 112, chore: 119 } as const;
// The 3a's nurse and chore boxes by their top-left cell (worksheet-guidance.json `3a.checkboxes`; tested).
export const NURSE_BOXES: Record<NurseTask, [number, number]> = {
  FILL_INSULIN_SYRINGES: [0, 91], MONITOR_SKIN_COND: [2, 91], MED_SETUP: [5, 91], EVAL_APC_PLAN: [0, 92],
  TRAIN_APC: [2, 92], NAIL_CARE: [5, 92], OTHER: [0, 93], GENERAL_HEALTH_EVALUATION: [2, 93],
};
export const CHORE_BOXES: Record<ChoreTask, [number, number]> = {
  CLEAN_CLOSETS_BASEMENT_ATTICS: [0, 114], AIR_MATTRESSES_BEDDING: [4, 114], RODENT_CONTROL: [0, 115],
  WASH_WALLS_AND_WOODWORK: [4, 115], SPRAY_FOR_INSECTS: [0, 116], SHAMPOO_RUGS: [4, 116],
};

/** Adds the text cells that were typed; blank fields stay blank on DSDS's form. */
function text(cells: Record<string, CellValue>, ref: string, value: string): void {
  if (value.trim()) cells[ref] = value.trim();
}

function emergency(fields: WorksheetSource["fields"]): string {
  return [fields.emergencyName.trim(), fields.emergencyPhone.trim()].filter(Boolean).join(" ");
}

/**
 * The cells and boxes to fill in DSDS's own workbook (Phase 3, Prompt 8): the header, each task's
 * Min/Day and Days/Wk, transportation, the ILW lines, descriptions, comments and the emergency contact.
 * Never a formula cell, never the staff name or date (W-3).
 */
export function workbookWrites(source: WorksheetSource): WorkbookWrites {
  const { state, model, pack, fields } = source;
  const form = formFor(state.serviceCode);
  if (form === "3a") {
    const view = worksheet3a(state, fields, pack);
    const cells: Record<string, CellValue> = {};
    text(cells, "A6", fields.name); text(cells, "G6", fields.dcn); text(cells, "A8", fields.providerName); text(cells, "K8", fields.providerPhone);
    for (const row of view.sections.flatMap((section) => section.rows)) {
      if (!row.task) continue;
      const r = row.guidance.row;
      if (row.task.minPerDay !== null) cells[`G${r}`] = row.task.minPerDay;
      cells[`J${r}`] = row.task.daysPerWeek;
      text(cells, `D${r + 1}`, fields.descriptions[row.task.id] ?? "");
    }
    for (const input of view.input.rows.filter((row) => row.taskCode === undefined)) {
      const r = ROWS_3A[input.section as keyof typeof ROWS_3A];
      if (input.minPerDay !== null) cells[`G${r}`] = input.minPerDay;
      if (input.daysPerWeek !== null) cells[`J${r}`] = input.daysPerWeek;
      text(cells, `D${r + 1}`, input.description ?? "");
    }
    if (fields.hdmUnitsPerDay !== null) cells[`I${ROWS_3A.hdm}`] = fields.hdmUnitsPerDay;
    if (fields.hdmDaysPerWeek !== null) cells[`J${ROWS_3A.hdm}`] = fields.hdmDaysPerWeek;
    text(cells, `D${ROWS_3A.hdm + 1}`, fields.descriptions.hdm ?? "");
    if (fields.nurseVisits !== null) cells[`N${ROWS_3A.nurse}`] = fields.nurseVisits;
    text(cells, "C123", fields.comments);
    text(cells, "G128", emergency(fields));
    // The four boxes the formulas read are linked to these cells on the rate sheet (Sheet2).
    const flags = view.input.flags;
    const sheet2 = { H9: flags.personalCareRcfAlf, H10: flags.apcRcfAlf, H11: flags.nurseRcfAlf, L2: flags.medRelHousehold };
    const boxes: BoxWrite[] = [
      { sheet: "HCBS-3a", column: 10, row: 4, checked: fields.cdsBox },
      ...(Object.keys(NURSE_BOXES) as NurseTask[]).map((task) => ({ sheet: "HCBS-3a", column: NURSE_BOXES[task][0], row: NURSE_BOXES[task][1], checked: fields.nurseTasks.includes(task) })),
      ...(Object.keys(CHORE_BOXES) as ChoreTask[]).map((task) => ({ sheet: "HCBS-3a", column: CHORE_BOXES[task][0], row: CHORE_BOXES[task][1], checked: fields.choreTasks.includes(task) })),
    ];
    return { file: WORKBOOK_FILES["3a"], cells: { "HCBS-3a": cells, Sheet2: sheet2 }, boxes };
  }

  const view = worksheet3c(state, model, fields, pack);
  const ilw = view.form === "3c-ilw";
  const cells: Record<string, CellValue> = {};
  text(cells, "A6", fields.name); text(cells, "I6", fields.dcn); text(cells, "A8", fields.providerName); text(cells, "L8", fields.providerPhone);
  cells.P9 = niceDate(state.plan.start);
  // "Once units are calculated, enter the monthly units after the type of assistance" (4.00 Appendix 4).
  cells[ilw ? "J9" : "G9"] = view.result.totalUnits;
  for (const row of view.rows) {
    if (!row.task || row.guidance.taskCode === "ESSENTIAL_TRANSPORTATION") continue;
    const r = row.guidance.row;
    if (row.task.minPerDay !== null) cells[`L${r}`] = row.task.minPerDay;
    cells[`N${r}`] = row.task.daysPerWeek;
    text(cells, `D${r + 1}`, fields.descriptions[row.task.id] ?? "");
  }
  if (view.input.transportMinutesPerMonth !== null) cells.F88 = view.input.transportMinutesPerMonth;
  if (ilw) {
    const extras = fields.ilwExtras;
    const units: [string, number | null][] = [["O96", extras.fmsUnits], ["O97", extras.caseManagementUnits], ["O98", extras.smsUnits], ["O99", extras.smeUnits], ["O100", extras.eaaUnits]];
    for (const [ref, value] of units) if (value !== null) cells[ref] = value;
  }
  text(cells, ilw ? "C101" : "C95", fields.comments);
  text(cells, ilw ? "K106" : "K100", emergency(fields));
  const sheet = ilw ? "ILW" : "CDS";
  return {
    file: WORKBOOK_FILES["3c"],
    cells: { [sheet]: cells },
    boxes: [
      { sheet, column: 11, row: 4, checked: fields.ihs },
      { sheet, column: 5, row: 8, checked: !ilw },
      { sheet, column: 8, row: 8, checked: ilw },
    ],
  };
}

/** DSDS's workbook with the writes applied, Excel told to recalculate on open, re-zipped. */
export function applyWrites(original: Uint8Array, writes: WorkbookWrites): Uint8Array {
  const files = unzipSync(original);
  const read = (path: string): string => {
    const file = files[path];
    if (!file) throw new Error(`${writes.file} has no ${path}`);
    return strFromU8(file);
  };
  const paths = sheetPaths(read("xl/workbook.xml"), read("xl/_rels/workbook.xml.rels"));
  for (const [sheet, cells] of Object.entries(writes.cells)) {
    const path = paths[sheet];
    if (!path) throw new Error(`${writes.file} has no sheet ${sheet}`);
    let xml = read(path);
    for (const [ref, value] of Object.entries(cells)) xml = setCell(xml, ref, value);
    files[path] = strToU8(xml);
  }
  for (const box of writes.boxes) {
    const path = paths[box.sheet]!;
    const rels = path.replace(/worksheets\/(sheet\d+\.xml)$/, "worksheets/_rels/$1.rels");
    const ctrl = checkboxAt(read(path), read(rels), box.column, box.row);
    if (!ctrl) throw new Error(`${writes.file} has no checkbox at column ${box.column}, row ${box.row} on ${box.sheet}`);
    files[ctrl] = strToU8(setChecked(read(ctrl), box.checked));
  }
  files["xl/workbook.xml"] = strToU8(fullCalcOnLoad(read("xl/workbook.xml")));
  const zippable: Zippable = {};
  for (const [path, data] of Object.entries(files)) zippable[path] = [data, { level: 6 }];
  return zipSync(zippable);
}

/** "DSDS HCBS-3c worksheet 2026-10-27.xlsx": the form and the date only (IMP-16). */
export function workbookFileName(form: "3c" | "3a", today: string): string {
  return `DSDS HCBS-${form} worksheet ${today}.xlsx`;
}

/** Fetches DSDS's workbook from this site and fills it: the file behind "Download as DSDS's worksheet". */
export async function exportWorkbookFile(source: WorksheetSource, today: string): Promise<{ blob: Blob; fileName: string }> {
  const writes = workbookWrites(source);
  const response = await fetch(`/state/${writes.file}`);
  if (!response.ok) throw new Error(`Workbook request failed with ${response.status}`);
  const bytes = applyWrites(new Uint8Array(await response.arrayBuffer()), writes);
  return {
    blob: new Blob([bytes.slice()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    fileName: workbookFileName(writes.file === WORKBOOK_FILES["3c"] ? "3c" : "3a", today),
  };
}

