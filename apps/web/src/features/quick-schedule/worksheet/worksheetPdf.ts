import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { fontFiles, printPalette, type FontFiles } from "../schedulePdf";
import type { PrintTable, WorksheetSheet } from "./worksheetSheet";

// Portrait US Letter, in points, with the origin at the top left as the layout reads.
export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;
const MARGIN = 36;
const LEFT = MARGIN;
const RIGHT = PAGE_WIDTH - MARGIN;
const WIDTH = RIGHT - LEFT;
const FOOTER_TOP = PAGE_HEIGHT - MARGIN - 6;
const BOTTOM = FOOTER_TOP - 14;
const ASCENT = 0.95;
const ROW = 12;

type Weight = keyof FontFiles;
type Palette = ReturnType<typeof printPalette>;

/** Column widths for the 3c (9 columns) and the 3a (10, with Min/Wk). */
const WIDTHS: Record<number, number[]> = {
  9: [104, 64, 76, 38, 42, 38, 52, 42, 84],
  10: [98, 56, 74, 36, 40, 36, 50, 36, 40, 74],
};

/** Pages drawn top to bottom; a block that doesn't fit starts the next page. */
class Pages {
  private page: PDFPage | null = null;
  readonly all: PDFPage[] = [];
  y = MARGIN;

  constructor(private readonly doc: PDFDocument, readonly fonts: Record<Weight, PDFFont>, readonly color: Palette) {
    this.next();
  }

  next(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.all.push(this.page);
    this.y = MARGIN;
  }

  /** Room for `height` more points on this page, or a new page. */
  need(height: number): void {
    if (this.y + height > BOTTOM) this.next();
  }

  width(text: string, weight: Weight, size: number): number {
    return this.fonts[weight].widthOfTextAtSize(text, size);
  }

  fit(text: string, weight: Weight, size: number, width: number): string {
    if (this.width(text, weight, size) <= width) return text;
    let end = text.length;
    while (end > 0 && this.width(`${text.slice(0, end).trimEnd()}…`, weight, size) > width) end--;
    return end > 0 ? `${text.slice(0, end).trimEnd()}…` : "";
  }

  wrap(text: string, weight: Weight, size: number, width: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (this.width(next, weight, size) <= width) line = next;
      else {
        if (line) lines.push(line);
        line = this.fit(word, weight, size, width);
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  text(text: string, x: number, top: number, size: number, options: { weight?: Weight; color?: RGB; align?: "left" | "right"; on?: PDFPage } = {}): void {
    const page = options.on ?? this.page;
    if (!page || !text) return;
    const weight = options.weight ?? "regular";
    const left = options.align === "right" ? x - this.width(text, weight, size) : x;
    page.drawText(text, { x: left, y: PAGE_HEIGHT - top - size * ASCENT, size, font: this.fonts[weight], color: options.color ?? this.color.ink });
  }

  line(x1: number, y: number, x2: number, color: RGB, thickness = 0.5, on?: PDFPage): void {
    (on ?? this.page)?.drawLine({ start: { x: x1, y: PAGE_HEIGHT - y }, end: { x: x2, y: PAGE_HEIGHT - y }, color, thickness });
  }

  fill(x: number, top: number, width: number, height: number, color: RGB): void {
    this.page?.drawRectangle({ x, y: PAGE_HEIGHT - top - height, width, height, color });
  }

  /** Wrapped lines of text across the page width, starting a new page when needed. */
  paragraph(text: string, size: number, options: { weight?: Weight; color?: RGB; indent?: number } = {}): void {
    const indent = options.indent ?? 0;
    for (const line of this.wrap(text, options.weight ?? "regular", size, WIDTH - indent)) {
      this.need(size * 1.4);
      this.text(line, LEFT + indent, this.y, size, options);
      this.y += size * 1.4;
    }
  }
}

function drawHead(p: Pages, columns: string[], widths: number[]): void {
  p.fill(LEFT, p.y, WIDTH, ROW + 2, p.color.sunk);
  let x = LEFT;
  columns.forEach((column, i) => {
    const w = widths[i]!;
    const numeric = i >= 3;
    p.text(p.fit(column, "semibold", 6.5, w - 4), numeric ? x + w - 3 : x + 3, p.y + 3.5, 6.5, { weight: "semibold", color: p.color["ink-2"], align: numeric ? "right" : "left" });
    x += w;
  });
  p.y += ROW + 2;
}

function drawTable(p: Pages, table: PrintTable): void {
  const widths = WIDTHS[table.columns.length]!;
  p.need(ROW * 4);
  p.text(table.title, LEFT, p.y, 10, { weight: "bold" });
  p.y += 15;
  drawHead(p, table.columns, widths);
  for (const row of table.rows) {
    // A long task label wraps to a second line; a note or a description takes a line under the row.
    const label = p.wrap(row.cells[0] ?? "", "semibold", 7.5, widths[0]! - 6).slice(0, 2);
    const under = [row.note, row.description ? `Description of needs: ${row.description}` : ""].filter(Boolean).join(" · ");
    const height = ROW + (label.length - 1) * 9 + (under ? 10 : 0);
    if (p.y + height > BOTTOM) {
      p.next();
      drawHead(p, table.columns, widths);
    }
    let x = LEFT;
    label.forEach((line, n) => p.text(line, LEFT + 3, p.y + 2.5 + n * 9, 7.5, { weight: "semibold" }));
    row.cells.forEach((cell, i) => {
      const w = widths[i]!;
      if (cell && i > 0) {
        // Text with empty cells after it (the transportation row) runs across them, left-aligned.
        let span = w;
        for (let j = i + 1; j < row.cells.length - 1 && !row.cells[j]; j++) span += widths[j]!;
        const numeric = i >= 3 && span === w;
        p.text(p.fit(cell, "regular", 7.5, span - 6), numeric ? x + w - 3 : x + 3, p.y + 2.5, 7.5, { align: numeric ? "right" : "left" });
      }
      x += w;
    });
    if (under) p.text(p.fit(under, "regular", 6.8, WIDTH - 12), LEFT + 9, p.y + height - 10, 6.8, { color: p.color["ink-2"] });
    p.y += height;
    p.line(LEFT, p.y, RIGHT, p.color.line, 0.4);
  }
  p.y += 4;
  for (const line of table.after) p.paragraph(line, 8.5, { weight: "semibold" });
  p.y += 8;
}

/** Lays the worksheet out on as many portrait pages as it needs (one for the 3c, usually two for the 3a). */
function layOut(p: Pages, sheet: WorksheetSheet): void {
  p.text(sheet.title, LEFT, p.y, 14, { weight: "bold" });
  p.y += 20;
  p.fill(LEFT, p.y, WIDTH, 16, p.color.sunk);
  p.text(sheet.banner, LEFT + 6, p.y + 4, 8.5, { weight: "semibold" });
  p.y += 24;
  const half = WIDTH / 2;
  sheet.header.forEach(([label, value], i) => {
    const x = LEFT + (i % 2) * half;
    if (i % 2 === 0 && i > 0) p.y += 22;
    p.text(label, x, p.y, 6.8, { color: p.color["ink-3"] });
    p.text(p.fit(value, "semibold", 9, half - 10), x, p.y + 8.5, 9, { weight: "semibold" });
  });
  p.y += 30;
  for (const table of sheet.tables) drawTable(p, table);
  for (const block of sheet.blocks) {
    // A block moves to the next page whole rather than splitting.
    const lines = block.lines.reduce((count, line) => count + p.wrap(line, "regular", 8.5, WIDTH).length, 0);
    p.need(14 + lines * 8.5 * 1.4);
    p.text(block.title, LEFT, p.y, 10, { weight: "bold" });
    p.y += 14;
    for (const line of block.lines) p.paragraph(line, 8.5);
    p.y += 8;
  }
  p.need(60);
  p.text("Comments", LEFT, p.y, 10, { weight: "bold" });
  p.y += 14;
  if (sheet.comments) p.paragraph(sheet.comments, 8.5);
  else for (let i = 0; i < 2; i++) {
    p.y += 14;
    p.line(LEFT, p.y, RIGHT, p.color["line-2"], 0.5);
  }
  p.y += 24;
  p.need(40);
  // W-3: a blank line to sign and date by hand; the app never fills it.
  p.line(LEFT, p.y, LEFT + WIDTH * 0.6, p.color.ink, 0.6);
  p.y += 4;
  p.text(sheet.signature, LEFT, p.y, 7.5, { color: p.color["ink-2"] });
  p.y += 22;
  p.paragraph(sheet.prepared, 8, { color: p.color["ink-2"] });
}

/** The worksheet's PDF, with the footer (rule pack and edition) and page numbers on every page. */
export async function renderWorksheetPdf(sheet: WorksheetSheet, files: FontFiles, now: Date): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit);
  const fonts = {
    regular: await doc.embedFont(files.regular, { subset: true }),
    semibold: await doc.embedFont(files.semibold, { subset: true }),
    bold: await doc.embedFont(files.bold, { subset: true }),
  };
  const pages = new Pages(doc, fonts, printPalette());
  layOut(pages, sheet);
  pages.all.forEach((page, i) => {
    pages.line(LEFT, FOOTER_TOP - 5, RIGHT, pages.color.line, 0.5, page);
    pages.text(sheet.footer, LEFT, FOOTER_TOP, 6.5, { color: pages.color["ink-3"], on: page });
    pages.text(`Page ${i + 1} of ${pages.all.length}`, RIGHT, FOOTER_TOP, 6.5, { color: pages.color["ink-3"], align: "right", on: page });
  });
  // No name in the title: a PDF viewer shows it in its tab and window list.
  doc.setTitle("Worksheet", { showInWindowTitleBar: true });
  doc.setCreator("CarePlan Scheduler");
  doc.setProducer("CarePlan Scheduler");
  doc.setLanguage("en-US");
  doc.setCreationDate(now);
  doc.setModificationDate(now);
  return doc.save();
}

/** The worksheet's PDF, ready to open or save. */
export async function worksheetPdfBlob(sheet: WorksheetSheet, now: Date): Promise<Blob> {
  const bytes = await renderWorksheetPdf(sheet, await fontFiles(), now);
  return new Blob([bytes.slice()], { type: "application/pdf" });
}
