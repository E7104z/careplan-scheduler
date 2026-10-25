import { expect, type BrowserContext, type Page } from "@playwright/test";

// For the specs that run inside `firebase emulators:exec --only auth,firestore --project demo-careplan`.
const OOB_CODES = "http://127.0.0.1:9099/emulator/v1/projects/demo-careplan/oobCodes";
const PASSWORD = "p-test-password-01";

interface OobCode {
  email: string;
  requestType: string;
  oobLink: string;
}

/** Opens /sign-up and creates the account; stops on "Check your email". */
export async function createAccount(page: Page, name: string, email: string): Promise<void> {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { level: 1, name: "Create account" })).toBeFocused();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
}

/** Opens the emulator's verification link for this address, then confirms on "Check your email". */
export async function verifyEmail(page: Page, context: BrowserContext, email: string): Promise<void> {
  let link: string | undefined;
  await expect
    .poll(async () => {
      const response = await page.request.get(OOB_CODES);
      const { oobCodes } = (await response.json()) as { oobCodes: OobCode[] };
      link = oobCodes.filter((code) => code.email === email && code.requestType === "VERIFY_EMAIL").at(-1)?.oobLink;
      return link;
    })
    .toBeTruthy();
  const mail = await context.newPage();
  await mail.goto(link!);
  await mail.close();
  await page.getByRole("button", { name: "I've verified my email" }).click();
  // Verified with no agency yet: /app hands the person to set-up.
  await expect(page).toHaveURL(/\/app\/new-agency$/);
}

/** On "Set up your agency": sets it up and lands on Home. */
export async function setUpAgency(page: Page, name: string): Promise<void> {
  await page.getByLabel("Agency name").fill(name);
  await page.getByRole("button", { name: "Set up agency" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** On Team: invites this address and returns the join link, leaving the dialog open on it. */
export async function createInvite(page: Page, email: string): Promise<string> {
  await page.getByRole("button", { name: "Invite someone" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite someone" });
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByRole("button", { name: "Create invite" }).click();
  const linkBox = dialog.getByLabel("Invite link");
  await expect(linkBox).toHaveValue(/\/join\/[A-Za-z0-9]+$/);
  return linkBox.inputValue();
}

/** Applies a theme the way Account → Appearance stores it, then reloads the page. */
export async function reloadInTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.evaluate((value) => localStorage.setItem("cps.theme", value), theme);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}
