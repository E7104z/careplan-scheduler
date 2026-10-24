import { render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { readPdf, type PdfReadResult } from "../../src/features/import/readPdf";
import { routes } from "../../src/router";
import { pasteBox, pasteText, renderQuick, setUpQuickTests, statusPanel } from "./ui-helpers";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";
import fixtureD from "@fixtures/fusion/D-page1-only-incomplete.txt?raw";

// readPdf loads pdf.js; the screens only need what it returns (Prompt 7's e2e opens real PDFs).
vi.mock("../../src/features/import/readPdf", () => ({ readPdf: vi.fn() }));

setUpQuickTests();

/** Fixture B's task rows only: no banner and no service row, so no plan dates. */
const TABLE_ONLY = fixtureB
  .split(/\r?\n/)
  .filter((line) => /^455 units\t/.test(line))
  .join("\n");

function importHeading(): HTMLElement | null {
  return screen.queryByRole("heading", { level: 2, name: "Paste the care plan from Fusion" });
}

describe("Quick Schedule: import panel and read summary", () => {
  it("is the /quick route, lazily loaded, with its title and focused heading", async () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/quick"] })} />);
    const heading = await screen.findByRole("heading", { level: 1, name: "Quick Schedule" }, { timeout: 5000 });
    await waitFor(() => {
      expect(heading).toHaveFocus();
      expect(document.title).toBe("Quick Schedule | CarePlan Scheduler");
    });
  });

  it("first visit: the import panel open over the 5-day example, ready to use", () => {
    renderQuick();
    expect(importHeading()).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Or open the care plan PDF" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Example care plan" })).toBeInTheDocument();
    expect(
      screen.getByText("This is what a pasted Fusion plan looks like. Paste one above to make your own."),
    ).toBeInTheDocument();
    expect(screen.getByText("Every task read.")).toBeInTheDocument();
    expect(screen.getByText("Our total from these tasks matches Fusion's 466 units a month.")).toBeInTheDocument();
    expect(within(statusPanel()).getByText("Ready to use")).toBeInTheDocument();
    // The example isn't a pasted plan, so there's nothing to start over from yet.
    expect(screen.queryByRole("button", { name: "New care plan" })).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Nothing you paste or open is uploaded or saved to our servers. It stays in this browser tab, and the participant's name and DCN are gone when you close it.",
    );
  });

  it("pasting fixture B builds with no button press; New care plan brings the panel back", async () => {
    const { user } = renderQuick();
    await pasteText(user, fixtureB);

    const title = await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.getByText("Read from Fusion · DCN 10000002")).toBeInTheDocument();
    expect(screen.getByText("Our total from these tasks matches Fusion's 455 units a month.")).toBeInTheDocument();
    expect(importHeading()).not.toBeInTheDocument();
    expect(within(statusPanel()).getByText("Ready to use")).toBeInTheDocument();

    const newPlan = screen.getAllByRole("button", { name: "New care plan" });
    expect(newPlan.length).toBeGreaterThan(0);
    await user.click(newPlan[0]!);
    expect(importHeading()).toBeInTheDocument();
    expect(pasteBox()).toHaveValue("");
    await waitFor(() => expect(pasteBox()).toHaveFocus());
    // The current schedule stays underneath until the next plan is built.
    expect(screen.getByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" })).toBeInTheDocument();
  });

  it("Review what we read shows the tasks with their units in the viewed month", async () => {
    const { user } = renderQuick();
    await pasteText(user, fixtureB);
    const review = await screen.findByRole("button", { name: "Review what we read" });
    expect(review).toHaveAttribute("aria-expanded", "false");
    await user.click(review);
    expect(screen.getByRole("button", { name: "Hide what we read" })).toHaveAttribute("aria-expanded", "true");
    const table = screen.getByRole("table", { name: "What we read from Fusion" });
    expect(within(table).getByRole("columnheader", { name: "Units in October" })).toBeInTheDocument();
    const bathing = within(table).getByRole("row", { name: /^Bathing/ });
    // Bathing 45 x 7 in a 31-day month: 93 units (the figure the guard quotes).
    expect(within(bathing).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["45", "Every day", "93"]);
    expect(within(table).getByRole("row", { name: /^Essential transportation/ })).toHaveTextContent("23");
  });

  it("fixture D asks for the next page, and builds with the rows it has", async () => {
    const { user } = renderQuick();
    await pasteText(user, fixtureD);

    expect(await screen.findByText("This copy has 10 of the plan's 14 rows")).toBeInTheDocument();
    // The page is read; the box is empty for the next one.
    expect(pasteBox()).toHaveValue("");
    expect(pasteBox()).toHaveAccessibleName("Care plan text, page 2");
    expect(pasteBox()).toHaveAttribute("placeholder", "Paste page 2 here");

    await user.click(screen.getByRole("button", { name: "Build with the 10 rows I have" }));
    expect(await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT D" })).toBeInTheDocument();
    expect(screen.getByText("Built from 10 of the plan's 14 rows. The missing tasks aren't scheduled.")).toBeInTheDocument();
  });

  it("text with no care plan says so, and the next paste is page 1 again", async () => {
    const { user } = renderQuick();
    await pasteText(user, "Meeting notes from Tuesday");
    expect(await screen.findByText("We couldn't find care plan tasks in that text")).toBeInTheDocument();
    expect(pasteBox()).toHaveAccessibleName("Care plan text");
  });

  it("Build schedule with an empty box says how to paste", async () => {
    const { user } = renderQuick();
    await user.click(screen.getByRole("button", { name: "Build schedule" }));
    expect(screen.getByText("Paste the care plan first")).toBeInTheDocument();
    expect(screen.getByText("Copy it from Fusion, click in the box, and paste.")).toBeInTheDocument();
    expect(pasteBox()).toHaveFocus();
  });

  it("Build schedule reads typed text", async () => {
    const { user } = renderQuick();
    await user.click(pasteBox());
    // Typed (not pasted) text waits for the button.
    await user.keyboard("300 units Bathing 30 7");
    expect(screen.queryByText("Enter the plan dates")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Build schedule" }));
    expect(await screen.findByText("Enter the plan dates")).toBeInTheDocument();
  });

  it("a PDF without plan dates shows Reading the PDF, then the date fields; entering dates builds", async () => {
    let finish: (result: PdfReadResult) => void = () => {};
    vi.mocked(readPdf).mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const { user } = renderQuick();

    await user.upload(
      screen.getByLabelText(/Choose the PDF/),
      new File(["%PDF-1.7"], "care-plan.pdf", { type: "application/pdf" }),
    );
    expect(await screen.findByText("Reading the PDF…")).toBeInTheDocument();
    finish({ kind: "text", text: TABLE_ONLY });

    expect(await screen.findByText("Enter the plan dates")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Plan starts"), "2025-12-01");
    await user.type(screen.getByLabelText("Plan ends"), "2026-10-31");
    await user.click(screen.getByRole("button", { name: "Use these dates" }));

    const summary = await screen.findByRole("region", { name: "Care plan from Fusion" });
    expect(within(summary).getByText("Read from Fusion")).toBeInTheDocument();
    expect(within(summary).getByText("Dec 1, 2025 to Oct 31, 2026")).toBeInTheDocument();
    expect(importHeading()).not.toBeInTheDocument();
  });

  it("entering only one plan date says what's needed", async () => {
    vi.mocked(readPdf).mockResolvedValue({ kind: "text", text: TABLE_ONLY });
    const { user } = renderQuick();
    await user.upload(screen.getByLabelText(/Choose the PDF/), new File(["%PDF"], "plan.pdf", { type: "application/pdf" }));
    await user.type(await screen.findByLabelText("Plan starts"), "2025-12-01");
    await user.click(screen.getByRole("button", { name: "Use these dates" }));
    expect(screen.getByText("Enter a start date and an end date after it.")).toBeInTheDocument();
    expect(importHeading()).toBeInTheDocument();
  });

  it("a PDF that can't be read shows its message", async () => {
    vi.mocked(readPdf).mockResolvedValue({
      kind: "error",
      title: "This PDF has no readable text",
      detail: "It may be a scan or a photo. Paste the care plan from Fusion instead.",
    });
    const { user } = renderQuick();
    await user.upload(screen.getByLabelText(/Choose the PDF/), new File(["%PDF"], "scan.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("This PDF has no readable text")).toBeInTheDocument();
    expect(screen.getByText("It may be a scan or a photo. Paste the care plan from Fusion instead.")).toBeInTheDocument();
  });

  it("the participant's name and DCN never reach storage; a reload keeps the plan without them", async () => {
    const { user, unmount } = renderQuick();
    await pasteText(user, fixtureB);
    await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });

    // The save is debounced; wait until the pasted plan (not the example) is stored.
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v2")).toContain("Laundry (Off Site)"));
    const stored = [sessionStorage, localStorage].flatMap((storage) =>
      Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`),
    );
    expect(stored.join("\n")).not.toMatch(/SAMPLE PARTICIPANT|10000002/);

    unmount();
    renderQuick();
    expect(screen.getByRole("heading", { level: 2, name: "Care plan from Fusion" })).toBeInTheDocument();
    expect(screen.getByText("Read from Fusion")).toBeInTheDocument();
    expect(screen.queryByText(/· DCN/)).not.toBeInTheDocument();
    expect(importHeading()).not.toBeInTheDocument();
  });
});
