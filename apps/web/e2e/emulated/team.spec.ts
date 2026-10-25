import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// AC-16 end to end, with two people in two browser contexts. Runs only inside
// `firebase emulators:exec --only auth,firestore --project demo-careplan`.
// Toasts match twice (the toast and Radix's screen-reader announcement), hence `.first()`.
const OOB_CODES = "http://127.0.0.1:9099/emulator/v1/projects/demo-careplan/oobCodes";
const PASSWORD = "p-test-password-01";
const AGENCY = "P-TEST-AGENCY-01";

interface OobCode {
  email: string;
  requestType: string;
  oobLink: string;
}

/** On /sign-up: create the account, open the emulator's verification link, and confirm it. */
async function createAccountAndVerify(page: Page, context: BrowserContext, name: string, email: string): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name: "Create account" })).toBeFocused();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();

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
}

function toast(page: Page, text: string) {
  return page.getByRole("status").filter({ hasText: text }).first();
}

test("AC-16: an owner invites a scheduler, they join, then the owner changes and removes them", async ({
  page: owner,
  context: ownerContext,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const ownerEmail = `p-test-owner-${Date.now()}@example.com`;
  const schedulerEmail = "scheduler@example.com";

  // The owner signs up, verifies and sets up the agency.
  await ownerContext.grantPermissions(["clipboard-read", "clipboard-write"]);
  await owner.goto("/app");
  await owner.getByRole("link", { name: "Create an account" }).click();
  await createAccountAndVerify(owner, ownerContext, "P-TEST-OWNER", ownerEmail);
  await expect(owner).toHaveURL(/\/app\/new-agency$/);
  await owner.getByLabel("Agency name").fill(AGENCY);
  await owner.getByRole("button", { name: "Set up agency" }).click();
  await expect(owner).toHaveURL(/\/app$/);

  // The owner invites scheduler@example.com and copies the link.
  await owner.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Team" }).click();
  await expect(owner.getByRole("heading", { level: 1, name: "Team" })).toBeFocused();
  await owner.getByRole("button", { name: "Invite someone" }).click();
  const inviteDialog = owner.getByRole("dialog", { name: "Invite someone" });
  await inviteDialog.getByLabel("Email", { exact: true }).fill(schedulerEmail);
  await inviteDialog.getByRole("button", { name: "Create invite" }).click();
  const linkBox = inviteDialog.getByLabel("Invite link");
  await expect(linkBox).toHaveValue(/\/join\/[A-Za-z0-9]+$/);
  await inviteDialog.getByRole("button", { name: "Copy invite link" }).click();
  await expect(toast(owner, "Invite link copied")).toBeVisible();
  const link = await owner.evaluate(() => navigator.clipboard.readText());
  expect(link).toBe(await linkBox.inputValue());
  // Escape closes the dialog even while the toast shows (the toast stays), and focus goes back.
  await owner.keyboard.press("Escape");
  await expect(inviteDialog).toHaveCount(0);
  await expect(owner.getByRole("button", { name: "Invite someone" })).toBeFocused();
  await expect(owner.getByRole("table", { name: "Pending invites" })).toContainText(schedulerEmail);

  // The scheduler opens the link signed out, creates an account, verifies and joins.
  const schedulerContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 1280, height: 800 },
  });
  const scheduler = await schedulerContext.newPage();
  await scheduler.goto(link);
  await expect(scheduler).toHaveURL(/\/sign-in\?next=%2Fjoin%2F/);
  await scheduler.getByRole("link", { name: "Create an account" }).click();
  await createAccountAndVerify(scheduler, schedulerContext, "P-TEST-SCHED", schedulerEmail);
  await expect(scheduler).toHaveURL(/\/join\/[A-Za-z0-9]+$/);
  await expect(scheduler.getByText(`${AGENCY} invited you to join as a Scheduler.`)).toBeVisible();
  await scheduler.getByRole("button", { name: `Join ${AGENCY}` }).click();
  await expect(scheduler).toHaveURL(/\/app$/);
  await expect(toast(scheduler, `Joined ${AGENCY}`)).toBeVisible();
  await expect(scheduler.getByRole("heading", { level: 1, name: "Hi P-TEST-SCHED" })).toBeVisible();

  // Both see each other on Team.
  await scheduler.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Team" }).click();
  const schedulerView = scheduler.getByRole("table", { name: "Members" });
  await expect(schedulerView.getByRole("row", { name: /P-TEST-OWNER/ })).toContainText("Owner");
  await expect(schedulerView.getByRole("row", { name: /P-TEST-SCHED/ })).toContainText("Scheduler");
  await expect(scheduler.getByText("Only an owner can invite or remove people.")).toBeVisible();

  await owner.reload();
  const ownerView = owner.getByRole("table", { name: "Members" });
  await expect(ownerView.getByRole("row", { name: /P-TEST-SCHED/ })).toContainText(schedulerEmail);
  await expect(owner.getByRole("table", { name: "Pending invites" })).toHaveCount(0);

  // The owner makes them a Viewer.
  await owner.getByRole("button", { name: "Actions for P-TEST-SCHED" }).click();
  await owner.getByRole("menuitem", { name: "Make viewer" }).click();
  await expect(toast(owner, "Role changed to Viewer")).toBeVisible();
  await expect(ownerView.getByRole("row", { name: /P-TEST-SCHED/ })).toContainText("Viewer");

  // The owner removes them.
  await owner.getByRole("button", { name: "Actions for P-TEST-SCHED" }).click();
  await owner.getByRole("menuitem", { name: "Remove from team" }).click();
  const confirm = owner.getByRole("dialog", { name: "Remove from team" });
  await expect(confirm).toContainText(`Remove P-TEST-SCHED from ${AGENCY}? They lose access right away.`);
  await confirm.getByRole("button", { name: "Remove from team" }).click();
  await expect(toast(owner, "Removed from team")).toBeVisible();
  await expect(ownerView.getByRole("row", { name: /P-TEST-SCHED/ })).toHaveCount(0);

  // Without a membership, they land on set-up.
  await scheduler.goto("/app");
  await expect(scheduler).toHaveURL(/\/app\/new-agency$/);
  await expect(scheduler.getByRole("heading", { level: 1, name: "Set up your agency" })).toBeVisible();
  await schedulerContext.close();
});
