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

/** The emulator's latest email-verification link for this address. */
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

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("sign up, verify by email, sign out, sign in again, and reset a password", async ({ page, request, context }) => {
  const email = `p-test-${Date.now()}@example.com`;

  // An /app page while signed out goes to sign-in, then on to sign-up.
  await page.goto("/app/account");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp%2Faccount$/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Create account" })).toBeFocused();

  await page.getByLabel("Your name").fill("P-TEST-01");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
  await expect(page.getByText(`We sent a link to ${email}.`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send the email again" })).toBeDisabled();
  await page.getByRole("button", { name: "I've verified my email" }).click();
  await expect(page.getByText("We don't see the verification yet.", { exact: false })).toBeVisible();

  // Open the emailed link (the emulator's copy of it), then come back.
  const link = await verificationLink(request, email);
  const mail = await context.newPage();
  await mail.goto(link);
  await mail.close();
  await page.getByRole("button", { name: "I've verified my email" }).click();

  // `next` survived sign-up and verification.
  await expect(page).toHaveURL(/\/app\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveValue(email);

  // The name save writes users/{uid} through firestore.rules.
  await page.getByLabel("Name").fill("P-TEST-02");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Changes saved" }).first()).toBeVisible();

  await page.getByRole("button", { name: /^Account menu for/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("status").filter({ hasText: "Signed out" }).first()).toBeVisible();

  await page.goto("/sign-in");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Account menu for P-TEST-02" })).toBeVisible();

  await page.getByRole("button", { name: /^Account menu for/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Reset: the same neutral answer for this account and for one that doesn't exist.
  for (const address of [email, `p-test-nobody-${Date.now()}@example.com`]) {
    await page.goto("/reset-password");
    await page.getByLabel("Email").fill(address);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account uses that email, a reset link is on its way.")).toBeVisible();
  }
});

test("a wrong password says so, and a timed-out session explains itself", async ({ page }) => {
  await page.goto("/sign-in?reason=timeout");
  await expect(page.getByText("You were signed out after 30 minutes without activity.")).toBeVisible();

  await signIn(page, `p-test-nobody-${Date.now()}@example.com`);
  await expect(page.getByRole("alert")).toHaveText(
    "That email and password don't match. Try again or reset your password.",
  );
});

test("the public pages still load no Firebase code", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  for (const path of ["/", "/quick", "/rules", "/privacy"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  const bodies = await Promise.all(
    scripts.map((url) => page.request.get(url).then((response) => response.text())),
  );
  expect(bodies.filter((body) => body.includes("identitytoolkit") || body.includes("@firebase/"))).toEqual([]);
});
