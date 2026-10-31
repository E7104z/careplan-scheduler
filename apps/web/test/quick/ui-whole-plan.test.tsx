import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readPdf } from "../../src/features/import/readPdf";
import { schedulePdfBlob } from "../../src/features/quick-schedule/schedulePdf";
import type { ScheduleSheet } from "../../src/features/quick-schedule/scheduleSheet";
import { pasteText, renderQuick, setUpQuickTests, statusPanel } from "./ui-helpers";
import fixtureE from "@fixtures/fusion/E-care-plan-report-229.txt?raw";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

vi.mock("../../src/features/import/readPdf", () => ({ readPdf: vi.fn() }));
vi.mock("../../src/features/quick-schedule/schedulePdf", () => ({
  schedulePdfBlob: vi.fn(async () => new Blob(["%PDF-1.7"], { type: "application/pdf" })),
}));

// APP-SPEC 5.8 (AC-28, AC-29): a care plan with several authorizations is one schedule for the
// participant. Oct 21, 2026: fixture F's authorizations run to Oct 31, so October is scheduled.
setUpQuickTests();

function views(): HTMLElement {
  return screen.getByRole("navigation", { name: "Care plan views" });
}

function weekPanel(): HTMLElement {
  return screen.getByRole("heading", { level: 2, name: "The participant's week" }).closest("section")!;
}

function day(name: string): HTMLElement {
  return within(weekPanel()).getByRole("region", { name });
}

async function openF() {
  vi.mocked(readPdf).mockResolvedValue({ kind: "text", text: fixtureF });
  const result = renderQuick();
  await result.user.upload(screen.getByLabelText(/Choose the PDF/), new File(["%PDF"], "plan.pdf", { type: "application/pdf" }));
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT F" });
  return result;
}

describe("Quick Schedule: the whole care plan (APP-SPEC 5.8)", () => {
  it("opens the report on the whole care plan, with no service to choose", async () => {
    await openF();
    expect(screen.queryByText(/Choose the one to schedule/)).not.toBeInTheDocument();
    expect(within(views()).getByRole("button", { name: /Whole care plan/, pressed: true })).toBeInTheDocument();
    for (const name of [/PC - Agency/, /PC - CDS/, /^HC/]) {
      expect(within(views()).getByRole("button", { name, pressed: false })).toBeInTheDocument();
    }

    const summary = screen.getByRole("region", { name: "SAMPLE PARTICIPANT F" });
    expect(within(summary).getByText("Read from Fusion · DCN 10000006")).toBeInTheDocument();
    expect(within(summary).getByText("PC - Agency · T1019")).toBeInTheDocument();
    expect(within(summary).getByText("PC - CDS · T1019U2")).toBeInTheDocument();
    expect(within(summary).getByText("HC · S5130")).toBeInTheDocument();
    expect(within(summary).getAllByText(/Our total from these tasks matches Fusion's/)).toHaveLength(3);
    expect(
      within(summary).getByText("GHE (General Health Evaluation) is a nurse visit, so it's listed by month, not in the week."),
    ).toBeInTheDocument();
    expect(within(summary).queryByText(/We couldn't read this row/)).not.toBeInTheDocument();
  });

  it("lists each authorization with its own units for the month and its checks", async () => {
    await openF();
    const table = screen.getByRole("table", { name: /Each service's authorization/ });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getByRole("rowheader").textContent)).toEqual([
      "PC - AgencyBasic Personal Care – Agency · T1019",
      "PC - CDSCDS Personal Care Assistance (State Plan) · T1019U2",
      "HCHomemaker (ADW) · S5130",
    ]);
    expect(within(rows[0]!).getByText("20260000000011")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("226 units in October")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("40 units in October")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("5 units in October")).toBeInTheDocument();
    for (const row of rows) expect(within(row).getByText("Ready to use")).toBeInTheDocument();
  });

  it("shows every service in one week, each task under its service", async () => {
    await openF();
    expect(within(weekPanel()).getByText("14 h 10 min a week, all services")).toBeInTheDocument();
    expect(within(day("Monday")).getByText("PC - Agency")).toBeInTheDocument();
    expect(within(day("Monday")).getByText("Dietary")).toBeInTheDocument();
    expect(within(day("Friday")).getByText("PC - CDS")).toBeInTheDocument();
    expect(within(day("Friday")).getByText("Essential transportation")).toBeInTheDocument();
    expect(within(day("Friday")).getByText("Total 4 h 5 min")).toBeInTheDocument();
    expect(within(day("Saturday")).getByText("HC")).toBeInTheDocument();
    expect(within(day("Saturday")).getByText("Wash Windows/Blinds")).toBeInTheDocument();
    expect(within(day("Sunday")).getByText("No service")).toBeInTheDocument();
  });

  it("lists the nurse visits by month, both past on Oct 21, 2026", async () => {
    await openF();
    const visits = screen.getByRole("heading", { level: 2, name: "Nurse visits" }).closest("section")!;
    expect(within(visits).getByText(/those months have passed/)).toBeInTheDocument();
    expect(within(visits).getByText(/May 2026/)).toBeInTheDocument();
    expect(within(visits).getByText(/August 2026/)).toBeInTheDocument();
    expect(within(visits).getAllByText("Past")).toHaveLength(2);
  });

  it("opens a service to change it under its own rules, on the same page, and back", async () => {
    const { user } = await openF();
    await user.click(screen.getByRole("button", { name: "Open HC" }));
    expect(within(views()).getByRole("button", { name: /^HC/, pressed: true })).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "SAMPLE PARTICIPANT F" });
    expect(within(summary).getByText("HC · S5130")).toBeInTheDocument();
    expect(within(statusPanel()).getByText("Ready to use")).toBeInTheDocument();

    // Move homemaker from Saturday to Wednesday: its care days are its own.
    const careDays = screen.getByRole("group", { name: "Care days" });
    await user.click(within(careDays).getByRole("button", { name: "Wednesday" }));
    await user.click(within(careDays).getByRole("button", { name: "Saturday" }));
    expect(within(screen.getByRole("group", { name: "Wash Windows/Blinds days" })).getByRole("button", { name: "Wednesday", pressed: true }))
      .toBeInTheDocument();

    await user.click(within(views()).getByRole("button", { name: /Whole care plan/ }));
    expect(within(day("Wednesday")).getByText("Wash Windows/Blinds")).toBeInTheDocument();
    expect(within(day("Saturday")).getByText("No service")).toBeInTheDocument();
  });

  it("a reload keeps every service and the view, without the name or DCN", async () => {
    const { user, unmount } = await openF();
    await user.click(screen.getByRole("button", { name: "Open PC - CDS" }));
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v3")).toContain('"view":1'));
    expect(sessionStorage.getItem("cps.quick.v3")).not.toMatch(/SAMPLE PARTICIPANT|10000006/);

    unmount();
    renderQuick();
    expect(within(views()).getByRole("button", { name: /PC - CDS/, pressed: true })).toBeInTheDocument();
    expect(within(statusPanel()).getByText("120")).toBeInTheDocument();
  });

  it("prints the whole week first, then each service's own page", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/schedule");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const { user } = await openF();
    await user.click(screen.getByRole("button", { name: "Save as PDF" }));
    await waitFor(() => expect(schedulePdfBlob).toHaveBeenCalled());
    const [sheets] = vi.mocked(schedulePdfBlob).mock.calls.at(-1)!;
    const pages = sheets as ScheduleSheet[];
    expect(pages.map((page) => page.facts.find((fact) => fact.label === "Services" || fact.label === "Service")?.value)).toEqual([
      "PC - Agency, PC - CDS, HC",
      "PC - Agency · T1019",
      "PC - CDS · T1019U2",
      "HC · S5130",
    ]);
    expect(pages[0]!.rows.map((row) => row.detail.split(" · ")[0])).toEqual([
      ...Array(8).fill("PC - Agency"),
      "PC - CDS",
      "HC",
    ]);
    expect(pages[0]!.facts).toContainEqual({ label: "Nurse visits", value: "May 2026 and Aug 2026" });
  });
});

describe("a care plan report with one service", () => {
  it("shows that service as before, with its nurse visits listed by month", async () => {
    vi.mocked(readPdf).mockResolvedValue({ kind: "text", text: fixtureE });
    const { user } = renderQuick();
    await user.upload(screen.getByLabelText(/Choose the PDF/), new File(["%PDF"], "plan.pdf", { type: "application/pdf" }));
    await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT E" });
    expect(screen.queryByRole("navigation", { name: "Care plan views" })).not.toBeInTheDocument();
    const visits = screen.getByRole("heading", { level: 2, name: "Nurse visits" }).closest("section")!;
    expect(within(visits).getByText(/November 2026/)).toBeInTheDocument();
    expect(within(visits).getByText("Coming up")).toBeInTheDocument();
    expect(within(visits).getByText("Past")).toBeInTheDocument();
  });

  it("a pasted plan of several services also opens on the whole care plan", async () => {
    const { user } = renderQuick();
    await pasteText(user, fixtureF);
    expect(await screen.findByRole("heading", { level: 2, name: "The participant's week" })).toBeInTheDocument();
  });
});
