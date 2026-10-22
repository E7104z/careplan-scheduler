import type { PdfTextItem } from "./types.js";

/** Group items into lines by baseline: the same line when |Δy| ≤ 0.5 × the font height. Top line first. */
function groupLines(items: PdfTextItem[]): PdfTextItem[][] {
  const lines: PdfTextItem[][] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y)) {
    const line = lines[lines.length - 1];
    const first = line?.[0];
    if (line && first && Math.abs(first.y - item.y) <= 0.5 * Math.max(first.height, item.height)) {
      line.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines;
}

/** Left to right; a tab when the gap is more than 0.8 × the font height, a space when more than 0.15 ×. */
function joinLine(items: PdfTextItem[]): string {
  let text = "";
  let previous: PdfTextItem | undefined;
  for (const item of [...items].sort((a, b) => a.x - b.x)) {
    if (previous) {
      const gap = item.x - (previous.x + previous.width);
      const height = Math.max(previous.height, item.height);
      text += gap > 0.8 * height ? "\t" : gap > 0.15 * height ? " " : "";
    }
    text += item.str;
    previous = item;
  }
  return text;
}

/**
 * IMP-14: turn the text items of a PDF's pages into the text a paste would give. Pure: the
 * caller reads the PDF with pdf.js and passes the items in. Pages are joined with newlines;
 * a PDF with no text (a scan) gives an empty string.
 */
export function textItemsToLines(pages: PdfTextItem[][]): string {
  return pages
    .map((items) =>
      groupLines(items.filter((item) => item.str !== ""))
        .map(joinLine)
        .filter((line) => line.trim() !== "")
        .join("\n"),
    )
    .filter((page) => page !== "")
    .join("\n");
}
