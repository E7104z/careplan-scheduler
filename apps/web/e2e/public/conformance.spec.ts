import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectPhoneLayout } from "../layout-checks";

// Phase 3, Prompt 7: the public proof page.
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test("WS-X07: /conformance shows the samples, worked out live, equal to DSDS's workbook, with no Firebase", async ({ page }) => {
  const firebase: string[] = [];
  page.on("request", (request) => {
    if (/firebase|googleapis|gstatic\.com\/firebasejs/.test(request.url())) firebase.push(request.url());
  });
  await page.goto("/conformance");
  await expect(page.getByRole("heading", { level: 1, name: "How CarePlan Scheduler matches the state's worksheets" })).toBeVisible();
  await expect(page.getByText("CarePlan Scheduler is not an official DSDS tool and DSDS has not reviewed it.")).toBeVisible();
  await expect(page.getByText(/compared every answer with ours\. 0 differences\./)).toBeVisible();

  const rows = page.locator("tr[data-sample]");
  await expect(rows).toHaveCount(12);
  for (let i = 0; i < 12; i++) {
    const recorded = await rows.nth(i).locator("[data-recorded]").innerText();
    await expect(rows.nth(i).locator("[data-live]")).toHaveText(recorded);
  }
  await expect(page.getByText(/^\d+ of \d+ worksheet items done\.$/)).toBeVisible();
  expect(firebase).toEqual([]);
});

test("the footer links to /conformance", async ({ page, isMobile }) => {
  await page.goto("/rules");
  await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "How we match DSDS's worksheets" }).click();
  await expect(page).toHaveURL(/\/conformance$/);
  if (isMobile) await expectPhoneLayout(page);
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: /conformance in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((value) => localStorage.setItem("cps.theme", value), theme);
    await page.goto("/conformance");
    await expect(page.getByRole("heading", { level: 1, name: "How CarePlan Scheduler matches the state's worksheets" })).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);
  });
}
