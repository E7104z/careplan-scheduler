import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { textItemsToLines, type PdfTextItem } from "@careplan/import";

// This module is loaded with import() only when a person chooses a PDF (APP-SPEC D-15), so pdf.js
// never reaches the public pages' chunks (check-bundle looks for it).

export type PdfReadResult =
  | { kind: "text"; text: string }
  | { kind: "error"; title: string; detail: string };

const NOT_A_PDF: PdfReadResult = {
  kind: "error",
  title: "That isn't a PDF",
  detail: "Choose the care plan PDF you saved from Fusion.",
};
const NO_TEXT: PdfReadResult = {
  kind: "error",
  title: "This PDF has no readable text",
  detail: "It may be a scan or a photo. Paste the care plan from Fusion instead.",
};
const UNREADABLE: PdfReadResult = {
  kind: "error",
  title: "We couldn't read that PDF",
  detail:
    "Check that it's the care plan PDF from Fusion and not password-protected. You can also paste the care plan instead.",
};

function looksLikePdf(file: File): boolean {
  return /\.pdf$/i.test(file.name) || file.type === "application/pdf";
}

function toPdfTextItem(item: TextItem): PdfTextItem {
  const [, , , d = 0, x = 0, y = 0] = item.transform as number[];
  return { str: item.str, x, y, width: item.width, height: Math.abs(d) };
}

/**
 * IMP-14: read a care plan PDF in the browser (nothing is uploaded) and return its text as a
 * paste would give it, or the message to show. Never throws.
 */
export async function readPdf(file: File): Promise<PdfReadResult> {
  if (!looksLikePdf(file)) return NOT_A_PDF;
  try {
    GlobalWorkerOptions.workerSrc = workerUrl;
    const data = new Uint8Array(await file.arrayBuffer());
    // verbosity 0: errors only, so pdf.js writes nothing about the plan to the console.
    const doc = await getDocument({ data, isEvalSupported: false, verbosity: 0 }).promise;
    try {
      const pages: PdfTextItem[][] = [];
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
        const content = await (await doc.getPage(pageNumber)).getTextContent();
        pages.push(content.items.flatMap((item) => ("str" in item ? [toPdfTextItem(item)] : [])));
      }
      const text = textItemsToLines(pages);
      return text.trim() === "" ? NO_TEXT : { kind: "text", text };
    } finally {
      await doc.destroy();
    }
  } catch (error) {
    return error instanceof Error && error.name === "InvalidPDFException" ? NOT_A_PDF : UNREADABLE;
  }
}
