import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { fixtureText, openCarePlanText } from "../public/helpers";
import { createAccount, setUpAgency, verifyEmail } from "./helpers";

// Runs only inside `firebase emulators:exec --only auth,firestore --project demo-careplan`.
// PHASE-3-SPEC section 6 end to end: both gates, then a plan saved to the agency and opened again.
// Fixture E's plan runs to Jan 31, 2027, so it is still current on the real clock (Firebase Auth
// needs the real clock).
const PHI_FLAG = "http://127.0.0.1:8080/v1/projects/demo-careplan/databases/(default)/documents/config/phiStorage";
// The Firestore emulator lets "Bearer owner" past the rules: the stand-in for the Admin SDK, the only
// thing allowed to set this flag (R-25).
const ADMIN = { Authorization: "Bearer owner" };
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function setPhiStorage(request: APIRequestContext, enabled: boolean): Promise<void> {
  const response = enabled
    ? await request.patch(PHI_FLAG, { headers: ADMIN, data: { fields: { enabled: { booleanValue: true } } } })
    : await request.delete(PHI_FLAG, { headers: ADMIN });
  expect(response.ok()).toBe(true);
}

test("AC-32: saved plans open only behind both gates, then save to a participant and open again", async ({ page, context }) => {
  // The rules tests share this emulator and can leave the flag on: start from it off.
  await setPhiStorage(page.request, false);
  const email = `p-test-${Date.now()}@example.com`;
  await createAccount(page, "P-TEST-01", email);
  await verifyEmail(page, context, email);
  await setUpAgency(page, "P-TEST-AGENCY-01");

  try {
    // Gate 1: the customer BAA.
    await page.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Participants" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Participants" })).toBeVisible();
    await expect(page.getByText("Saving to your agency needs the business associate agreement")).toBeVisible();
    await page.getByRole("link", { name: "Review and accept the agreement" }).click();
    await page.getByRole("checkbox", { name: /I am authorized to accept this agreement/ }).check();
    await page.getByRole("button", { name: "Accept agreement" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Agreement accepted" }).first()).toBeVisible();

    // Gate 2: the deployment's PHI storage, off until the Admin SDK turns it on.
    await page.goto("/app/participants");
    await expect(page.getByText("Saving to your agency isn't turned on yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add participant" })).toHaveCount(0);
    await setPhiStorage(page.request, true);
    await page.reload();

    await page.getByRole("textbox", { name: /^Name or alias/ }).fill("P-001");
    await page.getByRole("button", { name: "Add participant" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "P-001" })).toBeVisible();
    await expect(page.getByText("No saved plans yet.", { exact: false })).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);

    // Save the plan from Quick Schedule.
    await page.getByRole("link", { name: "Quick Schedule" }).first().click();
    await openCarePlanText(page, fixtureText("E-care-plan-report-229"));
    await expect(page.getByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT E" })).toBeVisible();
    await page.getByRole("button", { name: "Save to agency" }).click();
    const dialog = page.getByRole("dialog", { name: "Save to your agency" });
    await dialog.getByRole("combobox", { name: /^Participant/ }).selectOption({ label: "P-001" });
    await dialog.getByRole("button", { name: "Save plan" }).click();
    await expect(dialog.getByRole("status")).toHaveText(/^Saved to P-001\./);
    await dialog.getByRole("link", { name: "View participant" }).click();

    // Open it again: the schedule comes back without the name or DCN.
    await expect(page.getByRole("heading", { level: 1, name: "P-001" })).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Open in Quick Schedule" }).click();
    await expect(page).toHaveURL(/\/app\/quick$/);
    await expect(page.getByRole("heading", { level: 2, name: "Care plan from Fusion" })).toBeVisible();
    await expect(page.getByText("SAMPLE PARTICIPANT E")).toHaveCount(0);
    const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toMatch(/SAMPLE PARTICIPANT|10000005/);
  } finally {
    await setPhiStorage(page.request, false);
  }
});
