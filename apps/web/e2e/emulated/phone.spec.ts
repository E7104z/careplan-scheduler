import { expect, test, type Page } from "@playwright/test";
import { expectGridScrollsInPanel, expectPhoneLayout } from "../layout-checks";
import { createAccount, createInvite, setUpAgency, verifyEmail } from "./helpers";

// AC-19 at 390 × 844 for the signed-in routes in AC-18 and the other signed-in pages: no
// sideways page scroll, and 44 × 44 px buttons (APP-SPEC 4.4). Runs only inside
// `firebase emulators:exec`.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const AGENCY = "P-TEST-AGENCY-01";

async function onPage(page: Page, heading: string): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await expectPhoneLayout(page);
}

test("AC-19: every signed-in page at phone size", async ({ page, context }) => {
  test.setTimeout(180_000);
  const email = `p-test-phone-${Date.now()}@example.com`;

  await createAccount(page, "P-TEST-01", email);
  await onPage(page, "Check your email");

  await verifyEmail(page, context, email);
  await onPage(page, "Set up your agency");

  await setUpAgency(page, AGENCY);
  await onPage(page, "Hi P-TEST-01");

  // The app's navigation is a disclosure on phones.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Menu" })).toBeVisible();
  await expectPhoneLayout(page);
  await page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: "Quick Schedule" }).click();

  await onPage(page, "Quick Schedule");
  await expectGridScrollsInPanel(page);

  await page.goto("/app/agency");
  await onPage(page, "Agency details");

  await page.goto("/app/agency/members");
  await onPage(page, "Team");
  const link = await createInvite(page, "p-test-invitee@example.com");
  await expectPhoneLayout(page);
  await page.getByRole("dialog", { name: "Invite someone" }).getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("table", { name: "Pending invites" })).toContainText("p-test-invitee@example.com");
  await expectPhoneLayout(page);

  await page.goto(link);
  await expect(page.getByText(/^This invite is for p\*+@example\.com\./)).toBeVisible();
  await onPage(page, "Accept invite");

  await page.goto("/app/account");
  await onPage(page, "Your account");
});
