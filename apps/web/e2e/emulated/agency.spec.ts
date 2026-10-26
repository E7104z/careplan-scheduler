import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Runs only inside `firebase emulators:exec --only auth,firestore --project demo-careplan`.
// Toasts match twice (the toast and Radix's screen-reader announcement), hence `.first()`.
const OOB_CODES = "http://127.0.0.1:9099/emulator/v1/projects/demo-careplan/oobCodes";
const PASSWORD = "p-test-password-01";

interface OobCode {
  email: string;
  requestType: string;
  oobLink: string;
}

async function verificationLink(request: APIRequestContext, email: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(OOB_CODES);
      const { oobCodes } = (await response.json()) as { oobCodes: OobCode[] };
      link = oobCodes.filter((code) => code.email === email && code.requestType === "VERIFY_EMAIL").at(-1)?.oobLink;
      return link;
    })
    .toBeTruthy();
  return link!;
}

async function signUpAndVerify(page: Page, context: { newPage: () => Promise<Page> }, email: string): Promise<void> {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Create account" })).toBeFocused();

  await page.getByLabel("Your name").fill("P-TEST-01");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
  const link = await verificationLink(page.request, email);
  const mail = await context.newPage();
  await mail.goto(link);
  await mail.close();
  await page.getByRole("button", { name: "I've verified my email" }).click();

  // Verified, but with no agency yet, so /app hands the person to set-up.
  await expect(page).toHaveURL(/\/app\/new-agency$/);
}

test("set up an agency, see it on Home, and edit its details", async ({ page, context }) => {
  const email = `p-test-${Date.now()}@example.com`;
  await signUpAndVerify(page, context, email);

  await expect(page.getByRole("heading", { level: 1, name: "Set up your agency" })).toBeFocused();
  await page.getByLabel("Agency name").fill("P-TEST-AGENCY-01");
  await page.getByRole("button", { name: "Set up agency" }).click();

  // Home shows the greeting and the new agency name; the shell shows the name too.
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hi P-TEST-01" })).toBeVisible();
  await expect(page.getByText("P-TEST-AGENCY-01").first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Agency set up" }).first()).toBeVisible();

  // Owners edit the agency details and save.
  await page.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Agency" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agency details" })).toBeFocused();
  const name = page.getByLabel("Agency name");
  await expect(name).toHaveValue("P-TEST-AGENCY-01");
  await name.fill("P-TEST-AGENCY-02");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Changes saved" }).first()).toBeVisible();
});
