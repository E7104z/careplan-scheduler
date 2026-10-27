import type { RulePack } from "@careplan/engine";
import type { QuickModel, QuickState } from "../types";
import type { WorksheetFields } from "./worksheetState";
import { buildWorksheet3aSheet, buildWorksheet3cSheet, type WorksheetSheet } from "./worksheetSheet";
import { formFor, worksheet3a, worksheet3c } from "./worksheetView";

export interface WorksheetSource {
  state: QuickState;
  model: QuickModel;
  pack: RulePack;
  fields: WorksheetFields;
}

/** The printout's text for the care plan's form (Phase 3, Prompt 6). */
export function worksheetSheetFor(source: WorksheetSource, today: string): WorksheetSheet {
  const { state, model, pack, fields } = source;
  return formFor(state.serviceCode) === "3a"
    ? buildWorksheet3aSheet(worksheet3a(state, fields, pack), state, fields, pack, today)
    : buildWorksheet3cSheet(worksheet3c(state, model, fields, pack), state, fields, pack, today);
}

/** The worksheet's PDF. pdf-lib, fontkit and the fonts load only now (APP-SPEC 10). */
export async function worksheetPdf(source: WorksheetSource, today: string): Promise<Blob> {
  const { worksheetPdfBlob } = await import("./worksheetPdf");
  return worksheetPdfBlob(worksheetSheetFor(source, today), new Date());
}
