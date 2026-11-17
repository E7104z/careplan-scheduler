import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { fixturePdf, openCarePlan } from "./helpers";

// APP-SPEC 5.9 in a real browser: save the plan as an encrypted file, then open it again.
// Nov 20, 2025: fixture B's plan (Dec 1, 2025 to Oct 31, 2026) is still to come.
const FIXED_TIME = new Date("2025-11-20T12:00:00-06:00");
const PASSPHRASE = "blue kitchen table by the window";
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(FIXED_TIME);
});

test("AC-31: a saved plan file holds nothing readable and opens again with its passphrase", async ({ page }) => {
  await page.goto("/quick");
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();

  await page.getByRole("button", { name: "Save plan" }).click();
  const save = page.getByRole("dialog", { name: "Save this care plan" });
  await expect(save).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);
  await save.getByLabel(/^Passphrase/).fill(PASSPHRASE);
  await save.getByLabel("Type the passphrase again").fill(PASSPHRASE);
  const [download] = await Promise.all([page.waitForEvent("download"), save.getByRole("button", { name: "Save plan file" }).click()]);
  expect(download.suggestedFilename()).toBe("Care plan 2025-11-20.careplan");
  const path = await download.path();
  const text = readFileSync(path, "utf8");
  expect(text).not.toMatch(/SAMPLE PARTICIPANT|10000002|Bathing/);
  await expect(save).toBeHidden();

  // A new tab has only the example; the saved file brings the plan back, name included.
  const fresh = await page.context().newPage();
  await fresh.clock.setFixedTime(FIXED_TIME);
  await fresh.goto("/quick");
  await expect(fresh.getByRole("heading", { name: "Example care plan" })).toBeVisible();
  await fresh.getByLabel("Saved plan file").setInputFiles(path);
  const open = fresh.getByRole("dialog", { name: "Open a saved plan" });
  await expect(open).toBeVisible();
  expect((await new AxeBuilder({ page: fresh }).withTags(TAGS).analyze()).violations).toEqual([]);
  await open.getByLabel("Passphrase").fill("not the passphrase at all");
  await open.getByRole("button", { name: "Open plan" }).click();
  await expect(open.getByRole("alert")).toHaveText("That passphrase doesn't open this file. Check it and try again.");
  await open.getByLabel("Passphrase").fill(PASSPHRASE);
  await open.getByRole("button", { name: "Open plan" }).click();
  await expect(fresh.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  await expect(fresh.getByRole("heading", { level: 1, name: "Quick Schedule" })).toBeFocused();
  // The tab's own copy still never holds the name or DCN (AC-15).
  const stored = await fresh.evaluate(() => JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toMatch(/SAMPLE PARTICIPANT|10000002/);
});
