import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectNoPageScroll, expectTouchTargets } from "../layout-checks";
import { fixtureText, openCarePlanText } from "./helpers";

// Coverage Phase 3: dated events on the participant's care plan. Apr 15, 2026 is inside fixture
// F's plan (Feb 1 to Oct 31, 2026) and before its May and August evaluations.
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-04-15T12:00:00-05:00"));
});

async function analyze(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations).toEqual([]);
}

async function openF(page: Page): Promise<void> {
  await page.goto("/quick");
  await openCarePlanText(page, fixtureText("F-care-plan-report-multi"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT F" })).toBeVisible();
}

function visitsPanel(page: Page) {
  return page.locator("section", { has: page.getByRole("heading", { name: "Nurse visits" }) });
}

test("RN-01 to RN-04: fixture F's evaluations are placed on dates, end to end", async ({ page, isMobile }) => {
  const consoleText: string[] = [];
  page.on("console", (message) => consoleText.push(message.text()));
  await openF(page);
  const visits = visitsPanel(page);
  await expect(visits.getByText("No date yet")).toHaveCount(2);

  // A date in the month is placed, with its upload reminder for the next month.
  const may = visits.getByLabel("Pick a date for General Health Evaluation, May 2026");
  await expect(may).toHaveAttribute("min", "2026-05-01");
  await expect(may).toHaveAttribute("max", "2026-05-31");
  await may.fill("2026-05-12");
  await expect(visits.getByText("May 12, 2026", { exact: true })).toBeVisible();
  await expect(visits.getByText("Reminder, not a visit · Jun 15, 2026 · Upload the evaluation (HCBS 08-26-01)")).toBeVisible();

  // A date outside the month is refused beside the visit and nothing is placed.
  await visits.getByLabel("Pick a date for General Health Evaluation, August 2026").fill("2026-09-01");
  await expect(visits.getByRole("alert")).toHaveText(
    "Not placed. Sep 1, 2026 is outside August 2026, the month this is authorized for. Pick a date in that month.",
  );
  await expect(visits.getByText("No date yet")).toHaveCount(1);
  await analyze(page);
  if (isMobile) {
    await expectNoPageScroll(page);
    await expectTouchTargets(page);
  }

  // A reload keeps the date; the name and DCN are in neither storage nor the console.
  await page.waitForFunction(() => sessionStorage.getItem("cps.quick.v3")?.includes("2026-05-12"));
  const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  for (const text of [stored, consoleText.join("\n")]) {
    expect(text).not.toContain("SAMPLE PARTICIPANT");
    expect(text).not.toContain("10000006");
  }
  await page.reload();
  await expect(visitsPanel(page).getByText("May 12, 2026", { exact: true })).toBeVisible();

  // Keyboard only: the date can be removed from the keyboard.
  const remove = visitsPanel(page).getByRole("button", { name: "Remove the date for General Health Evaluation, May 2026" });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(visitsPanel(page).getByText("No date yet")).toHaveCount(2);
  await expect(visitsPanel(page).getByText(/Reminder, not a visit/)).toHaveCount(0);
});
