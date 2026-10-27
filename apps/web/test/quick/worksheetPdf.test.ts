// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { MO_2026_07 } from "@careplan/engine";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import type { FontFiles } from "../../src/features/quick-schedule/schedulePdf";
import { exampleStateA, manualState, reduce, type QuickAction } from "../../src/features/quick-schedule/state";
import type { QuickState } from "../../src/features/quick-schedule/types";
import { PAGE_HEIGHT, PAGE_WIDTH, renderWorksheetPdf } from "../../src/features/quick-schedule/worksheet/worksheetPdf";
import { worksheetSheetFor } from "../../src/features/quick-schedule/worksheet/worksheetPrintout";
import { emptyWorksheet, type WorksheetFields } from "../../src/features/quick-schedule/worksheet/worksheetState";

const require = createRequire(import.meta.url);
const font = (weight: number) =>
  new Uint8Array(readFileSync(require.resolve(`@fontsource/public-sans/files/public-sans-latin-${weight}-normal.woff`)));
const FONTS: FontFiles = { regular: font(400), semibold: font(600), bold: font(700) };
const TODAY = new Date("2026-10-21T12:00:00-05:00");
const PACK = MO_2026_07;

interface Placed { page: number; text: string; left: number; top: number }

/** Opens the PDF with pdf.js, as a browser's viewer does, and reads every page's text and where it is. */
async function readBack(bytes: Uint8Array) {
  const pdf = await getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const items: Placed[] = [];
  let size: number[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    size = page.view;
    for (const item of (await page.getTextContent()).items as TextItem[]) {
      if (item.str.trim()) items.push({ page: n, text: item.str, left: item.transform[4]!, top: PAGE_HEIGHT - item.transform[5]! });
    }
  }
  const { info } = await pdf.getMetadata();
  return { pages: pdf.numPages, size, items, text: items.map((item) => item.text).join(" | "), title: (info as Record<string, unknown>).Title };
}

async function printout(state: QuickState, fields: WorksheetFields) {
  const sheet = worksheetSheetFor({ state, model: buildQuickModel(state, PACK), pack: PACK, fields }, "2026-10-21");
  return readBack(await renderWorksheetPdf(sheet, FONTS, TODAY));
}

describe("WS-A21 and WS-H10: the worksheet printout (3c)", () => {
  it("has the form's columns, total, edition, the not-official line and a blank signature line", async () => {
    const state = exampleStateA(TODAY);
    const read = await printout(state, emptyWorksheet(state));
    expect(read.size).toEqual([0, 0, PAGE_WIDTH, PAGE_HEIGHT]);
    expect(read.pages).toBe(1);
    for (const column of ["Task", "Suggested time", "Suggested frequency", "Min/Day", "Units/Day", "Days/Wk", "Max Days/Mo", "Units/Wk", "Total Units"]) {
      expect(read.items.map((item) => item.text)).toContain(column);
    }
    expect(read.text).toContain("Total units a month: 466");
    expect(read.text).toContain("Follows DSDS-HCBS-3c (10/26). Not an official DSDS form.");
    expect(read.text).toContain("Prepared with CarePlan Scheduler on Oct 21, 2026. Not an official DSDS form.");
    expect(read.text).toContain("Rule pack mo-2026-07 · Follows DSDS-HCBS-3c (10/26)");
    expect(read.title).toBe("Worksheet");
    // W-3: the line above "Signature and date" is left for a hand signature; nothing is printed on it.
    const label = read.items.find((item) => item.text === "Signature and date: for the person completing the form")!;
    expect(label).toBeDefined();
    expect(read.items.filter((item) => item !== label && item.top < label.top && item.top > label.top - 22)).toEqual([]);
  });

  it("prints the people fields only when they were typed (W-4)", async () => {
    const state = exampleStateA(TODAY);
    const blank = { ...emptyWorksheet(state), name: "", dcn: "" };
    expect((await printout(state, blank)).text).not.toContain("Participant name");
    const typed = { ...blank, name: "P-TEST-01", providerPhone: "555-0100", emergencyName: "P-TEST-02" };
    const read = await printout(state, typed);
    expect(read.text).toContain("P-TEST-01");
    expect(read.text).toContain("555-0100");
    expect(read.text).toContain("P-TEST-02");
    expect(read.text).not.toContain("Emergency contact phone");
  });
});

describe("WS-A21 and WS-M05: the 3a printout", () => {
  function byHand(...actions: QuickAction[]): QuickState {
    return actions.reduce((state, action) => reduce(state, action, PACK).state, manualState(TODAY));
  }

  it("prints its three sections, the other lines, the total cost and the DSDS staff line, with the edition on every page", async () => {
    const state = byHand({ type: "setService", code: "T1019" }, { type: "addTask", taskCode: "BATHING", name: "Bathing" }, { type: "addTask", taskCode: "CLEAN_KITCHEN", name: "Clean Kitchen" });
    const fields = { ...emptyWorksheet(state), nurseVisits: 2, nurseTasks: ["GENERAL_HEALTH_EVALUATION" as const], comments: "General Health Evaluation in March and September." };
    const read = await printout(state, fields);
    for (const title of ["Personal care", "Homemaker · Medically related household tasks", "Advanced personal care", "Authorized nurse visits", "Total"]) {
      expect(read.items.map((item) => item.text)).toContain(title);
    }
    expect(read.text).toContain("Clean kitchen");
    expect(read.text).toContain("Under Personal Care");
    expect(read.text).toContain("Visits a month: 2 · $121.98");
    expect(read.text).toContain("DSDS staff signature and date");
    // WS-M05: the manual's note about copies and the case record prints with the 3a.
    expect(read.text.replaceAll(" | ", " ")).toContain("upload the 3a to the electronic case record only when it is used for an ILW authorization");
    expect(read.text).toMatch(/Total cost: \$[\d,]+\.\d\d \(Estimated at the rates on DSDS's rate sheet\)/);
    const footers = read.items.filter((item) => item.text === "Rule pack mo-2026-07 · Follows DSDS-HCBS-3a (07/26)");
    expect(footers.map((item) => item.page)).toEqual(Array.from({ length: read.pages }, (_, i) => i + 1));
    expect(read.pages).toBeLessThanOrEqual(2);
  });
});
