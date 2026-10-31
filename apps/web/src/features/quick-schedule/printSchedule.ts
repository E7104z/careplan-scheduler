import type { RulePack } from "@careplan/engine";
import { todayIso } from "../../lib/format";
import { planSheets } from "./planSheet";
import type { CarePlan, QuickModel } from "./types";

/**
 * The Windows app's File > Print sends this event to the page (apps/desktop). The page cancels it
 * when it prints the schedule itself; otherwise the app prints the page as it is.
 */
export const SHELL_PRINT_EVENT = "careplan:print";

/** A saved PDF's object URL is freed after this; its download started long before. */
const REVOKE_AFTER_MS = 60_000;

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

async function makePdf(source: ScheduleSource, today: string): Promise<Blob> {
  // pdf-lib, fontkit and the fonts load only when someone prints (APP-SPEC 10).
  const { schedulePdfBlob } = await import("./schedulePdf");
  return schedulePdfBlob(planSheets(source.plan, source.models, source.pack, today), new Date());
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

/**
 * APP-SPEC 5.4 "Print schedule": the one-page schedule opens in a new tab, in the browser's own PDF
 * viewer, ready to print. The tab opens before the PDF is made, while the click still counts as
 * the person's (popup blockers allow only that). The PDF downloads instead, with its name, where
 * the browser shows no PDFs (set to download them; in a tab it would arrive blank and unnamed) or
 * no tab can open (a blocked popup, or the Windows app, which opens no windows for the site).
 */
export async function printSchedulePdf(source: ScheduleSource): Promise<void> {
  const tab = navigator.pdfViewerEnabled === false ? null : window.open("", "_blank");
  if (tab) {
    tab.document.title = "Weekly care schedule";
    tab.document.body.textContent = "Making the schedule…";
  }
  const today = todayIso();
  let blob: Blob;
  try {
    blob = await makePdf(source, today);
  } catch (error) {
    tab?.close();
    throw error;
  }
  if (!tab) {
    download(blob, scheduleFileName(today));
    return;
  }
  // Closed while the PDF was being made: the person changed their mind.
  if (tab.closed) return;
  // Not revoked: the viewer in that tab reads it again to print or save, until this page closes.
  tab.location.replace(URL.createObjectURL(blob));
}
