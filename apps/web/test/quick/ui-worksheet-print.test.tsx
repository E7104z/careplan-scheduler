import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schedulePdfBlob } from "../../src/features/quick-schedule/schedulePdf";
import { worksheetPdfBlob } from "../../src/features/quick-schedule/worksheet/worksheetPdf";
import { renderQuick, setUpQuickTests } from "./ui-helpers";

// The PDFs themselves are checked in worksheetPdf.test.ts and schedulePdf.test.ts. Here, what the
// page does with them.
vi.mock("../../src/features/quick-schedule/worksheet/worksheetPdf", () => ({
  worksheetPdfBlob: vi.fn(async () => new Blob(["%PDF-1.7"], { type: "application/pdf" })),
}));
vi.mock("../../src/features/quick-schedule/schedulePdf", () => ({
  schedulePdfBlob: vi.fn(async () => new Blob(["%PDF-1.7"], { type: "application/pdf" })),
}));

setUpQuickTests();

let downloads: string[] = [];

beforeEach(() => {
  downloads = [];
  URL.createObjectURL = vi.fn(() => "blob:http://localhost/worksheet");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (this.download) downloads.push(this.download);
  });
});

afterEach(() => {
  vi.mocked(worksheetPdfBlob).mockClear();
  vi.mocked(schedulePdfBlob).mockClear();
  vi.restoreAllMocks();
});

describe("WS-A21 printing the worksheet", () => {
  it("Save worksheet as PDF downloads it, named by date only", async () => {
    const { user } = renderQuick();
    await user.click(screen.getByRole("tab", { name: "Worksheet" }));
    await screen.findByRole("heading", { name: "Worksheet view" }, { timeout: 5000 });
    await user.click(screen.getByRole("button", { name: "Save worksheet as PDF" }));
    await waitFor(() => expect(downloads).toEqual(["Worksheet 2026-10-21.pdf"]));
    expect(vi.mocked(worksheetPdfBlob).mock.calls[0]?.[0].banner).toBe("Follows DSDS-HCBS-3c (10/26). Not an official DSDS form.");
    expect(schedulePdfBlob).not.toHaveBeenCalled();
  });

  it("Print worksheet opens it in a new tab; Ctrl+P prints the worksheet while its tab is open", async () => {
    const tab = { document: { title: "", body: { textContent: "" } }, location: { replace: vi.fn() }, closed: false, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const { user } = renderQuick();
    await user.click(screen.getByRole("tab", { name: "Worksheet" }));
    await screen.findByRole("heading", { name: "Worksheet view" }, { timeout: 5000 });
    await user.click(screen.getByRole("button", { name: "Print worksheet" }));
    await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith("blob:http://localhost/worksheet"));
    expect(tab.document.title).toBe("Worksheet");

    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    await waitFor(() => expect(worksheetPdfBlob).toHaveBeenCalledTimes(2));
    expect(schedulePdfBlob).not.toHaveBeenCalled();
  });
});

describe("WS-X08 downloading DSDS's own worksheet", () => {
  it("fills DSDS's workbook from this site and downloads it, named by form and date only", { timeout: 20000 }, async () => {
    const workbook = readFileSync(join(import.meta.dirname, "../../public/state/4.00appendix4da-3cform.xlsx"));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array(workbook)));
    const { user } = renderQuick();
    await user.click(screen.getByRole("tab", { name: "Worksheet" }));
    await screen.findByRole("heading", { name: "Worksheet view" }, { timeout: 5000 });
    expect(screen.getByText(/This is DSDS's own file with your numbers typed in. DSDS staff complete and sign it./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download as DSDS's worksheet (.xlsx)" }));
    // Unzipping and re-zipping DSDS's workbook takes a few seconds under jsdom.
    await waitFor(() => expect(downloads).toEqual(["DSDS HCBS-3c worksheet 2026-10-21.xlsx"]), { timeout: 15000 });
    expect(fetchSpy).toHaveBeenCalledWith("/state/4.00appendix4da-3cform.xlsx");
  });
});
