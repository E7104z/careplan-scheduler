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

async function openG(page: Page): Promise<void> {
  // Oct 31, 2026: fixture G's plan (Nov 2026 to Apr 2027) is all still to come.
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00-05:00"));
  await page.goto("/quick");
  await openCarePlanText(page, fixtureText("G-care-plan-report-kept"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT G" })).toBeVisible();
}

test("ADW-03, ADW-04: adult day care and meals are placed on dates in their own units", async ({ page, isMobile }) => {
  await openG(page);

  // Meals: placed as meals, with the balance in meals; a third meal that day is refused.
  const meals = page.getByRole("group", { name: "Place HDM on the calendar" });
  await meals.getByLabel("Date", { exact: true }).fill("2026-11-03");
  await meals.getByLabel("Meals", { exact: true }).fill("2");
  await meals.getByRole("button", { name: "Add delivery for HDM" }).click();
  await expect(meals.getByText("Nov 3, 2026 · 2 meals")).toBeVisible();
  await expect(meals.getByText("62 meals in November 2026, 2 placed, 60 left")).toBeVisible();
  await expect(page.getByText("Arranged by date · 1 date placed")).toBeVisible();
  await meals.getByLabel("Meals", { exact: true }).fill("1");
  await meals.getByRole("button", { name: "Add delivery for HDM" }).click();
  await expect(meals.getByRole("alert")).toHaveText(
    "Not placed. Home delivered meals are limited to 2 a day. Enter 2 or fewer for Nov 3, 2026.",
  );

  // Adult day care, from the keyboard: date, minutes, transportation, Enter on the button.
  const care = page.getByRole("group", { name: "Place ADC on the calendar" });
  await care.getByLabel("Date", { exact: true }).fill("2026-11-02");
  await care.getByLabel("Minutes attended", { exact: true }).focus();
  await page.keyboard.type("480");
  await page.keyboard.press("Tab");
  await page.keyboard.type("60");
  await page.keyboard.press("Tab");
  await expect(care.getByRole("button", { name: "Add day care day for ADC" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(care.getByText("Nov 2, 2026 · 8 h · 60 min transportation")).toBeVisible();
  await expect(care.getByText("100 h in November 2026, 8 h placed, 92 h left")).toBeVisible();

  await analyze(page);
  if (isMobile) {
    await expectNoPageScroll(page);
    await expectTouchTargets(page);
  }

  // A reload keeps both, and the week still holds only the CDS service.
  await page.waitForFunction(() => sessionStorage.getItem("cps.quick.v3")?.includes("ADC_DAY"));
  await page.reload();
  await expect(page.getByRole("group", { name: "Place HDM on the calendar" }).getByText("Nov 3, 2026 · 2 meals")).toBeVisible();
  await expect(page.getByRole("group", { name: "Place ADC on the calendar" }).getByText("Nov 2, 2026 · 8 h · 60 min transportation")).toBeVisible();
});
