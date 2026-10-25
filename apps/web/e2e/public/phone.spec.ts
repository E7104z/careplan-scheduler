import { expect, test } from "@playwright/test";
import { expectGridScrollsInPanel, expectPhoneLayout } from "../layout-checks";
import { changeCell, fixtureText, pasteCarePlan } from "./helpers";

// AC-19 at 390 × 844 (the phone project) for the public routes in AC-18 and the other public
// pages: no sideways page scroll, and 44 × 44 px buttons and toggles (APP-SPEC 4.4).
const FIXED_TIME = new Date("2026-10-21T12:00:00-05:00");

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone viewport only");
  await page.clock.setFixedTime(FIXED_TIME);
});

for (const { path, heading } of [
  { path: "/", heading: "Paste a Fusion care plan. Get a schedule that follows Missouri's rules." },
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

  await pasteCarePlan(page, fixtureText("D-page1-only-incomplete"));
  await expect(page.getByText("This copy has 10 of the plan's 14 rows")).toBeVisible();
  await expectPhoneLayout(page);
});

test("AC-19: /quick with a built plan and a refused change at phone size", async ({ page }) => {
  await page.goto("/quick");
  await pasteCarePlan(page, fixtureText("B-tabbed-7day-455"));
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
});
