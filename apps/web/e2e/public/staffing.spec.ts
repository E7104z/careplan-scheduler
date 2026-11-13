import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectNoPageScroll, expectTouchTargets } from "../layout-checks";
import { fixtureText, openCarePlanText } from "./helpers";

// Coverage Phase 4: clock times, caregivers and the rules that read them. Apr 15, 2026 is inside
// fixture F's plan (Feb 1 to Oct 31, 2026).
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

function panel(page: Page, name: string) {
  return page.locator("section", { has: page.getByRole("heading", { name, exact: true }) });
}

test("CP4-1: without clock times overlaps need review; a start time builds the visit and is shown where the visit is", async ({ page, isMobile }) => {
  await openF(page);

  // A plan as opened: overlaps can't be checked yet, and that is never a pass.
  const checks = panel(page, "Visit checks");
  await expect(checks.getByText("No clock times yet, so overlaps can't be checked")).toBeVisible();
  await expect(checks.getByText("PC - Agency, PC - CDS, HC · CON-01, CON-02")).toBeVisible();
  await analyze(page);

  // A service in detail: a start time for its care day, from the keyboard.
  await page.getByRole("button", { name: "Open PC - CDS" }).click();
  const times = panel(page, "Visit start times");
  await expect(times.getByText("Optional. Add a start time to check overlaps with other services.")).toBeVisible();
  await times.getByLabel("Friday start time").fill("09:00");
  await expect(times.getByText("Visit length 2 h, ends 11:00 AM")).toBeVisible();
  await expect(panel(page, "Daily task list").getByText("Starts 9:00 AM")).toBeVisible();
  await analyze(page);
  if (isMobile) {
    await expectNoPageScroll(page);
    await expectTouchTargets(page);
  }

  // Back on the whole plan, that service is no longer under review. A reload keeps the time.
  await page.getByRole("button", { name: /Whole care plan/ }).click();
  await expect(panel(page, "Visit checks").getByText("PC - Agency, HC · CON-01, CON-02")).toBeVisible();
  await page.waitForFunction(() => sessionStorage.getItem("cps.quick.v3")?.includes('"startTimes"'));
  await page.reload();
  await expect(panel(page, "Visit checks").getByText("PC - Agency, HC · CON-01, CON-02")).toBeVisible();
});

test("CP4-2: caregivers are entered, never guessed; a name is in no storage and no log", async ({ page, isMobile }) => {
  const consoleText: string[] = [];
  page.on("console", (message) => consoleText.push(message.text()));
  await openF(page);
  const caregivers = panel(page, "Caregivers");
  await expect(caregivers.getByText("None added")).toBeVisible();

  await caregivers.getByRole("button", { name: "Add a caregiver" }).click();
  await caregivers.getByLabel("Name of Caregiver 1 (kept in this tab only, never saved)").fill("Caregiver A");
  await expect(caregivers.getByText("Caregiver A", { exact: true })).toBeVisible();
  await expect(caregivers.getByLabel("Agency employee: Caregiver 1")).toHaveValue("");

  // Assigned with nothing entered: needs review, never a pass.
  await caregivers.getByRole("checkbox", { name: "PC - Agency" }).check();
  await expect(panel(page, "Visit checks").getByText("Caregiver details are missing")).toBeVisible();
  await analyze(page);
  if (isMobile) {
    await expectNoPageScroll(page);
    await expectTouchTargets(page);
  }

  // Entering what is known clears the review.
  await caregivers.getByLabel("Relationship of Caregiver 1 to the participant").selectOption("none");
  await caregivers.getByLabel("Agency employee: Caregiver 1").selectOption("yes");
  await expect(panel(page, "Visit checks").getByText("Caregiver details are missing")).toHaveCount(0);

  // A second caregiver, the participant's spouse, can't be the paid CDS attendant.
  await caregivers.getByRole("button", { name: "Add a caregiver" }).click();
  await caregivers.getByLabel("Relationship of Caregiver 2 to the participant").selectOption("spouse");
  await caregivers.getByRole("checkbox", { name: "PC - CDS" }).nth(1).check({ force: true }).catch(() => {});
  await expect(caregivers.getByRole("alert")).toHaveText(
    "Not changed. This attendant can't be paid for this participant. A spouse or legal guardian can't be the CDS attendant.",
  );
  await expect(caregivers.getByRole("checkbox", { name: "PC - CDS" }).nth(1)).not.toBeChecked();
  await analyze(page);

  // The name is nowhere but the page; after a reload the caregiver is "Caregiver 1".
  await page.waitForFunction(() => sessionStorage.getItem("cps.quick.v3")?.includes('"caregiverIds"'));
  const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  for (const text of [stored, consoleText.join("\n"), page.url()]) {
    expect(text).not.toContain("Caregiver A");
    expect(text).not.toContain("SAMPLE PARTICIPANT");
  }
  await page.reload();
  const again = panel(page, "Caregivers");
  await expect(again.getByText("Caregiver 1", { exact: true })).toBeVisible();
  await expect(again.getByText("Caregiver A")).toHaveCount(0);
  await expect(again.getByRole("checkbox", { name: "PC - Agency" }).first()).toBeChecked();
});
