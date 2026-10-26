import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fixtureText, pasteCarePlan } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
// Nov 20, 2025: every fixture's plan is current or still to come (B starts Dec 1, 2025; D runs
// Sep 2025 to Jun 2026). A schedule covers only months still to come (APP-SPEC 5.3 step 5).
const FIXED_TIME = new Date("2025-11-20T12:00:00-06:00");

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

// AC-18's public pages and the other public pages (APP-SPEC 4.4: every page). Each waits for its
// h1, since the pages are lazy chunks and axe would otherwise check the empty shell.
const PAGES = [
  { name: "landing", path: "/", heading: "Paste a Fusion care plan. Get a schedule that follows Missouri's rules." },
  { name: "rules", path: "/rules", heading: "Rules and sources" },
  { name: "privacy", path: "/privacy", heading: "Privacy" },
  { name: "sign in", path: "/sign-in", heading: "Sign in" },
  { name: "sign up", path: "/sign-up", heading: "Create account" },
  { name: "reset password", path: "/reset-password", heading: "Reset your password" },
  { name: "not found", path: "/no-such-page", heading: "We can't find that page" },
];

for (const theme of ["light", "dark"] as const) {
  for (const { name, path, heading } of PAGES) {
    test(`axe: ${name} in ${theme}`, async ({ page }) => {
      await useTheme(page, theme);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await analyze(page);
    });
  }

  test(`axe: quick example in ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto("/quick");
    await expect(page.getByRole("heading", { name: "Example care plan" })).toBeVisible();
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

    // With "Review what we read" open.
    await page.getByRole("button", { name: "Review what we read" }).click();
    await expect(page.getByRole("table", { name: "What we read from Fusion" })).toBeVisible();
    await analyze(page);
  });
}

