import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureE from "@fixtures/fusion/E-care-plan-report-229.txt?raw";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP3-7 on the page. Apr 15, 2026: inside fixture F's plan, before its May and August evaluations.
setUpQuickTests(new Date("2026-04-15T12:00:00-05:00"));

async function openMonth(text: string, open: string) {
  const result = renderQuick();
  await openCarePlanText(result.user, text);
  await screen.findByRole("heading", { level: 2, name: /SAMPLE PARTICIPANT/ });
  await result.user.click(screen.getByRole("button", { name: open }));
  // The calendar is in the dated-side chunk: wait for it.
  await screen.findByRole("heading", { level: 2, name: "The participant's month" }, { timeout: 5000 });
  // The test screen reports a narrow width, where the list is the default: show the grid.
  await result.user.click(within(calendar()).getByRole("button", { name: "Calendar" }));
  return result;
}

function calendar(): HTMLElement {
  return screen.getByRole("heading", { level: 2, name: "The participant's month" }).closest("section")!;
}

describe("The participant calendar (APP-SPEC 5.8)", () => {
  it("the whole care plan opens on the week; Month shows the calendar in its place, and Week brings the week back", async () => {
    const { user } = renderQuick();
    await openCarePlanText(user, fixtureF);
    await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT F" });
    const tabs = screen.getByRole("navigation", { name: "Week or month" });
    expect(within(tabs).getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { level: 2, name: "The participant's week" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "The participant's month" })).not.toBeInTheDocument();

    await user.click(within(tabs).getByRole("button", { name: "Month" }));
    expect(await screen.findByRole("heading", { level: 2, name: "The participant's month" }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "The participant's week" })).not.toBeInTheDocument();
    await user.click(within(tabs).getByRole("button", { name: "Week" }));
    expect(screen.getByRole("heading", { level: 2, name: "The participant's week" })).toBeInTheDocument();
  });

  it("the grid is this month, Sunday to Saturday, one named cell per date, with one cell in the tab order", async () => {
    await openMonth(fixtureF, "Month");
    const grid = within(calendar()).getByRole("grid", { name: "April 2026, by date" });
    expect(within(grid).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    const cells = within(grid).getAllByRole("gridcell").filter((cell) => cell.hasAttribute("data-date"));
    expect(cells).toHaveLength(30);
    expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
    expect(within(grid).getByRole("gridcell", { name: "Sunday, Apr 5, 2026: no care" })).toBeInTheDocument();
    expect(within(grid).getByRole("gridcell", { name: /^Friday, Apr 3, 2026: .*PC - CDS 120 minutes/ })).toBeInTheDocument();
  });

  it("arrow keys move between dates, and Enter chooses the date to change", async () => {
    const { user } = await openMonth(fixtureF, "Month");
    const grid = within(calendar()).getByRole("grid");
    const first = within(grid).getByRole("gridcell", { name: /^Wednesday, Apr 1, 2026/ });
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(within(grid).getByRole("gridcell", { name: /^Thursday, Apr 2, 2026/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(within(grid).getByRole("gridcell", { name: /^Thursday, Apr 9, 2026/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(within(calendar()).getByRole("group", { name: "Change this day: Thursday, Apr 9, 2026" })).toBeInTheDocument();
    expect(within(grid).getByRole("gridcell", { name: /^Thursday, Apr 9, 2026/ })).toHaveAttribute("aria-selected", "true");
  });

  it("Month as a list shows the same month as rows: date, service, what, how much", async () => {
    const { user } = await openMonth(fixtureF, "Month");
    await user.click(within(calendar()).getByRole("button", { name: "Month as a list" }));
    const table = within(calendar()).getByRole("table", { name: "April 2026 as a list" });
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Date", "Service", "What", "How much"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.length).toBeGreaterThan(10);
    const transport = rows.find((row) => /Essential transportation/.test(row.textContent ?? ""))!;
    expect(within(transport).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Apr 3, 2026", "PC - CDS", "Essential transportation", "120 min",
    ]);
    expect(within(calendar()).queryByRole("grid")).not.toBeInTheDocument();
  });

  it("a nurse visit placed on a date shows on the calendar that month, with the balance beside it", async () => {
    const { user } = await openMonth(fixtureF, "Month");
    const visits = (await screen.findByRole("heading", { level: 2, name: "Nurse visits" })).closest("section")!;
    fireEvent.change(within(visits).getByLabelText("Pick a date for General Health Evaluation, May 2026"), { target: { value: "2026-05-12" } });
    await within(visits).findByText("May 12, 2026");

    const balances = within(calendar()).getByRole("region", { name: "Authorization balances" });
    expect(within(balances).getByText("Next nurse visit to place: General Health Evaluation, August 2026")).toBeInTheDocument();
    await user.click(within(calendar()).getByRole("button", { name: "Next month on the calendar" }));
    const grid = within(calendar()).getByRole("grid", { name: "May 2026, by date" });
    expect(within(grid).getByRole("gridcell", { name: /^Tuesday, May 12, 2026: .*GHE, Nurse visit, 1 visit$/ })).toBeInTheDocument();
    expect(within(balances).getByText("1 visit in May 2026 · 1 visit placed · 0 visits left")).toBeInTheDocument();
    expect(within(balances).getByText(/^226 units in May 2026 · /)).toBeInTheDocument();
  });

  it("Change this day changes that date only, and a change over the month's units is refused there", async () => {
    const { user } = await openMonth(fixtureF, "Month");
    await user.click(within(calendar()).getByRole("button", { name: "Month as a list" }));
    const table = within(calendar()).getByRole("table");
    const row = within(table).getAllByRole("row").find((candidate) => /HC/.test(within(candidate).queryAllByRole("cell")[1]?.textContent ?? ""))!;
    const [dateCell, , whatCell, amountCell] = within(row).getAllByRole("cell");
    const dateText = dateCell!.textContent!;
    const before = Number(amountCell!.textContent!.replace(" min", ""));
    await user.click(within(row).getByRole("button", { name: dateText }));

    const form = within(calendar()).getByRole("group", { name: new RegExp(`^Change this day: .*${dateText}$`) });
    const field = within(form).getByLabelText(`HC: ${whatCell!.textContent}, minutes on ${dateText}`);
    expect(field).toHaveValue(String(before));
    await user.clear(field);
    await user.type(field, "9999");
    await user.click(within(form).getByRole("button", { name: new RegExp(`^Save HC: `) }));
    expect(await within(form).findByRole("alert")).toHaveTextContent(/^Not changed\./);

    await user.clear(field);
    await user.type(field, "0");
    await user.click(within(form).getByRole("button", { name: new RegExp(`^Save HC: `) }));
    // The task is off that date (other services' tasks that day are still listed).
    const label = `HC: ${whatCell!.textContent}, minutes on ${dateText}`;
    await waitFor(() => expect(within(form).queryByLabelText(label)).not.toBeInTheDocument());
    const hcRows = () =>
      within(calendar()).getAllByRole("row").filter((candidate) => within(candidate).queryAllByRole("cell")[1]?.textContent === "HC");
    expect(hcRows().some((candidate) => within(candidate).queryAllByRole("cell")[0]?.textContent === dateText)).toBe(false);
    // Only that date changed: the service is still on its day in the other weeks of the month.
    expect(hcRows().length).toBeGreaterThan(0);
  });

  it("a plan of one service gets a button for the month calendar, closed to begin with", async () => {
    const { user } = renderQuick();
    await openCarePlanText(user, fixtureE);
    await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT E" });
    const open = screen.getByRole("button", { name: "Show the month calendar" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    await user.click(open);
    expect(await screen.findByRole("heading", { level: 2, name: "The participant's month" }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide the month calendar" })).toHaveAttribute("aria-expanded", "true");
  });

  it("the example has no calendar button: it is for a plan the person opened or built", () => {
    renderQuick();
    expect(screen.queryByRole("button", { name: "Show the month calendar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Week or month" })).not.toBeInTheDocument();
  });
});
