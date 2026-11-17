import type { RulePack } from "@careplan/engine";
import { downloadBlob as download } from "../../lib/download";
import { todayIso } from "../../lib/format";
import type { CarePlan, QuickModel } from "./types";

/**
 * The Windows app's File > Print sends this event to the page (apps/desktop). The page cancels it
 * when it prints the schedule itself; otherwise the app prints the page as it is.
 */
export const SHELL_PRINT_EVENT = "careplan:print";

export interface ScheduleSource {
  plan: CarePlan;
  /** One per service, in the plan's order. */
  models: QuickModel[];
  pack: RulePack;
}

/** "Care schedule 2026-10-26.pdf": the date only. The name and DCN stay inside the PDF (IMP-16). */
export function scheduleFileName(today: string): string {
  return `Care schedule ${today}.pdf`;
}

/** "Care schedule 2026-10-26 agency.pdf": the agency printout with the accrual sections. */
export function agencyScheduleFileName(today: string): string {
  return `Care schedule ${today} agency.pdf`;
}

/** Who the printout is for: the participant's copy, or the agency's with the accrual pages (ACC-06). */
export interface PrintOptions {
  agency?: boolean;
}

async function makePdf(source: ScheduleSource, today: string, options: PrintOptions): Promise<Blob> {
  // The sheet builders, pdf-lib, fontkit and the fonts load only when someone prints (APP-SPEC 10).
  const [{ planSheets }, { schedulePdfBlob }] = await Promise.all([import("./planSheet"), import("./schedulePdf")]);
  const audience = options.agency ? "agency" : "client";
  return schedulePdfBlob(planSheets(source.plan, source.models, source.pack, today, audience), new Date());
}

function fileNameFor(today: string, options: PrintOptions): string {
  return options.agency ? agencyScheduleFileName(today) : scheduleFileName(today);
}

/** APP-SPEC 5.4 "Save as PDF": the schedule downloads as a file (the agency copy adds the accrual pages). */
export async function saveSchedulePdf(source: ScheduleSource, options: PrintOptions = {}): Promise<void> {
  const today = todayIso();
  download(await makePdf(source, today, options), fileNameFor(today, options));
}

/**
 * APP-SPEC 5.4 "Print schedule": the one-page schedule opens in a new tab, in the browser's own PDF
 * viewer, ready to print. The tab opens before the PDF is made, while the click still counts as
 * the person's (popup blockers allow only that). The PDF downloads instead, with its name, where
 * the browser shows no PDFs (set to download them; in a tab it would arrive blank and unnamed) or
 * no tab can open (a blocked popup, or the Windows app, which opens no windows for the site).
 */
async function openForPrint(make: () => Promise<Blob>, fileName: string): Promise<void> {
  const tab = navigator.pdfViewerEnabled === false ? null : window.open("", "_blank");
  if (tab) {
    tab.document.title = "Weekly care schedule";
    tab.document.body.textContent = "Making the schedule…";
  }
  let blob: Blob;
  try {
    blob = await make();
  } catch (error) {
    tab?.close();
    throw error;
  }
  if (!tab) {
    download(blob, fileName);
    return;
  }
  // Closed while the PDF was being made: the person changed their mind.
  if (tab.closed) return;
  // Not revoked: the viewer in that tab reads it again to print or save, until this page closes.
  tab.location.replace(URL.createObjectURL(blob));
}

/** APP-SPEC 5.4 "Print schedule" (the agency copy adds each service's accrual pages). */
export async function printSchedulePdf(source: ScheduleSource, options: PrintOptions = {}): Promise<void> {
  const today = todayIso();
  await openForPrint(() => makePdf(source, today, options), fileNameFor(today, options));
}
