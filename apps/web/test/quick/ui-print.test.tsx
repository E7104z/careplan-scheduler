import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schedulePdfBlob } from "../../src/features/quick-schedule/schedulePdf";
import type { ScheduleSheet } from "../../src/features/quick-schedule/scheduleSheet";
import { BEFORE_B, openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";

// pdf.js-free and font-free: the PDF itself is checked in schedulePdf.test.ts. Here, what the page
// does with it.
vi.mock("../../src/features/quick-schedule/schedulePdf", () => ({
  schedulePdfBlob: vi.fn(async () => new Blob(["%PDF-1.7"], { type: "application/pdf" })),
}));

setUpQuickTests(BEFORE_B);

interface FakeTab {
  document: { title: string; body: { textContent: string } };
  location: { replace: ReturnType<typeof vi.fn> };
  closed: boolean;
  close: ReturnType<typeof vi.fn>;
}

function fakeTab(): FakeTab {
  return { document: { title: "", body: { textContent: "" } }, location: { replace: vi.fn() }, closed: false, close: vi.fn() };
}

/** Each click on a link with `download`: the file name and what it points at. */
let downloads: { name: string; href: string }[] = [];

beforeEach(() => {
  downloads = [];
  URL.createObjectURL = vi.fn(() => "blob:http://localhost/schedule");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (this.download) downloads.push({ name: this.download, href: this.href });
  });
  vi.spyOn(window, "print").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.mocked(schedulePdfBlob).mockClear();
  vi.restoreAllMocks();
});

async function buildB(user: UserEvent): Promise<void> {
  await openCarePlanText(user, fixtureB);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });
}

describe("Quick Schedule: the one-page printout (APP-SPEC 5.4 Print)", () => {
  it("Print schedule opens the one-page PDF in a new tab, ready to print", async () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const { user } = renderQuick();
    await buildB(user);

    await user.click(screen.getByRole("button", { name: "Print schedule" }));
    await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith("blob:http://localhost/schedule"));
    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(tab.document.title).toBe("Weekly care schedule");
    expect(window.print).not.toHaveBeenCalled();
    expect(downloads).toEqual([]);
    // The schedule on the screen is the one printed.
    const [sheets] = vi.mocked(schedulePdfBlob).mock.calls[0]!;
    // A plan of one service prints its one page.
    expect(Array.isArray(sheets)).toBe(false);
    const sheet = sheets as ScheduleSheet;
    expect(sheet.name).toBe("SAMPLE PARTICIPANT B");
    expect(sheet.footer).toBe("Checked with CarePlan Scheduler under rule pack mo-2026-07 on Nov 20, 2025");
  });

  it("where no tab can open (the Windows app, a blocked popup), the PDF downloads instead", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const { user } = renderQuick();
    await buildB(user);

    await user.click(screen.getByRole("button", { name: "Print schedule" }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    // The date only: the participant's name and DCN never go into a file name (IMP-16).
    expect(downloads[0]).toEqual({ name: "Care schedule 2025-11-20.pdf", href: "blob:http://localhost/schedule" });
  });

  it("a browser set to download PDFs rather than show them gets the file, named, and no empty tab", async () => {
    Object.defineProperty(navigator, "pdfViewerEnabled", { value: false, configurable: true });
    const open = vi.spyOn(window, "open");
    try {
      const { user } = renderQuick();
      await buildB(user);

      await user.click(screen.getByRole("button", { name: "Print schedule" }));
      await waitFor(() => expect(downloads).toEqual([{ name: "Care schedule 2025-11-20.pdf", href: "blob:http://localhost/schedule" }]));
      expect(open).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(navigator, "pdfViewerEnabled");
    }
  });

  it("Save as PDF downloads it, without opening a tab", async () => {
    const open = vi.spyOn(window, "open");
    const { user } = renderQuick();
    await buildB(user);

    await user.click(screen.getByRole("button", { name: "Save as PDF" }));
    await waitFor(() => expect(downloads).toEqual([{ name: "Care schedule 2025-11-20.pdf", href: "blob:http://localhost/schedule" }]));
    expect(open).not.toHaveBeenCalled();
  });

  it("Ctrl+P makes the one-page printout instead of printing the page", async () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const { user } = renderQuick();
    await buildB(user);

    const event = new KeyboardEvent("keydown", { key: "p", ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(tab.location.replace).toHaveBeenCalled());
  });

  it("the Windows app's File > Print makes the same printout, and is told so", async () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const { user } = renderQuick();
    await buildB(user);

    // dispatchEvent returns false when the page cancels the event: the app then doesn't print the page.
    expect(window.dispatchEvent(new Event("careplan:print", { cancelable: true }))).toBe(false);
    await waitFor(() => expect(tab.location.replace).toHaveBeenCalled());
  });

  it("a second request while the PDF is being made is the same printout, not another", async () => {
    // Each printout starts by asking for a tab; here none opens, so it downloads.
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { user } = renderQuick();
    await buildB(user);

    // Ctrl+P can reach both the page and the Windows app's menu in the same moment. The second is
    // still taken (so the app doesn't print the page too), but makes nothing more.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", ctrlKey: true, cancelable: true }));
    expect(window.dispatchEvent(new Event("careplan:print", { cancelable: true }))).toBe(false);
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(open).toHaveBeenCalledTimes(1);

    // Once it's made, the next request is a new printout.
    await waitFor(() => expect(screen.getByRole("button", { name: "Print schedule" })).not.toHaveAttribute("aria-busy"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", ctrlKey: true, cancelable: true }));
    await waitFor(() => expect(downloads).toHaveLength(2));
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("if the PDF can't be made, its tab closes and the page says what to do", async () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    vi.mocked(schedulePdfBlob).mockRejectedValueOnce(new Error("Font request failed with 503"));
    const { user } = renderQuick();
    await buildB(user);

    await user.click(screen.getByRole("button", { name: "Print schedule" }));
    expect(await screen.findByText("Couldn't make the PDF. Check your connection, then try again.")).toBeInTheDocument();
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
  });

  it("with no tasks there's nothing to print: the buttons are off and Ctrl+P is left to the browser", async () => {
    const open = vi.spyOn(window, "open");
    const { user } = renderQuick();
    await user.click(screen.getByRole("button", { name: "Build a schedule by hand" }));

    expect(screen.getByRole("button", { name: "Print schedule" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save as PDF" })).toBeDisabled();
    const event = new KeyboardEvent("keydown", { key: "p", ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(window.dispatchEvent(new Event("careplan:print", { cancelable: true }))).toBe(true);
    fireEvent.keyDown(window, { key: "p", metaKey: true });
    expect(open).not.toHaveBeenCalled();
  });
});
