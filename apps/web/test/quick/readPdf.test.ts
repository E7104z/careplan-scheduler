import { File as NodeFile } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { readPdf } from "../../src/features/import/readPdf";

// pdf.js itself runs in the browser (Prompt 7's e2e opens the fixture PDFs). Here it is replaced
// by a stand-in that hands back text items, so these tests check what readPdf does with them.
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

interface FakeItem {
  str: string;
  transform: number[];
  width: number;
}

const destroy = vi.fn(async () => {});

function fakeDocument(pages: FakeItem[][]): void {
  vi.mocked(getDocument).mockReturnValue({
    promise: Promise.resolve({
      numPages: pages.length,
      getPage: async (n: number) => ({ getTextContent: async () => ({ items: pages[n - 1] ?? [] }) }),
      destroy,
    }),
  } as unknown as ReturnType<typeof getDocument>);
}

function item(str: string, x: number, width: number, y = 700, size = 10): FakeItem {
  return { str, transform: [size, 0, 0, size, x, y], width };
}

/** jsdom's File has no arrayBuffer() (every browser's does), so the tests use Node's. */
function pdf(name = "care-plan.pdf", type = "application/pdf"): File {
  return new NodeFile(["%PDF-1.7"], name, { type }) as unknown as File;
}

function failWith(name: string, message: string): void {
  vi.mocked(getDocument).mockImplementation(
    () => ({ promise: Promise.reject(Object.assign(new Error(message), { name })) }) as unknown as ReturnType<typeof getDocument>,
  );
}

beforeEach(() => {
  vi.mocked(getDocument).mockReset();
  destroy.mockClear();
});

describe("readPdf", () => {
  it("rebuilds table rows from text positions (IMP-14) without eval, then closes the document", async () => {
    fakeDocument([
      [
        item("455 units", 10, 40),
        item("Bathing", 60, 35),
        item("45", 110, 10),
        item("7", 130, 5),
        item("455 units", 10, 40, 680),
        item("Trash", 60, 25, 680),
        item("5", 110, 5, 680),
        item("7", 130, 5, 680),
      ],
    ]);
    const result = await readPdf(pdf());
    expect(result).toEqual({ kind: "text", text: "455 units\tBathing\t45\t7\n455 units\tTrash\t5\t7" });
    expect(vi.mocked(getDocument).mock.calls[0]![0]).toMatchObject({ isEvalSupported: false });
    expect(GlobalWorkerOptions.workerSrc).toMatch(/pdf\.worker\.min\.mjs/);
    expect(destroy).toHaveBeenCalled();
  });

  it("a file that isn't a PDF is refused before pdf.js runs", async () => {
    const result = await readPdf(pdf("notes.txt", "text/plain"));
    expect(result).toEqual({
      kind: "error",
      title: "That isn't a PDF",
      detail: "Choose the care plan PDF you saved from Fusion.",
    });
    expect(getDocument).not.toHaveBeenCalled();
  });

  it("a file named .pdf that pdf.js says isn't one gets the same message", async () => {
    failWith("InvalidPDFException", "Invalid PDF structure.");
    expect(await readPdf(pdf())).toMatchObject({ kind: "error", title: "That isn't a PDF" });
  });

  it("a PDF with no text (a scan) says so", async () => {
    fakeDocument([[item("  ", 10, 5)], []]);
    expect(await readPdf(pdf())).toEqual({
      kind: "error",
      title: "This PDF has no readable text",
      detail: "It may be a scan or a photo. Download the care plan PDF from Fusion again.",
    });
    expect(destroy).toHaveBeenCalled();
  });

  it("any other failure (a password, a broken file) says how to go on", async () => {
    failWith("PasswordException", "No password given");
    expect(await readPdf(pdf())).toEqual({
      kind: "error",
      title: "We couldn't read that PDF",
      detail: "Check that it's the care plan PDF from Fusion and not password-protected.",
    });
  });
});
