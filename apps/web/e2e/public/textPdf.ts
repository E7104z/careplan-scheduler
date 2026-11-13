import { PDFDocument, StandardFonts } from "pdf-lib";

const FONT_SIZE = 9;
const LINE_HEIGHT = 13;
const MARGIN = 36;
const LINES_PER_PAGE = 54;
/** Wider than 0.8 × the font height, so the reader puts a tab between two cells (IMP-14). */
const CELL_GAP = 14;

/**
 * A PDF that reads as `text`: one line of the PDF per line of text at a fixed height, each
 * tab-separated cell drawn on its own, a cell gap apart. For the scenarios no fixture PDF gives
 * (an incomplete plan, a plan in two PDFs, a PDF with no care plan in it). A unit test proves the
 * app's reader turns it back into text the parser reads the same as the fixture.
 */
export async function textPdf(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = text.split(/\r?\n/);
  const cellsOf = (line: string) => line.split("\t").filter((cell) => cell.trim() !== "");
  const lineWidth = (line: string) =>
    cellsOf(line).reduce((width, cell) => width + font.widthOfTextAtSize(cell, FONT_SIZE) + CELL_GAP, 0);
  const pageWidth = Math.max(612, ...lines.map((line) => lineWidth(line) + 2 * MARGIN));
  const pageHeight = 2 * MARGIN + LINES_PER_PAGE * LINE_HEIGHT;

  for (let first = 0; first < Math.max(lines.length, 1); first += LINES_PER_PAGE) {
    const page = doc.addPage([pageWidth, pageHeight]);
    lines.slice(first, first + LINES_PER_PAGE).forEach((line, row) => {
      let x = MARGIN;
      for (const cell of cellsOf(line)) {
        page.drawText(cell, { x, y: pageHeight - MARGIN - (row + 1) * LINE_HEIGHT, size: FONT_SIZE, font });
        x += font.widthOfTextAtSize(cell, FONT_SIZE) + CELL_GAP;
      }
    });
  }
  return doc.save();
}
