import { beforeAll, describe, expect, it } from "vitest";
import { parseFusionText, textItemsToLines, type PdfTextItem } from "../src/index.js";
import { B_TASKS, PACK, fixtureText, pdfPages, tupleOf } from "./helpers.js";

describe("IMP-T14 fusion-table-with-banner.pdf", () => {
  let pages: PdfTextItem[][];
  beforeAll(async () => {
    pages = await pdfPages("fusion-table-with-banner.pdf");
  });

  it("has one page of text", () => {
    expect(pages).toHaveLength(1);
    expect(pages[0]!.length).toBeGreaterThan(100);
  });

  it("reads the same as fixture B (IMP-T02)", () => {
    const fromPdf = parseFusionText(textItemsToLines(pages), PACK);
    const fromPaste = parseFusionText(fixtureText("B-tabbed-7day-455.txt"), PACK);
    expect(tupleOf(fromPdf.services[0]!.tasks)).toEqual(B_TASKS);
    expect(fromPdf.services[0]!.transport).toEqual({ unitsPerMonth: 23, minutesPerMonth: 345 });
    expect(fromPdf.participant).toEqual({ name: "SAMPLE PARTICIPANT B", dcn: "10000002" });
    expect(fromPdf.plan).toEqual({ start: "2025-12-01", end: "2026-10-31" });
    expect(fromPdf.totalCost).toBe("2436.53");
    expect(fromPdf.issues).toEqual([]);
    expect(fromPdf.services).toEqual(fromPaste.services);
  });
});

describe("IMP-T15 fusion-table-only.pdf", () => {
  let pages: PdfTextItem[][];
  beforeAll(async () => {
    pages = await pdfPages("fusion-table-only.pdf");
  });

  it("reads 15 tasks and transportation of 345 minutes, with no participant", () => {
    const result = parseFusionText(textItemsToLines(pages), PACK);
    expect(tupleOf(result.services[0]!.tasks)).toEqual(B_TASKS);
    expect(result.services[0]!.transport).toEqual({ unitsPerMonth: 23, minutesPerMonth: 345 });
    expect(result.participant).toBeNull();
  });

  it("asks for the plan dates, and nothing else", () => {
    const result = parseFusionText(textItemsToLines(pages), PACK);
    expect(result.plan).toBeNull();
    expect(result.issues).toEqual([
      { level: "input", code: "no-plan-dates", message: "The plan dates weren't included. Enter them from Fusion." },
    ]);
  });
});

describe("IMP-14 textItemsToLines", () => {
  const item = (str: string, x: number, y: number, width = 10, height = 10): PdfTextItem => ({
    str, x, y, width, height,
  });

  it("puts items on the same line when their baselines are within half the font height", () => {
    // b is 5 below a (exactly half of 10): same line. c is 5.1 below a: next line.
    expect(textItemsToLines([[item("a", 0, 100), item("b", 10, 95), item("c", 20, 94.9)]])).toBe("ab\nc");
  });

  it("starts a new line when the baselines differ by more than half the font height", () => {
    expect(textItemsToLines([[item("a", 0, 100), item("b", 10, 94)]])).toBe("a\nb");
  });

  it("reads lines top to bottom and items left to right", () => {
    const page = [item("low", 0, 10), item("right", 50, 90), item("top", 0, 90), item("mid", 0, 50)];
    expect(textItemsToLines([page])).toBe("top\tright\nmid\nlow");
  });

  it("joins with a tab for a gap over 0.8 of the font height", () => {
    // gap = 30 - (0 + 10) = 20 > 8
    expect(textItemsToLines([[item("a", 0, 0), item("b", 30, 0)]])).toBe("a\tb");
    // gap 8.1 is over 0.8 × 10; a gap of exactly 8 is not
    expect(textItemsToLines([[item("a", 0, 0), item("b", 18.1, 0)]])).toBe("a\tb");
    expect(textItemsToLines([[item("a", 0, 0), item("b", 18, 0)]])).toBe("a b");
  });

  it("joins with a space for a gap over 0.15 of the font height, up to 0.8", () => {
    // gap 5 → space; gap 1.6 → space; gap 1.5 (exactly 0.15 × 10) → nothing
    expect(textItemsToLines([[item("a", 0, 0), item("b", 15, 0)]])).toBe("a b");
    expect(textItemsToLines([[item("a", 0, 0), item("b", 11.6, 0)]])).toBe("a b");
    expect(textItemsToLines([[item("a", 0, 0), item("b", 11.5, 0)]])).toBe("ab");
  });

  it("joins with nothing for touching or overlapping items", () => {
    expect(textItemsToLines([[item("a", 0, 0), item("b", 10, 0)]])).toBe("ab");
    expect(textItemsToLines([[item("a", 0, 0), item("b", 9.9, 0)]])).toBe("ab");
  });

  it("measures the gap against the larger font height of the two items", () => {
    // gap 5: against 10 it is a space (0.15..0.8 of 10); against 5 it would be a tab (> 4)
    expect(textItemsToLines([[item("a", 0, 0, 10, 5), item("b", 15, 0, 10, 10)]])).toBe("a b");
  });

  it("ignores empty text items and blank lines", () => {
    expect(textItemsToLines([[item("", 0, 100), item("a", 0, 50), item("  ", 0, 20)]])).toBe("a");
  });

  it("joins pages with a newline", () => {
    expect(textItemsToLines([[item("one", 0, 0)], [item("two", 0, 0)]])).toBe("one\ntwo");
  });

  it("gives an empty string for a PDF with no text (a scan)", () => {
    expect(textItemsToLines([])).toBe("");
    expect(textItemsToLines([[], [item("", 0, 0)]])).toBe("");
  });

  it("does not change the items it is given", () => {
    const page = [item("b", 30, 0), item("a", 0, 0)];
    const before = JSON.stringify(page);
    textItemsToLines([page]);
    expect(JSON.stringify(page)).toBe(before);
  });
});
