import { render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { PdfReadResult } from "../../src/features/import/readPdf";
import { routes } from "../../src/router";
import { openCarePlanText, readPdfMock, pdfChooser, renderQuick, setUpQuickTests, statusPanel } from "./ui-helpers";
import fixtureB1 from "@fixtures/fusion/B-page1-of-2.txt?raw";
import fixtureB2 from "@fixtures/fusion/B-page2-of-2.txt?raw";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";
import fixtureD from "@fixtures/fusion/D-page1-only-incomplete.txt?raw";
import fixtureE from "@fixtures/fusion/E-care-plan-report-229.txt?raw";

// readPdf is stood in for by ui-helpers (the e2e suite opens real PDFs).

setUpQuickTests();

/** Fixture B's task rows only: no banner and no service row, so no plan dates. */
const TABLE_ONLY = fixtureB
  .split(/\r?\n/)
  .filter((line) => /^455 units\t/.test(line))
  .join("\n");

function importHeading(): HTMLElement | null {
  return screen.queryByRole("heading", { level: 2, name: "Open the care plan PDF from Fusion" });
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
    const steps = within(screen.getByRole("region", { name: "Open the care plan PDF from Fusion" })).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual([
      "In Fusion, open the participant's care plan.",
      "Download it as a PDF.",
      "Choose the PDF here or drop it on the box.",
    ]);
    expect(screen.getByText("The PDF is read on this computer. It isn't uploaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5-day plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7-day plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build a schedule by hand" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Example care plan" })).toBeInTheDocument();
    expect(
      screen.getByText("This is what a Fusion plan looks like. Open a PDF above to make your own."),
    ).toBeInTheDocument();
    expect(screen.getByText("Every task read.")).toBeInTheDocument();
    expect(screen.getByText("Our total from these tasks matches Fusion's 466 units a month.")).toBeInTheDocument();
    expect(within(statusPanel()).getByText("Ready to use")).toBeInTheDocument();
    // The example isn't a plan the person opened, so there's nothing to start over from yet.
    expect(screen.queryByRole("button", { name: "New care plan" })).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Nothing you open is uploaded or saved to our servers. It stays in this browser tab, and the participant's name and DCN are gone when you close it.",
    );
  });

  it("PDF only: there is no text box and no Build schedule button on the import panel", () => {
    renderQuick();
    const panel = screen.getByRole("region", { name: "Open the care plan PDF from Fusion" });
    expect(within(panel).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Build schedule" })).not.toBeInTheDocument();
    expect(pdfChooser()).toHaveAttribute("accept", "application/pdf,.pdf");
    expect(panel).not.toHaveTextContent(/paste|copy/i);
  });

  it("opening fixture B's PDF builds the schedule; New care plan brings the panel back", async () => {
    const { user } = renderQuick();
    await openCarePlanText(user, fixtureB);

    const title = await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.getByText("Read from Fusion · DCN 10000002")).toBeInTheDocument();
    expect(screen.getByText("Our total from these tasks matches Fusion's 455 units for a 30-day month. Fusion counts the days in each month for daily tasks, so a 31-day month has 469 and a 28-day month 434.")).toBeInTheDocument();
    expect(importHeading()).not.toBeInTheDocument();
    expect(within(statusPanel()).getByText("Ready to use")).toBeInTheDocument();

    const newPlan = screen.getAllByRole("button", { name: "New care plan" });
    expect(newPlan.length).toBeGreaterThan(0);
    await user.click(newPlan[0]!);
    expect(importHeading()).toBeInTheDocument();
    await waitFor(() => expect(pdfChooser()).toHaveFocus());
    // The current schedule stays underneath until the next plan is built.
    expect(screen.getByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" })).toBeInTheDocument();
  });

  it("Review what we read shows the tasks with their units in the viewed month", async () => {
    const { user } = renderQuick();
    await openCarePlanText(user, fixtureB);
    const review = await screen.findByRole("button", { name: "Review what we read" });
    expect(review).toHaveAttribute("aria-expanded", "false");
    await user.click(review);
    expect(screen.getByRole("button", { name: "Hide what we read" })).toHaveAttribute("aria-expanded", "true");
    const table = screen.getByRole("table", { name: "What we read from Fusion" });
    expect(within(table).getByRole("columnheader", { name: "Units in October" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Fusion row" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Where" })).toBeInTheDocument();
    const bathing = within(table).getByRole("row", { name: /^Bathing/ });
    // Bathing 45 x 7 in a 31-day month: 93 units (the figure the guard quotes). SOURCE-01: its
    // row as read and its page/line come along.
    expect(within(bathing).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Bathing 45 7",
      "45",
      "Every day",
      "93",
      expect.stringMatching(/^Page 1 · line \d+$/),
    ]);
    expect(within(table).getByRole("row", { name: /^Essential transportation/ })).toHaveTextContent("23");
  });

  it("fixture D says the PDF is incomplete, and builds with the rows it has", async () => {
    // Inside D's plan (Sep 1, 2025 to Jun 30, 2026); on Oct 21, 2026 it has ended.
    vi.setSystemTime(new Date("2026-01-15T12:00:00-06:00"));
    const { user } = renderQuick();
    await openCarePlanText(user, fixtureD);

    expect(await screen.findByText("This PDF has 10 of the plan's 14 rows")).toBeInTheDocument();
    expect(
      screen.getByText("Open the PDF that has every page of the care plan, or build with the 10 rows we have."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Build with the 10 rows I have" }));
    expect(await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT D" })).toBeInTheDocument();
    expect(screen.getByText("Built from 10 of the plan's 14 rows. The missing tasks aren't scheduled.")).toBeInTheDocument();
  });

  it("a second PDF after an incomplete one is added to the first and builds the plan (IMP-12, IMP-T29)", async () => {
    vi.setSystemTime(new Date("2025-11-20T12:00:00-06:00"));
    const { user } = renderQuick();
    await openCarePlanText(user, fixtureB1);
    expect(await screen.findByText("This PDF has 10 of the plan's 16 rows")).toBeInTheDocument();

    await openCarePlanText(user, fixtureB2);
    expect(await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" })).toBeInTheDocument();
    expect(screen.getByText(/^Our total from these tasks matches Fusion's 455 units for a 30-day month\./)).toBeInTheDocument();
    expect(importHeading()).not.toBeInTheDocument();
  });

  it("a PDF for a different participant after the first is refused, with what to open", async () => {
    vi.setSystemTime(new Date("2025-11-20T12:00:00-06:00"));
    const { user } = renderQuick();
    await openCarePlanText(user, fixtureB1);
    await screen.findByText("This PDF has 10 of the plan's 16 rows");
    await openCarePlanText(user, fixtureB2.replaceAll("10000002", "10000009"));
    expect(await screen.findByText("That PDF is for a different participant")).toBeInTheDocument();
    expect(screen.getByText("Open the PDF with the rest of the pages, or build with the rows we have.")).toBeInTheDocument();
  });

  it("a PDF without plan dates shows Reading the PDF, then the date fields; entering dates builds", async () => {
    let finish: (result: PdfReadResult) => void = () => {};
    readPdfMock.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
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
    readPdfMock.mockResolvedValue({ kind: "text", text: TABLE_ONLY });
    const { user } = renderQuick();
    await user.upload(screen.getByLabelText(/Choose the PDF/), new File(["%PDF"], "plan.pdf", { type: "application/pdf" }));
    await user.type(await screen.findByLabelText("Plan starts"), "2025-12-01");
    await user.click(screen.getByRole("button", { name: "Use these dates" }));
    expect(screen.getByText("Enter a start date and an end date after it.")).toBeInTheDocument();
    expect(importHeading()).toBeInTheDocument();
  });

  it("a PDF with no care plan in it says so, and the next PDF starts a new plan", async () => {
    readPdfMock.mockResolvedValue({ kind: "text", text: "Meeting notes from Tuesday" });
    const { user } = renderQuick();
    await user.upload(screen.getByLabelText(/Choose the PDF/), new File(["%PDF"], "notes.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("We couldn't find care plan tasks in that PDF")).toBeInTheDocument();
    expect(screen.getByText("Open the participant's care plan PDF from Fusion.")).toBeInTheDocument();
    // Notes aren't a page of a plan: the next PDF is read on its own.
    await openCarePlanText(user, fixtureE);
    expect(await screen.findByRole("region", { name: "SAMPLE PARTICIPANT E" })).toBeInTheDocument();
  });

  it("Fusion's care plan report builds, with its nurse visits listed by month", async () => {
    readPdfMock.mockResolvedValue({ kind: "text", text: fixtureE });
    const { user } = renderQuick();
    await user.upload(screen.getByLabelText(/Choose the PDF/), new File(["%PDF"], "plan.pdf", { type: "application/pdf" }));
    const summary = await screen.findByRole("region", { name: "SAMPLE PARTICIPANT E" });
    expect(within(summary).getByText("Read from Fusion · DCN 10000005")).toBeInTheDocument();
    expect(
      within(summary).getByText("GHE (General Health Evaluation) is a nurse visit, so it's listed by month, not in the week."),
    ).toBeInTheDocument();
    expect(within(summary).getByText("Our total from these tasks matches Fusion's 229 units a month.")).toBeInTheDocument();
    expect(within(statusPanel()).getByText("Ready to use")).toBeInTheDocument();
    // No "Referral date is missing" card: Quick Schedule doesn't schedule visits (CON-13). The plan runs
    // Apr 2026 to Jan 2027; on Oct 21, 2026 the schedule covers October to January.
    expect(
      within(statusPanel()).getByText("Follows every rule we check, for the 4 months left in the plan."),
    ).toBeInTheDocument();
    expect(within(summary).getByText("Oct 1, 2026")).toBeInTheDocument();
  });

  it("a care plan that has ended says so and builds nothing (fixture D on Oct 21, 2026)", async () => {
    const { user } = renderQuick();
    await openCarePlanText(user, fixtureD);
    await user.click(await screen.findByRole("button", { name: "Build with the 10 rows I have" }));
    expect(await screen.findByRole("heading", { name: "This care plan has ended" })).toBeInTheDocument();
    expect(screen.getByText(/^This care plan ended on Jun 30, 2026\. A schedule covers care still to come\./)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT D" })).not.toBeInTheDocument();
  });

  it.each([
    ["That isn't a PDF", "Choose the care plan PDF you saved from Fusion."],
    ["This PDF has no readable text", "It may be a scan or a photo. Download the care plan PDF from Fusion again."],
    ["We couldn't read that PDF", "Check that it's the care plan PDF from Fusion and not password-protected."],
  ])("a file the reader refuses shows its message: %s", async (title, detail) => {
    readPdfMock.mockResolvedValue({ kind: "error", title, detail });
    const { user } = renderQuick();
    await user.upload(pdfChooser(), new File(["%PDF"], "scan.pdf", { type: "application/pdf" }));
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText(detail)).toBeInTheDocument();
  });

  it("when the PDF reader can't load, it says to check the connection", async () => {
    readPdfMock.mockRejectedValue(new Error("Failed to fetch dynamically imported module"));
    const { user } = renderQuick();
    await user.upload(pdfChooser(), new File(["%PDF"], "plan.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("We couldn't open the PDF reader")).toBeInTheDocument();
    expect(screen.getByText("Check your internet connection and try again.")).toBeInTheDocument();
  });

  it("the participant's name and DCN never reach storage; a reload keeps the plan without them", async () => {
    const { user, unmount } = renderQuick();
    await openCarePlanText(user, fixtureB);
    await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });

    // The save is debounced; wait until the opened plan (not the example) is stored.
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v3")).toContain("Laundry (Off Site)"));
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
