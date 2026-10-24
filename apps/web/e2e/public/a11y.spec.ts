import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fixtureText, pasteCarePlan } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const FIXED_TIME = new Date("2026-10-21T12:00:00-05:00");

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(FIXED_TIME);
});

async function analyze(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations).toEqual([]);
}

/** Apply the theme before the page loads, the way the app reads it on startup. */
async function useTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.addInitScript((value) => localStorage.setItem("cps.theme", value), theme);
}

for (const theme of ["light", "dark"] as const) {
  test(`axe: landing in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto("/");
    await analyze(page);
  });

  test(`axe: rules in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto("/rules");
    await analyze(page);
  });

  test(`axe: quick example in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto("/quick");
    await analyze(page);
  });

  test(`axe: quick fixture D issue in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto("/quick");
    await pasteCarePlan(page, fixtureText("D-page1-only-incomplete"));
    await expect(page.getByText("This copy has 10 of the plan's 14 rows")).toBeVisible();
    await analyze(page);
  });

  test(`axe: quick fixture B built in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto("/quick");
    await pasteCarePlan(page, fixtureText("B-tabbed-7day-455"));
    await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
    await analyze(page);
  });
}

