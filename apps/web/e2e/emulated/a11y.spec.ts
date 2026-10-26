import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createAccount, createInvite, reloadInTheme, setUpAgency, verifyEmail } from "./helpers";

// AC-18 for the signed-in routes, and APP-SPEC 4.4 for the other pages a signed-in person sees:
// zero axe violations in light and dark. Runs only inside `firebase emulators:exec`.
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const THEMES = ["light", "dark"] as const;
const AGENCY = "P-TEST-AGENCY-01";

async function analyze(page: Page, what: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations, what).toEqual([]);
}

/** Reloads the page in each theme, waits for its heading, and runs axe. */
async function analyzeInBothThemes(page: Page, heading: string): Promise<void> {
  for (const theme of THEMES) {
    await reloadInTheme(page, theme);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await analyze(page, `${heading} in ${theme}`);
  }
}

test("axe: every signed-in page, light and dark", async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const email = `p-test-a11y-${Date.now()}@example.com`;

  await createAccount(page, "P-TEST-01", email);
  await analyzeInBothThemes(page, "Check your email");

  await verifyEmail(page, context, email);
  await analyzeInBothThemes(page, "Set up your agency");

  await setUpAgency(page, AGENCY);
  await analyzeInBothThemes(page, "Hi P-TEST-01");

  await page.goto("/app/quick");
  await analyzeInBothThemes(page, "Quick Schedule");

  await page.goto("/app/agency");
  await analyzeInBothThemes(page, "Agency details");

  // Team with a pending invite, and the invite dialog showing the link.
  await page.goto("/app/agency/members");
  const link = await createInvite(page, "p-test-invitee@example.com");
  await analyze(page, "Invite someone dialog with the link");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await analyzeInBothThemes(page, "Team");
  for (const theme of THEMES) {
    await reloadInTheme(page, theme);
    await page.getByRole("button", { name: "Invite someone" }).click();
    await expect(page.getByRole("dialog", { name: "Invite someone" })).toBeVisible();
    await analyze(page, `Invite someone dialog in ${theme}`);
  }

  // The owner opening an invite meant for someone else: the Join page's wrong-email state.
  await page.goto(link);
  await expect(page.getByText(/^This invite is for p\*+@example\.com\./)).toBeVisible();
  await analyzeInBothThemes(page, "Accept invite");

  await page.goto("/app/account");
  await analyzeInBothThemes(page, "Your account");
});
