import { expect, test } from "@playwright/test";
import { expectGridScrollsInPanel, expectPhoneLayout } from "../layout-checks";
import { changeCell, fixturePdf, fixtureText, openCarePlan, openCarePlanText } from "./helpers";

// AC-19 at 390 × 844 (the phone project) for the public routes in AC-18 and the other public
// pages: no sideways page scroll, and 44 × 44 px buttons and toggles (APP-SPEC 4.4).
// Nov 20, 2025: every fixture's plan is current or still to come (B starts Dec 1, 2025; D runs
// Sep 2025 to Jun 2026). A schedule covers only months still to come (APP-SPEC 5.3 step 5).
const FIXED_TIME = new Date("2025-11-20T12:00:00-06:00");

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone viewport only");
  await page.clock.setFixedTime(FIXED_TIME);
});

for (const { path, heading } of [
  { path: "/", heading: "Open a Fusion care plan PDF. Get a schedule that follows Missouri's rules." },
  { path: "/rules", heading: "Rules and sources" },
  { path: "/privacy", heading: "Privacy" },
  { path: "/sign-in", heading: "Sign in" },
  { path: "/sign-up", heading: "Create account" },
  { path: "/reset-password", heading: "Reset your password" },
  { path: "/no-such-page", heading: "We can't find that page" },
]) {
  test(`AC-19: ${path} at phone size`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectPhoneLayout(page);
  });
}

test("AC-19: the phone menu at phone size", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("navigation", { name: "Menu" })).toBeVisible();
  await expectPhoneLayout(page);
});

test("AC-19: /quick with the example, then an import issue, at phone size", async ({ page }) => {
  await page.goto("/quick");
  await expect(page.getByRole("heading", { name: "Example care plan" })).toBeVisible();
  await expectPhoneLayout(page);
  await expectGridScrollsInPanel(page);

  await openCarePlanText(page, fixtureText("D-page1-only-incomplete"));
  await expect(page.getByText("This PDF has 10 of the plan's 14 rows")).toBeVisible();
  await expectPhoneLayout(page);
});

test("AC-19: /quick with a built plan and a refused change at phone size", async ({ page }) => {
  await page.goto("/quick");
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  await expectPhoneLayout(page);
  await expectGridScrollsInPanel(page);

  // "Review what we read": the read table scrolls inside its own panel too.
  await page.getByRole("button", { name: "Review what we read" }).click();
  const readTable = page.getByRole("table", { name: "What we read from Fusion" });
  await expect(readTable).toBeVisible();
  expect(await readTable.locator("..").evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expectPhoneLayout(page);
  await page.getByRole("button", { name: "Hide what we read" }).click();

  // A refused cell change and its "Use 55 minutes" button. As in AC-05, Monday's Bathing comes
  // down to 30 first; without that the month has no room for Tuesday and there's no suggestion.
  await changeCell(page, "Bathing", "Monday", 45, 30);
  await expect(page.getByRole("button", { name: "Bathing, Monday, 30 minutes. Change minutes" })).toBeVisible();
  await changeCell(page, "Bathing", "Tuesday", 45, 60);
  await expect(page.getByRole("button", { name: "Use 55 minutes" })).toBeVisible();
  await expectPhoneLayout(page);

  // "Show in week" on a check about one task: 55 minutes is above Bathing's 45 (SCH-03).
  await page.getByRole("button", { name: "Use 55 minutes" }).click();
  await page.getByText("A day has more minutes than the task allows").click();
  await expect(page.getByRole("button", { name: "Show in week" })).toBeVisible();
  await expectPhoneLayout(page);

  // "Let us choose" once a task's days are chosen by hand.
  await page.getByRole("group", { name: "Bathing days" }).getByRole("button", { name: "Saturday" }).click();
  await expect(page.getByRole("button", { name: "Let us choose" }).first()).toBeVisible();
  await expectPhoneLayout(page);
});

test("AC-19: on a phone, Skip to the schedule goes past a long care plan to the status", async ({ page }) => {
  await page.goto("/quick");
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  const status = page.getByRole("status", { name: "Schedule status" });
  await expect(status).not.toBeInViewport();
  await page.getByRole("link", { name: "Skip to the schedule" }).click();
  await expect(status).toBeInViewport();
  // Not under the sticky header.
  const headerBottom = (await page.locator("header").first().boundingBox())!;
  expect((await status.boundingBox())!.y).toBeGreaterThanOrEqual(headerBottom.y + headerBottom.height);
  await expectPhoneLayout(page);
});

test("AC-19: /quick with a care plan of several services at phone size", async ({ page }) => {
  await page.goto("/quick");
  await openCarePlanText(page, fixtureText("F-care-plan-report-multi"));
  await expect(page.getByRole("heading", { name: "The participant's week" })).toBeVisible();
  await expectPhoneLayout(page);
  await page.getByRole("button", { name: "Open PC - Agency" }).click();
  await expect(page.getByRole("button", { name: /PC - Agency/, pressed: true })).toBeVisible();
  await expectPhoneLayout(page);
});
