import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { textPdf } from "./textPdf";

const FIXTURES_DIR = fileURLToPath(new URL("../../../../docs/fixtures/fusion/", import.meta.url));

export function fixtureText(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.txt`), "utf8");
}

export function fixturePdf(name: string): string {
  return join(FIXTURES_DIR, `${name}.pdf`);
}

/** The PDF chooser's file input (APP-SPEC 5.1): the one way a care plan comes in. */
export const PDF_CHOOSER = "#qs-pdf";

/** Open a care plan the way a person does: choose its PDF. */
export async function openCarePlan(page: Page, pdfPath: string): Promise<void> {
  await page.locator(PDF_CHOOSER).setInputFiles(pdfPath);
}

/**
 * Open a PDF that reads as `text`, for a scenario no fixture PDF gives (an incomplete plan, a
 * plan in two PDFs, a PDF with no care plan in it). `textPdf.test.ts` proves the round trip.
 */
export async function openCarePlanText(page: Page, text: string, name = "care-plan.pdf"): Promise<void> {
  const buffer = Buffer.from(await textPdf(text));
  await page.locator(PDF_CHOOSER).setInputFiles({ name, mimeType: "application/pdf", buffer });
}

/** Click a weekly-grid cell and commit a new minute value (Enter). */
export async function changeCell(page: Page, task: string, weekday: string, current: number, value: number): Promise<void> {
  await page
    .getByRole("button", { name: `${task}, ${weekday}, ${current} minutes. Change minutes` })
    .click();
  const input = page.getByRole("spinbutton", {
    name: `${task}, ${weekday}, ${current} minutes. Enter 0 to remove this day.`,
  });
  await input.fill(String(value));
  await input.press("Enter");
}

export function statusPanel(page: Page) {
  return page.getByRole("status", { name: "Schedule status" });
}
