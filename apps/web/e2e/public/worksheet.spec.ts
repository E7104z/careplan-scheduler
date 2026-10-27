import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectPhoneLayout } from "../layout-checks";

// Phase 3, Prompt 5: the Worksheet view on the public /quick page (no Firebase).
const FIXED_TIME = new Date("2026-10-21T12:00:00-05:00");
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

interface Golden { workbooks: { tab: string; inputs: { rows: Record<string, [number | null, number | null]> }; units: Record<string, number | null> }[] }
const golden = JSON.parse(readFileSync(new URL("../../../../docs/fixtures/state/hcbs3c-golden.json", import.meta.url), "utf8")) as Golden;

/** What DSDS's own CDS tab recorded for one task row of `min` minutes on `days` days. */
function dsdsUnits(min: number, days: number): number {
  for (const workbook of golden.workbooks.filter((w) => w.tab === "CDS")) {
    const row = Object.keys(workbook.inputs.rows).find((key) => workbook.inputs.rows[key]![0] === min && workbook.inputs.rows[key]![1] === days);
    if (row) return workbook.units[row]!;
  }
  throw new Error(`no golden row for ${min} × ${days}`);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_TIME);
});

/** A care plan by hand with these CDS tasks (picked in the care plan pane), then the Worksheet tab. */
async function byHand(page: Page, tasks: string[], service = "T1019U2"): Promise<void> {
  await page.goto("/quick");
  await page.getByText("Build a schedule by hand").click();
  await page.getByRole("combobox", { name: "Authorized service" }).selectOption(service);
  const picker = page.getByRole("combobox", { name: "Add a task" });
  for (const task of tasks) {
    await picker.focus();
    await page.keyboard.type(task);
    await page.keyboard.press("Enter");
  }
  await page.getByRole("tab", { name: "Worksheet" }).click();
  await expect(page.getByRole("heading", { name: "Worksheet view" })).toBeVisible();
}

async function setRow(page: Page, task: string, minutes: number, days: number): Promise<void> {
  const box = page.getByRole("textbox", { name: `${task}, minutes a day` });
  await box.fill(String(minutes));
  await box.press("Enter");
  await page.getByRole("combobox", { name: `${task}, days a week` }).selectOption(String(days));
}

test("WS-C09 in the browser: 45 min × 5 days shows what DSDS's workbook shows", async ({ page }) => {
  await byHand(page, ["bathing"]);
  await setRow(page, "Bathing", 45, 5);
  const row = page.getByRole("row", { name: /^Bathing/ });
  await expect(row.getByRole("cell").nth(7)).toHaveText(String(dsdsUnits(45, 5)));
});

test("WS-C13: the total turns red above 641 units, and the ILW tab takes it from there", async ({ page }) => {
  await byHand(page, ["bathing", "trash"]);
  await setRow(page, "Bathing", 300, 7);
  await setRow(page, "Trash", 62, 1);
  const total = page.getByRole("tabpanel", { name: "Worksheet" }).locator("dd[aria-live]");
  await expect(total).toHaveText(`${dsdsUnits(300, 7) + dsdsUnits(62, 1)} units`);
  await setRow(page, "Trash", 65, 1);
  await expect(total).toHaveText(`${dsdsUnits(300, 7) + dsdsUnits(65, 1)} units · Over the 641-unit maximum`);
  await page.getByRole("button", { name: "See it on the ILW worksheet" }).click();
  await expect(page.getByText("Follows DSDS-HCBS-3c (07/26). Not an official DSDS form.")).toBeVisible();
  await expect(page.getByText(/Over the 868-unit maximum/)).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Authorized service" })).toHaveValue("T1019U6");
});

test("W-4: the name, DCN, phones and emergency contact never reach sessionStorage", async ({ page }) => {
  await byHand(page, ["bathing"]);
  await page.getByRole("textbox", { name: "Participant name" }).fill("P-TEST-01 WORKSHEET");
  await page.getByRole("textbox", { name: "DCN" }).fill("99999999");
  await page.getByRole("textbox", { name: "Provider agency phone" }).fill("555-0100");
  await page.getByRole("textbox", { name: "Emergency contact", exact: true }).fill("P-TEST-02 CONTACT");
  await page.getByRole("textbox", { name: "Emergency contact phone" }).fill("555-0101");
  await setRow(page, "Bathing", 30, 3);
  await page.waitForTimeout(500);
  const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage }) + location.href);
  expect(stored).toContain("cps.quick.v2");
  for (const typed of ["P-TEST-01", "99999999", "555-0100", "P-TEST-02", "555-0101"]) expect(stored).not.toContain(typed);
});

test("WS-M03: the Tab key goes through the header in the form's order", async ({ page }) => {
  await byHand(page, ["bathing"]);
  await page.getByRole("textbox", { name: "Participant name" }).focus();
  for (const next of ["DCN", "Provider agency name", "Provider agency phone"]) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("textbox", { name: next })).toBeFocused();
  }
  await page.keyboard.press("Tab");
  await expect(page.getByRole("checkbox", { name: /^IHS/ })).toBeFocused();
});

test("phone: the worksheet's tables scroll in their own panel, never the page", async ({ page, isMobile }) => {
  test.skip(!isMobile, "a phone layout check");
  await byHand(page, ["bathing", "clean kitchen"], "T1019");
  await expectPhoneLayout(page);
  await page.goto("/quick");
  await page.getByRole("tab", { name: "Worksheet" }).click();
  await expect(page.getByRole("heading", { name: "Worksheet view" })).toBeVisible();
  await expectPhoneLayout(page);
});

for (const theme of ["light", "dark"] as const) {
  test(`axe: the Worksheet view, 3c and 3a, in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((value) => localStorage.setItem("cps.theme", value), theme);
    await page.goto("/quick");
    await page.getByRole("tab", { name: "Worksheet" }).click();
    await expect(page.getByRole("heading", { name: "Worksheet view" })).toBeVisible();
    await page.getByRole("button", { name: "Show the math" }).click();
    expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);

    await byHand(page, ["bathing", "clean kitchen"], "T1019");
    expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);
  });
}
