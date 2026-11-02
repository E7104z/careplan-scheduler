// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { MO_2026_07 } from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { fromFusion } from "../../src/features/import/fromFusion";
import { manualState, reduce } from "../../src/features/quick-schedule/state";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { buildScheduleSheet, type ScheduleSheet } from "../../src/features/quick-schedule/scheduleSheet";
import { MARGIN, PAGE_HEIGHT, PAGE_WIDTH, printPalette, renderSchedulePdf, type FontFiles } from "../../src/features/quick-schedule/schedulePdf";
import type { QuickState } from "../../src/features/quick-schedule/types";
import tokensCss from "../../src/styles/tokens.css?raw";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";
import fixtureE from "@fixtures/fusion/E-care-plan-report-229.txt?raw";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { planSheets } from "../../src/features/quick-schedule/planSheet";

const require = createRequire(import.meta.url);
const font = (weight: number) =>
  new Uint8Array(readFileSync(require.resolve(`@fontsource/public-sans/files/public-sans-latin-${weight}-normal.woff`)));
const FONTS: FontFiles = { regular: font(400), semibold: font(600), bold: font(700) };
const NOW = new Date("2025-11-20T12:00:00-06:00");

interface Placed {
  text: string;
  left: number;
  right: number;
  /** From the top of the page, as the layout reads. */
  top: number;
  bottom: number;
}

interface ReadBack {
  pages: number;
  size: number[];
  text: string;
  items: Placed[];
  title: unknown;
}

/** Opens the PDF with pdf.js, as a browser's viewer does, and reads where each piece of text is. */
async function readBack(bytes: Uint8Array): Promise<ReadBack> {
  const pdf = await getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const items = (content.items as TextItem[])
    .filter((item) => item.str.trim() !== "")
    .map((item) => {
      const size = Math.hypot(item.transform[2]!, item.transform[3]!);
      const baseline = PAGE_HEIGHT - item.transform[5]!;
      return { text: item.str, left: item.transform[4]!, right: item.transform[4]! + item.width, top: baseline - size * 0.72, bottom: baseline };
    });
  const { info } = await pdf.getMetadata();
  const result = {
    pages: pdf.numPages,
    size: page.view,
    text: items.map((item) => item.text).join(" | "),
    items,
    title: (info as Record<string, unknown>).Title,
  };
  await pdf.destroy();
  return result;
}

function sheetFor(state: QuickState, today = "2025-11-20"): ScheduleSheet {
  return buildScheduleSheet(state, buildQuickModel(state, MO_2026_07), MO_2026_07, today);
}

/** Every piece of text sits inside the margins, and no two overlap. */
function expectTidy(items: Placed[]): void {
  for (const item of items) {
    expect(item.left, item.text).toBeGreaterThanOrEqual(MARGIN - 0.5);
    expect(item.right, item.text).toBeLessThanOrEqual(PAGE_WIDTH - MARGIN + 0.5);
    expect(item.top, item.text).toBeGreaterThanOrEqual(MARGIN - 0.5);
    expect(item.bottom, item.text).toBeLessThanOrEqual(PAGE_HEIGHT - MARGIN + 0.5);
  }
  const overlaps: string[] = [];
  items.forEach((a, i) => {
    for (const b of items.slice(i + 1)) {
      const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (across > 0.5 && down > 0.5) overlaps.push(`"${a.text}" and "${b.text}"`);
    }
  });
  expect(overlaps).toEqual([]);
}

/** A plan built by hand with every CDS task (25) and transportation: the most rows a week can have. */
function everyCdsTask(): QuickState {
  let state = manualState(new Date("2026-10-21T12:00:00-05:00"));
  for (const task of MO_2026_07.tasks.filter((candidate) => candidate.programs.includes("CDS") && !candidate.isTransport)) {
    state = reduce(state, { type: "addTask", taskCode: task.taskCode, name: task.name }, MO_2026_07).state;
  }
  return reduce(state, { type: "setTransportMinPerTrip", value: 30 }, MO_2026_07).state;
}

describe("printed schedule: the PDF", () => {
  it("is one US Letter page in landscape, titled without the participant's name", async () => {
    const bytes = await renderSchedulePdf(sheetFor(fromFusion(parseFusionText(fixtureB, MO_2026_07), 0, NOW)), FONTS, NOW);
    const pdf = await readBack(bytes);
    expect(pdf.pages).toBe(1);
    expect(pdf.size).toEqual([0, 0, 792, 612]);
    expect(pdf.title).toBe("Weekly care schedule");
  });

  it("B: the participant, Sunday to Saturday, each visit's length, the months and the check line", async () => {
    const pdf = await readBack(await renderSchedulePdf(sheetFor(fromFusion(parseFusionText(fixtureB, MO_2026_07), 0, NOW)), FONTS, NOW));
    for (const text of [
      "SAMPLE PARTICIPANT B", "10000002", "PC - CDS · T1019U2", "Dec 1, 2025 to Oct 31, 2026", "455 for a 30-day month",
      "TEST HOME CARE LLC", "20250000000002", "Ready to use",
      "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
      "Assistance with Toileting", "Wash Dishes", "Essential transportation", "Visit length", "5 h 15 min", "3 h 55 min",
      "15 + 10 min", "25 h 25 min", "1,465", "Follows every rule we check, for all 11 months.",
      "Units by month", "Dec 2025", "Oct 2026", "461 + 5 min", "Reviewed with the participant", "Date",
      "Checked with CarePlan Scheduler under rule pack mo-2026-07 on Nov 20, 2025",
      "Set each EVV visit window to its visit length.",
    ]) {
      expect(pdf.text).toContain(text);
    }
    expectTidy(pdf.items);
  });

  it("B: each day's minutes sit centered under the day's name", async () => {
    const pdf = await readBack(await renderSchedulePdf(sheetFor(fromFusion(parseFusionText(fixtureB, MO_2026_07), 0, NOW)), FONTS, NOW));
    const center = (item: Placed) => (item.left + item.right) / 2;
    const named = (text: string) => pdf.items.find((item) => item.text === text)!;
    // Laundry (Off Site) is Monday's 140, Essential Correspondence Tuesday's 30, transportation Sunday's 60.
    expect(Math.abs(center(named("140")) - center(named("Monday")))).toBeLessThan(0.5);
    expect(Math.abs(center(named("30")) - center(named("Tuesday")))).toBeLessThan(0.5);
    expect(Math.abs(center(named("60")) - center(named("Sunday")))).toBeLessThan(0.5);
  });

  it("E: three care days; the others say No visit", async () => {
    const state = fromFusion(parseFusionText(fixtureE, MO_2026_07), 0, new Date("2026-03-15T12:00:00-05:00"));
    const pdf = await readBack(await renderSchedulePdf(sheetFor(state, "2026-03-15"), FONTS, NOW));
    expect(pdf.pages).toBe(1);
    expect(pdf.items.filter((item) => item.text === "No visit")).toHaveLength(4);
    expect(pdf.text).toContain("Not a care day");
    expectTidy(pdf.items);
  });

  it("the most a week can hold: every CDS task, transportation, checks and lines to write the name on", async () => {
    const state = everyCdsTask();
    const sheet = sheetFor(state, "2026-10-21");
    expect(sheet.rows).toHaveLength(26);
    expect(sheet.checks.length).toBeGreaterThan(0);
    const pdf = await readBack(await renderSchedulePdf(sheet, FONTS, NOW));
    expect(pdf.pages).toBe(1);
    expect(pdf.text).toContain("Participant");
    expect(pdf.text).toContain("Clean/Maintain Equipment");
    expectTidy(pdf.items);
  });

  it("long names, a long provider, twelve months cut at the end and more checks than fit stay on the page", async () => {
    const base = sheetFor(fromFusion(parseFusionText(fixtureB.replaceAll("455 units", "440 units"), MO_2026_07), 0, NOW));
    const sheet: ScheduleSheet = {
      ...base,
      name: "PARTICIPANT WITH A VERY LONG FIRST, MIDDLE AND LAST NAME FOR THE TEST",
      facts: [...base.facts.slice(0, 4), { label: "Provider", value: "A HOME CARE PROVIDER WITH A VERY LONG REGISTERED NAME LLC" }, ...base.facts.slice(5)],
      rows: base.rows.map((row, index) => (index % 4 === 0 ? { ...row, name: `${row.name} with a much longer name from Fusion` } : row)),
      months: [...base.months, { ...base.months[0]!, label: "Nov 2026" }],
      checks: Array.from({ length: 12 }, (_, index) => ({
        severity: (["BLOCK", "REVIEW", "WARN"] as const)[index % 3]!,
        label: ["Must fix", "Needs review", "Worth checking"][index % 3]!,
        title: "More units than this service allows in the month",
        context: "Bathing, every month of the plan",
      })),
      reviewed: "Nov 19, 2025",
    };
    const pdf = await readBack(await renderSchedulePdf(sheet, FONTS, NOW));
    expect(pdf.pages).toBe(1);
    expect(pdf.text).toMatch(/And \d+ more checks\. See Checks in Quick Schedule\./);
    expect(pdf.text).toContain("Nov 19, 2025");
    expect(pdf.text).toContain("When a month's units run out");
    expectTidy(pdf.items);
  });

  it("APP-SPEC 5.8: a plan of several services prints the whole week, then a page for each service", async () => {
    const outcome = next(addPage(emptyImportFlow(), fixtureF), MO_2026_07, new Date("2026-10-21T12:00:00-05:00"));
    if (outcome.kind !== "ready") throw new Error("Expected a ready outcome");
    const models = outcome.plan.services.map((state) => buildQuickModel(state, MO_2026_07));
    const sheets = planSheets(outcome.plan, models, MO_2026_07, "2026-10-21");
    const pdf = await readBack(await renderSchedulePdf(sheets, FONTS, NOW));
    expect(pdf.pages).toBe(4);
    for (const text of [
      "SAMPLE PARTICIPANT F", "Services", "PC - Agency, PC - CDS, HC", "Feb 1, 2026 to Oct 31, 2026", "Nurse visits",
      "May 2026 and Aug 2026", "Dietary", "Essential transportation", "Wash Windows/Blinds", "Ready to use",
      "226 units in Oct · PA 20260000000011", "14 h 10 min", "Day total", "No service", "Service days this week",
      "Each service's own page has its visit lengths for EVV.",
    ]) {
      expect(pdf.text).toContain(text);
    }
    expect(pdf.text).not.toContain("Units by month");
    expect(pdf.text).not.toContain("Visit length");
    expectTidy(pdf.items);
  });

  it("APP-SPEC 5.8: the plan page warns when the week has more service days than planned", async () => {
    const outcome = next(addPage(emptyImportFlow(), fixtureF), MO_2026_07, new Date("2026-10-21T12:00:00-05:00"));
    if (outcome.kind !== "ready") throw new Error("Expected a ready outcome");
    // Move CDS transportation onto Saturday: six service days, still five planned.
    outcome.plan.services[1]!.transport.day = 6;
    const models = outcome.plan.services.map((state) => buildQuickModel(state, MO_2026_07));
    const sheets = planSheets(outcome.plan, models, MO_2026_07, "2026-10-21");
    if (!Array.isArray(sheets)) throw new Error("Expected a plan of several services");
    const plan = sheets[0]!;
    expect(plan.warning).toBe("This week has more service days than the plan's 5 days a week. Check each service's care days.");
    const pdf = await readBack(await renderSchedulePdf(sheets, FONTS, NOW));
    expect(pdf.text).toContain("This week has more service days than the plan's 5 days a week");
    expectTidy(pdf.items);
  });

  it("takes its colors from tokens.css, light theme (paper is white whatever the screen)", () => {
    const palette = printPalette(tokensCss);
    // --brand: #26348C
    expect(palette.brand).toEqual({ type: "RGB", red: 0x26 / 255, green: 0x34 / 255, blue: 0x8c / 255 });
    expect(() => printPalette(":root {\n  --ink: #161B26;\n}")).toThrow("tokens.css has no light value for --sunk");
  });
});
