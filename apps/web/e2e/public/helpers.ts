import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const FIXTURES_DIR = fileURLToPath(new URL("../../../../docs/fixtures/fusion/", import.meta.url));

export function fixtureText(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.txt`), "utf8");
}

export function fixturePdf(name: string): string {
  return join(FIXTURES_DIR, `${name}.pdf`);
}

/**
 * Paste into the care plan box the way a person does: focus it, insert the text, and fire the
 * browser's `insertFromPaste` input event, which Quick Schedule reads straight away (no button).
 */
export async function pasteCarePlan(page: Page, text: string): Promise<void> {
  await page.locator("#qs-paste").focus();
  await page.locator("#qs-paste").evaluate((node, value) => {
    const el = node as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: value }));
  }, text);
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
