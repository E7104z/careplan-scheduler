// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { parseFusionText, textItemsToLines, type ImportResult, type PdfTextItem } from "@careplan/import";
import { textPdf } from "../../e2e/public/textPdf";

const FIXTURES = fileURLToPath(new URL("../../../../docs/fixtures/fusion/", import.meta.url));

/** What pdf.js gives readPdf, turned into text the way readPdf does (IMP-14). */
async function readBack(pdf: Uint8Array): Promise<string> {
  const doc = await getDocument({ data: pdf, isEvalSupported: false, verbosity: 0 }).promise;
  try {
    const pages: PdfTextItem[][] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const content = await (await doc.getPage(pageNumber)).getTextContent();
      pages.push(
        content.items.flatMap((item) => {
          if (!("str" in item)) return [];
          const [, , , d = 0, x = 0, y = 0] = (item as TextItem).transform as number[];
          return [{ str: item.str, x, y, width: item.width, height: Math.abs(d) }];
        }),
      );
    }
    return textItemsToLines(pages);
  } finally {
    await doc.destroy();
  }
}

/** What was read, without where: the PDF's page and line numbers are its own (SOURCE-01). */
function content(result: ImportResult): unknown {
  return JSON.parse(
    JSON.stringify(result, (key, value: unknown) => (key === "source" || key === "raw" || key === "rows" ? undefined : value)),
  );
}

// The text fixtures the browser tests open as PDFs built by textPdf (PDF-2).
const NAMES = [
  "B-tabbed-7day-455",
  "B-page1-of-2",
  "B-page2-of-2",
  "C-rows-only-older-plan-402",
  "D-page1-only-incomplete",
  "E-care-plan-report-229",
  "F-care-plan-report-multi",
  "G-care-plan-report-kept",
  "P-TEST-APC-PC-4DAY",
];

describe("textPdf: a PDF built from a text fixture reads back as that fixture", () => {
  it.each(NAMES)("%s", async (name) => {
    const text = readFileSync(`${FIXTURES}${name}.txt`, "utf8");
    const fromPdf = parseFusionText(await readBack(await textPdf(text)), MO_2026_07);
    const fromText = parseFusionText(text, MO_2026_07);
    expect(fromText.services.length + fromText.others.length).toBeGreaterThan(0);
    expect(content(fromPdf)).toEqual(content(fromText));
  });

  it("keeps a row's cells apart and a cell's words together", async () => {
    expect(await readBack(await textPdf("455 units\tAsst. with Toileting\t10\t7\nsecond line"))).toBe(
      "455 units\tAsst. with Toileting\t10\t7\nsecond line",
    );
  });

  it("text with no care plan in it reads back with no care plan in it", async () => {
    const result = parseFusionText(await readBack(await textPdf("Meeting notes from Tuesday")), MO_2026_07);
    expect(result.issues.map((issue) => issue.code)).toEqual(["no-rows"]);
  });

  it("a long plan goes over several pages and still reads in order", async () => {
    const lines = Array.from({ length: 120 }, (_, index) => `line ${index + 1}`);
    expect(await readBack(await textPdf(lines.join("\n")))).toBe(lines.join("\n"));
  });
});
