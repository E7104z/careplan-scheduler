import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectNoPageScroll, expectTouchTargets } from "../layout-checks";
import { fixturePdf, fixtureText, openCarePlan, openCarePlanText } from "./helpers";

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

test("CP3-5: a context authorization takes a reminder, never a shift", async ({ page, isMobile }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00-05:00"));
  await page.goto("/quick");
  // Fixture G with its context authorization made ILW case management (T2024U6).
  await openCarePlanText(page, fixtureText("G-care-plan-report-kept").replaceAll("T2040U6", "T2024U6"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT G" })).toBeVisible();

  const group = page.getByRole("group", { name: "Place FMS on the calendar" });
  await expect(group.getByText("A reminder is a note on a date. It is never a visit and is never billed.")).toBeVisible();
  await group.getByLabel("Date", { exact: true }).fill("2026-11-10");
  await group.getByLabel("Note (optional)").fill("Call the case manager");
  await group.getByRole("button", { name: "Add reminder for FMS" }).click();
  await expect(group.getByText("Nov 10, 2026 · Reminder, not a visit · Call the case manager")).toBeVisible();
  await expect(page.getByText("No caregiver time", { exact: true })).toBeVisible();
  await analyze(page);
  if (isMobile) {
    await expectNoPageScroll(page);
    await expectTouchTargets(page);
  }
});

test("CP3-5: financial management shows its authorization and offers nothing to place", async ({ page }) => {
  await openG(page);
  await expect(page.getByText("Nothing to place: this is authorization context only.")).toBeVisible();
  await expect(page.getByRole("group", { name: "Place FMS on the calendar" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Place XYZ on the calendar" })).toHaveCount(0);
});

test("AMEND-01: a care plan change is recorded on a service, forward only, and stays under review", async ({ page, isMobile }) => {
  // Nov 20, 2025: before fixture B's plan (Dec 1, 2025 to Oct 31, 2026) starts.
  await page.clock.setFixedTime(new Date("2025-11-20T12:00:00-06:00"));
  await page.goto("/quick");
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();

  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Care plan changes" }) });
  const form = panel.getByRole("group", { name: "Record a care plan change" });
  await expect(panel.getByText("None recorded")).toBeVisible();

  // A decrease dated mid-month, from the keyboard.
  await form.getByLabel("Kind of change").selectOption("decrease");
  await form.getByLabel("Effective date").fill("2026-01-15");
  await form.getByLabel("Bathing: minutes a day from the change on").fill("30");
  await form.getByRole("button", { name: "Record change" }).focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByText("Decrease · Takes effect Feb 1, 2026 (entered Jan 15, 2026; a decrease starts on the first of a month)")).toBeVisible();
  await expect(panel.getByText("Bathing: 45 min a day, 7 days a week → 30 min a day, 7 days a week")).toBeVisible();
  await expect(panel.getByText("Needs review: check the date this change takes effect against the care plan (Manual 4.20).")).toBeVisible();

  // A change that would take effect before it is refused: history is not rewritten.
  await form.getByLabel("Kind of change").selectOption("increase");
  await form.getByLabel("Effective date").fill("2026-01-10");
  await form.getByLabel("Bathing: minutes a day from the change on").fill("60");
  await form.getByRole("button", { name: "Record change" }).click();
  await expect(form.getByRole("alert")).toContainText("Not recorded. A change takes effect after Feb 1, 2026");
  await expect(panel.getByText("1 recorded")).toBeVisible();

  // What Fusion printed is as read, and the status of the plan is unchanged.
  await expect(page.getByText("Our total from these tasks matches Fusion's 455 units for a 30-day month.", { exact: false })).toBeVisible();
  await analyze(page);
  if (isMobile) {
    await expectNoPageScroll(page);
    await expectTouchTargets(page);
  }

  await page.waitForFunction(() => sessionStorage.getItem("cps.quick.v3")?.includes("amendments"));
  await page.reload();
  await expect(page.locator("section", { has: page.getByRole("heading", { name: "Care plan changes" }) }).getByText("1 recorded")).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`CP3-7: the participant calendar, its list and a one-day change (${theme})`, async ({ page, isMobile }) => {
    await page.addInitScript((value) => localStorage.setItem("cps.theme", value), theme);
    await openF(page);

    // The whole care plan opens on the week; Month puts the calendar in its place.
    const tabs = page.getByRole("navigation", { name: "Week or month" });
    await expect(tabs.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "true");
    await tabs.getByRole("button", { name: "Month" }).click();
    const calendar = page.locator("section", { has: page.getByRole("heading", { name: "The participant's month" }) });
    await expect(calendar).toBeVisible();

    // A narrow screen opens on the list; a wide one on the grid.
    if (isMobile) await expect(calendar.getByRole("table", { name: "April 2026 as a list" })).toBeVisible();
    else await expect(calendar.getByRole("grid", { name: "April 2026, by date" })).toBeVisible();
    await analyze(page);
    if (isMobile) {
      await expectNoPageScroll(page);
      await expectTouchTargets(page);
    }

    // The grid from the keyboard: arrows move, Enter chooses the date.
    await calendar.getByRole("button", { name: "Calendar", exact: true }).click();
    const grid = calendar.getByRole("grid", { name: "April 2026, by date" });
    await expect(grid.getByRole("gridcell", { name: "Sunday, Apr 5, 2026: no care" })).toBeVisible();
    await grid.getByRole("gridcell", { name: /^Wednesday, Apr 1, 2026/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(grid.getByRole("gridcell", { name: /^Thursday, Apr 2, 2026/ })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(grid.getByRole("gridcell", { name: /^Friday, Apr 3, 2026: .*PC - CDS 120 minutes/ })).toBeFocused();
    await page.keyboard.press("Enter");
    const form = calendar.getByRole("group", { name: "Change this day: Friday, Apr 3, 2026" });
    await expect(form).toBeVisible();
    await analyze(page);
    if (isMobile) await expectNoPageScroll(page);

    // A one-day change over the month's units is refused there; nothing is changed.
    const field = form.getByRole("textbox").first();
    await field.fill("9999");
    await form.getByRole("button", { name: /^Save / }).first().click();
    await expect(form.getByRole("alert")).toContainText("Not changed.");

    // The same month as a list has the same Friday, and the balances are beside it.
    await calendar.getByRole("button", { name: "Month as a list" }).click();
    const table = calendar.getByRole("table", { name: "April 2026 as a list" });
    await expect(table.getByRole("row", { name: /Apr 3, 2026 PC - CDS Essential transportation 120 min/ })).toBeVisible();
    const balances = calendar.getByRole("region", { name: "Authorization balances" });
    await expect(balances.getByText(/^226 units in April 2026 · /)).toBeVisible();
    await expect(balances.getByText("Next nurse visit to place: General Health Evaluation, May 2026")).toBeVisible();
    await analyze(page);
    if (isMobile) await expectNoPageScroll(page);
  });
}
