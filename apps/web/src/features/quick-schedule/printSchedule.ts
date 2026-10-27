import type { RulePack } from "@careplan/engine";
import { todayIso } from "../../lib/format";
import { buildScheduleSheet } from "./scheduleSheet";
import type { QuickModel, QuickState } from "./types";

/**
 * The Windows app's File > Print sends this event to the page (apps/desktop). The page cancels it
 * when it prints the schedule itself; otherwise the app prints the page as it is.
 */
export const SHELL_PRINT_EVENT = "careplan:print";

/** A saved PDF's object URL is freed after this; its download started long before. */
const REVOKE_AFTER_MS = 60_000;

export interface ScheduleSource {
  state: QuickState;
  model: QuickModel;
  pack: RulePack;
}

/** "Care schedule 2026-10-26.pdf": the date only. The name and DCN stay inside the PDF (IMP-16). */
export function scheduleFileName(today: string): string {
  return `Care schedule ${today}.pdf`;
}

/** "Worksheet 2026-10-27.pdf": the date only, like the schedule's (Phase 3, Prompt 6). */
export function worksheetFileName(today: string): string {
  return `Worksheet ${today}.pdf`;
}

async function makePdf(source: ScheduleSource, today: string): Promise<Blob> {
  // pdf-lib, fontkit and the fonts load only when someone prints (APP-SPEC 10).
  const { schedulePdfBlob } = await import("./schedulePdf");
  return schedulePdfBlob(buildScheduleSheet(source.state, source.model, source.pack, today), new Date());
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

/** APP-SPEC 5.4 "Save as PDF": the one-page schedule downloads as a file. */
export async function saveSchedulePdf(source: ScheduleSource): Promise<void> {
  const today = todayIso();
  download(await makePdf(source, today), scheduleFileName(today));
}

/** A printout to make: its tab's title and waiting text, its file name, and how to make it. */
export interface Printout {
  title: string;
  waiting: string;
  fileName: string;
  make: () => Promise<Blob>;
}

/** Downloads a file whose bytes and name come from code loaded only now (DSDS's workbook, Prompt 8). */
export async function saveDownload(make: () => Promise<{ blob: Blob; fileName: string }>): Promise<void> {
  const { blob, fileName } = await make();
  download(blob, fileName);
}

/** Downloads a printout as a file (the "Save … as PDF" buttons). */
export async function savePrintout(printout: Printout): Promise<void> {
  download(await printout.make(), printout.fileName);
}

/**
 * Opens a printout in a new tab, in the browser's own PDF viewer, ready to print. The tab opens
 * before the PDF is made, while the click still counts as the person's (popup blockers allow only
 * that). The PDF downloads instead, with its name, where the browser shows no PDFs (set to download
 * them; in a tab it would arrive blank and unnamed) or no tab can open (a blocked popup, or the
 * Windows app, which opens no windows for the site).
 */
export async function openPrintout(printout: Printout): Promise<void> {
  const tab = navigator.pdfViewerEnabled === false ? null : window.open("", "_blank");
  if (tab) {
    tab.document.title = printout.title;
    tab.document.body.textContent = printout.waiting;
  }
  let blob: Blob;
  try {
    blob = await printout.make();
  } catch (error) {
    tab?.close();
    throw error;
  }
  if (!tab) {
    download(blob, printout.fileName);
    return;
  }
  // Closed while the PDF was being made: the person changed their mind.
  if (tab.closed) return;
  // Not revoked: the viewer in that tab reads it again to print or save, until this page closes.
  tab.location.replace(URL.createObjectURL(blob));
}

/** APP-SPEC 5.4 "Print schedule": the one-page schedule, opened ready to print (see `openPrintout`). */
export async function printSchedulePdf(source: ScheduleSource): Promise<void> {
  const today = todayIso();
  await openPrintout({
    title: "Weekly care schedule",
    waiting: "Making the schedule…",
    fileName: scheduleFileName(today),
    make: () => makePdf(source, today),
  });
}
