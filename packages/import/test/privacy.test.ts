import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from "vitest";
import { mergeFusionText, parseFusionText, textItemsToLines, type ImportResult, type PdfTextItem } from "../src/index.js";
import { FIXTURE_NAMES, PACK, fixtureText, pdfPages } from "./helpers.js";

// IMP-16 / .clinerules I-1, I-3: the reader is pure. It never writes to storage or the console,
// and its messages never carry a participant's name or DCN.

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace", "dir", "table"] as const;
const STORAGE_METHODS = ["getItem", "setItem", "removeItem", "clear", "key"] as const;
const STORAGES = ["localStorage", "sessionStorage"] as const;

function stubStorage(): Storage {
  return {
    length: 0,
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
  };
}

const spies: MockInstance[] = [];
const pdfTexts: string[] = [];
const results: ImportResult[] = [];

beforeAll(async () => {
  // Read the PDFs first: pdf.js may log, and it is not part of the reader.
  for (const name of ["fusion-table-with-banner.pdf", "fusion-table-only.pdf"]) {
    pdfTexts.push(textItemsToLines(await pdfPages(name)));
  }

  for (const name of STORAGES) {
    if (typeof globalThis[name] === "undefined") vi.stubGlobal(name, stubStorage());
    for (const method of STORAGE_METHODS) spies.push(vi.spyOn(globalThis[name], method));
  }
  for (const method of CONSOLE_METHODS) spies.push(vi.spyOn(console, method));
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("IMP-T19 privacy", () => {
  it("reads every fixture, and merges pages, without touching storage or the console", () => {
    const texts = FIXTURE_NAMES.map(fixtureText);
    for (const text of [...texts, ...pdfTexts]) results.push(parseFusionText(text, PACK));
    results.push(mergeFusionText([fixtureText("B-page1-of-2.txt"), fixtureText("B-page2-of-2.txt")], PACK));
    // Even the paths that report a problem: a refused page, a repeated page, garbage.
    results.push(mergeFusionText([texts[1]!, texts[0]!], PACK));
    results.push(mergeFusionText([texts[1]!, texts[1]!], PACK));
    results.push(parseFusionText("not a care plan", PACK));

    const item: PdfTextItem = { str: "x", x: 0, y: 0, width: 5, height: 10 };
    textItemsToLines([[item, { ...item, x: 50 }], [item]]);

    expect(results.length).toBeGreaterThan(8);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("watches every storage method and every console method", () => {
    expect(spies).toHaveLength(STORAGES.length * STORAGE_METHODS.length + CONSOLE_METHODS.length);
  });

  it("never puts a participant's name or DCN in an issue", () => {
    const issueText = results.map((result) => JSON.stringify(result.issues)).join("\n");
    expect(issueText).not.toMatch(/SAMPLE PARTICIPANT/i);
    expect(issueText).not.toMatch(/1000000\d/);
    // The issues were not empty, so the check above saw real messages.
    expect(issueText).toContain("different participant");
  });
});
