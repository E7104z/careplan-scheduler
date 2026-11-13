import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { changeCell, fixturePdf, fixtureText, openCarePlan, openCarePlanText, PDF_CHOOSER, statusPanel } from "./helpers";

// Nov 20, 2025: every fixture's plan is current or still to come (B starts Dec 1, 2025; D runs
// Sep 2025 to Jun 2026). A schedule covers only months still to come (APP-SPEC 5.3 step 5).
const FIXED_TIME = new Date("2025-11-20T12:00:00-06:00");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_TIME);
});

async function buildB(page: Page): Promise<void> {
  await page.goto("/quick");
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
}

test("AC-01: first visit shows the import panel and the 5-day example", async ({ page }) => {
  await page.goto("/quick");

  await expect(page.getByRole("heading", { name: "Open the care plan PDF from Fusion" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Example care plan" })).toBeVisible();
  await expect(page.getByText("Our total from these tasks matches Fusion's 466 units a month.")).toBeVisible();
  await expect(statusPanel(page)).toContainText("Ready to use");

  const tiles = page.locator("ol.grid-cols-7 > li");
  await expect(tiles).toHaveCount(7);
  await expect(tiles.nth(1)).toContainText("290 min");
  await expect(tiles.nth(2)).toContainText("285 min");
  await expect(tiles.nth(3)).toContainText("275 min");
  await expect(tiles.nth(4)).toContainText("270 min");
  await expect(tiles.nth(5)).toContainText("195 min");
  await expect(tiles.nth(0)).toContainText("Off");
  await expect(tiles.nth(6)).toContainText("Off");
});

test("AC-02: opening fixture B's PDF builds the schedule", async ({ page }) => {
  await page.goto("/quick");
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));

  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  await expect(page.getByText("Read from Fusion · DCN 10000002")).toBeVisible();
  await expect(page.getByText("Our total from these tasks matches Fusion's 455 units for a 30-day month. Fusion counts the days in each month for daily tasks, so a 31-day month has 469 and a 28-day month 434.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open the care plan PDF from Fusion" })).toBeHidden();
  // Each month gets Fusion's proration of its 455 (IMP-10), so nothing differs and nothing is cut.
  await expect(statusPanel(page)).toContainText("Ready to use");
  // B has CDS transportation, so CDS-04 (CP4-7) asks for a look at NEMT trips.
  await expect(statusPanel(page)).toContainText("Follows every rule we check. 1 item is worth a look in Checks.");
  await expect(page.getByText("Fusion, for a 31-day month: 469 units − 23 transportation")).toBeVisible();
});

test("AC-03: B at 440 units: December 2025 is cut at the end, with the tasks listed", async ({ page, isMobile }) => {
  test.skip(isMobile, "the trim and calendar are viewport-independent; covered on desktop");
  await page.goto("/quick");
  await openCarePlanText(page, fixtureText("B-tabbed-7day-455").replaceAll("455 units", "440 units"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();

  await expect(page.getByLabel("Units in December 2025")).toBeVisible();
  await expect(page.getByText("This month's tasks need more than Fusion's 440 units")).toBeVisible();
  await expect(page.getByText("320 minutes early, starting Dec 30, 2025")).toBeVisible();
  await expect(
    page.getByText("Dec 30, 2025: Meal Prep/Eating 60 min, Bathing 45 min, Dressing/Grooming 15 min, Wash Dishes 5 min"),
  ).toBeVisible();
  const dec31 = page.getByText(/^Wednesday 31: \d+ minutes, 195 minutes trimmed because the month's units run out$/);
  await expect(dec31).toHaveCount(1);
  await expect(dec31.locator("..")).toContainText("−195 min");
});

test("AC-25: on Oct 21, 2026, no month before October 2026 is scheduled, and an ended plan isn't built", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-21T12:00:00-05:00"));
  await page.goto("/quick");
  // The example starts this month.
  await expect(page.getByRole("heading", { name: "Example care plan" })).toBeVisible();
  await expect(page.getByLabel("Units in October 2026")).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous month" })).toBeDisabled();

  // B (Dec 2025 to Oct 2026) has only October left.
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  await expect(page.getByText("Oct 1, 2026", { exact: true })).toBeVisible();
  // CDS-04 (CP4-7) puts one item in Checks, so the status names it instead of the months
  // (the months-left wording is covered in ui-import.test.tsx).
  await expect(statusPanel(page)).toContainText("Follows every rule we check. 1 item is worth a look in Checks.");
  await expect(page.getByRole("button", { name: "Previous month" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();

  // D ended on Jun 30, 2026.
  await page.getByRole("button", { name: "New care plan" }).first().click();
  await openCarePlanText(page, fixtureText("D-page1-only-incomplete"));
  await page.getByRole("button", { name: "Build with the 10 rows I have" }).click();
  await expect(page.getByRole("heading", { name: "This care plan has ended" })).toBeVisible();
});

test("AC-04: raising Monday's Bathing to 60 is refused and the week is unchanged", async ({ page }) => {
  await buildB(page);

  await changeCell(page, "Bathing", "Monday", 45, 60);
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Not changed.");
  await expect(alert).toContainText("That would put Bathing over its 93 units in December 2025.");
  await expect(alert).toContainText("Bathing can't have more than 45 minutes on Monday.");
  await expect(page.getByRole("button", { name: "Bathing, Monday, 45 minutes. Change minutes" })).toBeVisible();
});

test("AC-05: accepted Monday edit, refused Tuesday edit, then Use 55 minutes", async ({ page }) => {
  await buildB(page);

  await changeCell(page, "Bathing", "Monday", 45, 30);
  await expect(page.getByRole("button", { name: "Bathing, Monday, 30 minutes. Change minutes" })).toBeVisible();

  await changeCell(page, "Bathing", "Tuesday", 45, 60);
  await expect(page.getByRole("alert")).toContainText("The most Bathing can have on Tuesday is 55 minutes.");

  await page.getByRole("button", { name: "Use 55 minutes" }).click();
  await expect(page.getByRole("button", { name: "Bathing, Tuesday, 55 minutes. Change minutes" })).toBeVisible();
  await expect(statusPanel(page)).toContainText("Ready to use");
});
test("AC-06: fixture D offers a partial build and the summary says what's missing", async ({ page }) => {
  await page.goto("/quick");
  await openCarePlanText(page, fixtureText("D-page1-only-incomplete"));

  await expect(page.getByText("This PDF has 10 of the plan's 14 rows")).toBeVisible();
  await page.getByRole("button", { name: "Build with the 10 rows I have" }).click();
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT D" })).toBeVisible();
  await expect(page.getByText(/Built from 10 of the plan's 14 rows/)).toBeVisible();
});

test("AC-07: a second PDF with the rest of the pages builds one plan with 15 tasks", async ({ page }) => {
  await page.goto("/quick");
  await openCarePlanText(page, fixtureText("B-page1-of-2"));
  await expect(page.getByText("This PDF has 10 of the plan's 16 rows")).toBeVisible();

  await openCarePlanText(page, fixtureText("B-page2-of-2"), "care-plan-2.pdf");
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  await expect(page.getByText("Our total from these tasks matches Fusion's 455 units for a 30-day month. Fusion counts the days in each month for daily tasks, so a 31-day month has 469 and a 28-day month 434.")).toBeVisible();
  await expect(page.getByText("15 + transportation")).toBeVisible();
});

test("AC-08: the PDF with a banner builds like AC-02; the table-only PDF asks for dates", async ({ page }) => {
  await page.goto("/quick");
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  await expect(page.getByText("Read from Fusion · DCN 10000002")).toBeVisible();
  await expect(statusPanel(page)).toContainText("Ready to use");

  await page.getByRole("button", { name: "New care plan" }).first().click();
  await openCarePlan(page, fixturePdf("fusion-table-only"));
  await expect(page.getByText("Enter the plan dates")).toBeVisible();
  await page.getByLabel("Plan starts").fill("2026-01-01");
  await page.getByLabel("Plan ends").fill("2026-12-31");
  await page.getByRole("button", { name: "Use these dates" }).click();
  await expect(page.getByRole("heading", { name: "Care plan from Fusion" })).toBeVisible();
});

test("AC-24: Fusion's care plan report PDF builds the plan and leaves out the nurse visits", async ({ page }) => {
  await page.goto("/quick");
  await openCarePlan(page, fixturePdf("fusion-care-plan-report"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT E" })).toBeVisible();
  await expect(page.getByText("Read from Fusion · DCN 10000005")).toBeVisible();
  await expect(page.getByText("Our total from these tasks matches Fusion's 229 units a month.")).toBeVisible();
  await expect(
    page.getByText("GHE (General Health Evaluation) is a nurse visit, so it's listed by month, not in the week."),
  ).toBeVisible();
  await expect(statusPanel(page)).toContainText("Ready to use");
});

test("AC-09: a PDF with no care plan in it says so, and a file that isn't a PDF is refused", async ({ page }) => {
  await page.goto("/quick");
  await openCarePlanText(page, "Meeting notes from Tuesday", "notes.pdf");
  await expect(page.getByText("We couldn't find care plan tasks in that PDF")).toBeVisible();
  await expect(page.getByText("Open the participant's care plan PDF from Fusion.")).toBeVisible();

  // The chooser offers PDFs only; a text file that reaches it anyway (dropped on the box) is refused.
  await expect(page.locator(PDF_CHOOSER)).toHaveAttribute("accept", "application/pdf,.pdf");
  await page.locator(PDF_CHOOSER).setInputFiles({
    name: "care-plan.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(fixtureText("D-page1-only-incomplete")),
  });
  await expect(page.getByText("That isn't a PDF")).toBeVisible();
  await expect(page.getByText("Choose the care plan PDF you saved from Fusion.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT D" })).toHaveCount(0);
  // PDF only: no text box to put a care plan in.
  await expect(page.getByRole("region", { name: "Open the care plan PDF from Fusion" }).getByRole("textbox")).toHaveCount(0);
});

test("AC-11: a reload keeps the plan without the DCN; a new tab starts with the example", async ({ page, context }) => {
  await page.goto("/quick");
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  await page.waitForFunction(() => sessionStorage.getItem("cps.quick.v3")?.includes("Laundry (Off Site)"));

  await page.reload();
  await expect(page.getByRole("heading", { name: "Care plan from Fusion" })).toBeVisible();
  await expect(page.getByText(/· DCN/)).toHaveCount(0);

  const secondTab = await context.newPage();
  await secondTab.clock.setFixedTime(FIXED_TIME);
  await secondTab.goto("/quick");
  await expect(secondTab.getByRole("heading", { name: "Open the care plan PDF from Fusion" })).toBeVisible();
  await expect(secondTab.getByRole("heading", { name: "Example care plan" })).toBeVisible();
});

test("AC-12: by hand, from the keyboard, with transportation and a service change", async ({ page }) => {
  await page.goto("/quick");
  await expect(page.getByRole("heading", { name: "Example care plan" })).toBeVisible();

  // Keyboard only: Tab to "Build a schedule by hand" and press Enter; the picker gets focus.
  const byHand = page.getByRole("button", { name: "Build a schedule by hand" });
  for (let presses = 0; presses < 40 && !(await byHand.evaluate((el) => el === document.activeElement)); presses++) {
    await page.keyboard.press("Tab");
  }
  await expect(byHand).toBeFocused();
  await page.keyboard.press("Enter");
  const picker = page.getByRole("combobox", { name: "Add a task" });
  await expect(picker).toBeFocused();
  await expect(page.getByRole("heading", { name: "Open the care plan PDF from Fusion" })).toBeHidden();

  await page.keyboard.type("dress");
  await expect(page.getByRole("option", { name: "Dressing/Grooming" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  const dressing = page.getByRole("group", { name: "Dressing/Grooming", exact: true });
  await expect(dressing.getByRole("textbox", { name: "Minutes per day" })).toBeFocused();

  await picker.focus();
  await page.keyboard.type("clean bath");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: "Clean Bath", exact: true })).toBeVisible();

  // 60-minute transportation once a week.
  await expect(page.getByRole("combobox", { name: "Trips per week" })).toHaveValue("1");
  await page.getByRole("textbox", { name: "Minutes per trip" }).fill("60");
  await page.keyboard.press("Tab");
  await expect(
    page.getByText("300 minutes a month = 20 units. These come off the monthly units before tasks."),
  ).toBeVisible();

  // Homemaker (ADW) has no Dressing/Grooming: it's removed with a toast.
  await page.getByRole("combobox", { name: "Authorized service" }).selectOption("S5130");
  await expect(
    page.getByRole("status").filter({ hasText: "Removed 1 task that isn't part of Homemaker (ADW)" }).first(),
  ).toBeVisible();
  await expect(dressing).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Clean Bath", exact: true })).toBeVisible();
});

test("AC-14: public pages load no Firebase, pdf.js or Google requests", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));

  for (const path of ["/", "/quick", "/rules"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }

  const external = urls.filter((url) => !url.startsWith("http://127.0.0.1:4173"));
  expect(external).toEqual([]);
  const forbidden = urls.filter((url) => /firebase|pdf\.worker|readPdf|google|gstatic|googleapis/i.test(url));
  expect(forbidden).toEqual([]);
});

test("AC-14: opening a PDF requests only same-origin files", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));

  await page.goto("/quick");
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  const external = urls.filter((url) => !url.startsWith("http://127.0.0.1:4173"));
  expect(external).toEqual([]);
});

test("AC-15: the participant's name and DCN never reach storage or the console", async ({ page }) => {
  const consoleText: string[] = [];
  page.on("console", (message) => consoleText.push(message.text()));
  page.on("pageerror", (error) => consoleText.push(String(error)));

  const expectNothingStored = async () => {
    await page.waitForTimeout(400); // the 300 ms save debounce (APP-SPEC 5.6)
    const stored = await page.evaluate(() =>
      [sessionStorage, localStorage].flatMap((storage) =>
        Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`),
      ),
    );
    for (const text of [stored.join("\n"), consoleText.join("\n")]) {
      expect(text).not.toContain("10000002");
      expect(text).not.toContain("10000004");
      expect(text).not.toContain("10000005");
      expect(text).not.toContain("SAMPLE PARTICIPANT");
    }
  };

  // Opened (AC-02), a cell refused and changed (AC-04, AC-05).
  await page.goto("/quick");
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  await page.waitForFunction(() => sessionStorage.getItem("cps.quick.v3")?.includes("Laundry (Off Site)"));
  await changeCell(page, "Bathing", "Monday", 45, 30);
  await changeCell(page, "Bathing", "Tuesday", 45, 60);
  await page.getByRole("button", { name: "Use 55 minutes" }).click();
  await expect(page.getByRole("button", { name: "Bathing, Tuesday, 55 minutes. Change minutes" })).toBeVisible();
  await expectNothingStored();

  // On to January 2026; the viewed month is saved.
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByLabel("Units in January 2026")).toBeVisible();
  await page.waitForFunction(() => sessionStorage.getItem("cps.quick.v3")?.includes('"viewMonth":"2026-01"'));
  await expectNothingStored();

  // An incomplete PDF (AC-06).
  await page.getByRole("button", { name: "New care plan" }).first().click();
  await openCarePlanText(page, fixtureText("D-page1-only-incomplete"));
  await page.getByRole("button", { name: "Build with the 10 rows I have" }).click();
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT D" })).toBeVisible();
  await expectNothingStored();

  // B in two PDFs (AC-07).
  await page.getByRole("button", { name: "New care plan" }).first().click();
  await openCarePlanText(page, fixtureText("B-page1-of-2"));
  await expect(page.getByText("This PDF has 10 of the plan's 16 rows")).toBeVisible();
  await expectNothingStored();
  await openCarePlanText(page, fixtureText("B-page2-of-2"), "care-plan-2.pdf");
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  await expectNothingStored();

  // The PDFs (AC-08): with the banner, then the table only with the dates entered.
  await page.getByRole("button", { name: "New care plan" }).first().click();
  await openCarePlan(page, fixturePdf("fusion-table-with-banner"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT B" })).toBeVisible();
  await expectNothingStored();
  await page.getByRole("button", { name: "New care plan" }).first().click();
  await openCarePlan(page, fixturePdf("fusion-table-only"));
  await page.getByLabel("Plan starts").fill("2026-01-01");
  await page.getByLabel("Plan ends").fill("2026-12-31");
  await page.getByRole("button", { name: "Use these dates" }).click();
  await expect(page.getByRole("heading", { name: "Care plan from Fusion" })).toBeVisible();
  await expectNothingStored();

  // Fusion's care plan report (AC-24).
  await page.getByRole("button", { name: "New care plan" }).first().click();
  await openCarePlan(page, fixturePdf("fusion-care-plan-report"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT E" })).toBeVisible();
  await expectNothingStored();
});

test("AC-19: no page scroll at phone size; the grid scrolls inside its panel", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone viewport only");
  await page.goto("/quick");
  // Measure the page once Quick Schedule (a lazy chunk) has rendered, not the empty shell.
  await expect(page.getByRole("heading", { name: "Example care plan" })).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewport = page.viewportSize()?.width ?? 0;
  expect(scrollWidth).toBeLessThanOrEqual(viewport);

  const gridWrap = page.locator(".overflow-x-auto", { has: page.getByRole("table", { name: "Weekly schedule" }) });
  await expect(gridWrap).toBeVisible();
  expect(await gridWrap.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

  // The PDF chooser sits under its heading and inside the screen, with the examples below it.
  const heading = (await page.getByRole("heading", { name: "Open the care plan PDF from Fusion" }).boundingBox())!;
  const chooser = (await page.locator("label", { has: page.locator(PDF_CHOOSER) }).boundingBox())!;
  const examples = (await page.getByRole("button", { name: "5-day plan" }).boundingBox())!;
  expect(chooser.y).toBeGreaterThanOrEqual(heading.y + heading.height);
  expect(chooser.x).toBeGreaterThanOrEqual(0);
  expect(chooser.x + chooser.width).toBeLessThanOrEqual(viewport);
  expect(examples.y).toBeGreaterThanOrEqual(chooser.y + chooser.height);
});



test("AC-27: the printout is one US Letter landscape page, made in the browser from same-origin files", async ({ page, isMobile }) => {
  test.skip(isMobile, "the PDF is the same at any width; covered on desktop");
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await buildB(page);

  // Save as PDF: the file name carries the date only, never the participant's name or DCN.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save as PDF" }).click()]);
  expect(download.suggestedFilename()).toBe("Care schedule 2025-11-20.pdf");
  const pdf = await PDFDocument.load(readFileSync(await download.path()));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getSize()).toEqual({ width: 792, height: 612 });
  expect(pdf.getTitle()).toBe("Weekly care schedule");

  // Print schedule in a browser that shows no PDFs (this headless one): the same file, named, no tab.
  expect(await page.evaluate(() => navigator.pdfViewerEnabled)).toBe(false);
  let tabs = 0;
  page.on("popup", () => tabs++);
  const [printed] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Print schedule" }).click()]);
  expect(printed.suggestedFilename()).toBe("Care schedule 2025-11-20.pdf");
  expect(tabs).toBe(0);

  // pdf-lib, fontkit and the fonts come from this site, and only when printing.
  expect(urls.filter((url) => !url.startsWith("http://127.0.0.1:4173") && !url.startsWith("blob:"))).toEqual([]);
  expect(urls.some((url) => /public-sans-latin-700-normal-[\w-]+\.woff$/.test(url))).toBe(true);
});

test("AC-27: Print schedule opens the PDF in a new tab where the browser shows PDFs", async ({ page, isMobile }) => {
  test.skip(isMobile, "the same at any width; covered on desktop");
  // Chrome, Edge, Firefox and Safari show PDFs; this headless browser doesn't, so it says it does.
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "pdfViewerEnabled", { get: () => true }));
  await buildB(page);

  const [tab] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Print schedule" }).click()]);
  // The tab is sent to the PDF; with no viewer to show it, this browser hands it over as a download.
  const shown = await tab.waitForEvent("download");
  expect(shown.url()).toMatch(/^blob:http:\/\/127\.0\.0\.1:4173\//);
  const pdf = await PDFDocument.load(readFileSync(await shown.path()));
  expect(pdf.getPageCount()).toBe(1);
});

test("two panes side by side: no Skip to the schedule link", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop viewport only; the phone test clicks the link");
  await page.goto("/quick");
  await expect(page.getByRole("heading", { name: "Example care plan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Skip to the schedule" })).toBeHidden();
});

test("AC-28: a care plan report with several services is one schedule for the participant", async ({ page }) => {
  await page.goto("/quick");
  await openCarePlanText(page, fixtureText("F-care-plan-report-multi"));
  await expect(page.getByRole("heading", { name: "SAMPLE PARTICIPANT F" })).toBeVisible();
  await expect(page.getByText("Choose the one to schedule")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Whole care plan/, pressed: true })).toBeVisible();

  // Each authorization with its own units, in one week.
  const authorizations = page.getByRole("table", { name: /Each service's authorization/ });
  await expect(authorizations).toContainText("226 units in");
  await expect(authorizations).toContainText("40 units in");
  await expect(authorizations).toContainText("5 units in");
  const week = page.locator("section", { has: page.getByRole("heading", { name: "The participant's week" }) });
  await expect(week.getByRole("region", { name: "Thursday" })).toContainText("Wash Windows/Blinds");
  await expect(week.getByRole("region", { name: "Friday" })).toContainText("Essential transportation");

  // The nurse visits, by month. On Nov 20, 2025 both are still to come.
  const visits = page.locator("section", { has: page.getByRole("heading", { name: "Nurse visits" }) });
  await expect(visits).toContainText("May 2026");
  await expect(visits).toContainText("August 2026");

  // A service opens in detail on the same page, and the whole plan is one click back.
  await page.getByRole("button", { name: "Open PC - Agency" }).click();
  await expect(statusPanel(page)).toContainText("Ready to use");
  await page.getByRole("button", { name: /Whole care plan/ }).click();
  await expect(page.getByRole("heading", { name: "The participant's week" })).toBeVisible();
});
