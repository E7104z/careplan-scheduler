import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BEFORE_B, pasteText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";

// Fixture B's whole plan (Dec 2025 to Oct 2026) is still to come, so every month is scheduled.
setUpQuickTests(BEFORE_B);

/** B with Fusion's figure lowered to 440: its tasks need more, so months are cut at the end (SCH-17). */
const B_AT_440 = fixtureB.replaceAll("455 units", "440 units");

async function buildB(user: UserEvent, text: string = fixtureB): Promise<void> {
  await pasteText(user, text);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });
}

/** The weekly grid. A role query inside it is about 4 times quicker than one over the whole page. */
function grid(): HTMLElement {
  return screen.getByRole("table", { name: "Weekly schedule" });
}

function cell(task: string, weekday: string, minutes: number): HTMLElement {
  return within(grid()).getByRole("button", { name: `${task}, ${weekday}, ${minutes} minutes. Change minutes` });
}

function cellInput(task: string, weekday: string, minutes: number): HTMLElement {
  return within(grid()).getByRole("spinbutton", { name: `${task}, ${weekday}, ${minutes} minutes. Enter 0 to remove this day.` });
}

async function changeCell(user: UserEvent, task: string, weekday: string, from: number, to: number): Promise<void> {
  await user.click(cell(task, weekday, from));
  const input = cellInput(task, weekday, from);
  await user.clear(input);
  await user.type(input, `${to}{Enter}`);
}

/** QS-10's warn underline on a cell a person changed. */
function changed(element: HTMLElement): boolean {
  return element.querySelector('[data-mark="changed"]') !== null;
}

/** Inside an element the print stylesheet hides (Tailwind's `print:hidden`). */
function hiddenInPrint(element: HTMLElement): boolean {
  return element.closest('[class~="print:hidden"]') !== null;
}

describe("Quick Schedule: weekly grid", () => {
  it("QS-10: scheduled cells are tinted, and a changed cell is underlined", async () => {
    const { user } = renderQuick();
    await buildB(user);
    expect(cell("Bathing", "Monday", 45)).toHaveClass("bg-brand-tint");
    expect(changed(cell("Bathing", "Monday", 45))).toBe(false);

    await changeCell(user, "Bathing", "Monday", 45, 30);
    expect(changed(cell("Bathing", "Monday", 30))).toBe(true);
    expect(cell("Bathing", "Monday", 30)).not.toHaveClass("bg-warn-bg");
    expect(changed(cell("Bathing", "Wednesday", 45))).toBe(false);
  });

  it("QS-10: minutes above the task's own get the warn fill, and Undo my minute changes clears it", async () => {
    const { user } = renderQuick();
    await buildB(user);
    // Taking 15 minutes off Monday leaves room for 10 more on Tuesday.
    await changeCell(user, "Bathing", "Monday", 45, 30);
    await changeCell(user, "Bathing", "Tuesday", 45, 60);
    await user.click(screen.getByRole("button", { name: "Use 55 minutes" }));
    expect(changed(cell("Bathing", "Tuesday", 55))).toBe(true);
    expect(cell("Bathing", "Tuesday", 55)).toHaveClass("bg-warn-bg", "text-warn");

    await user.click(screen.getByRole("button", { name: "Undo my minute changes" }));
    expect(changed(cell("Bathing", "Tuesday", 45))).toBe(false);
    expect(cell("Bathing", "Tuesday", 45)).not.toHaveClass("bg-warn-bg");
  });

  it("a cell opens with its minutes selected; Enter, Escape and Use N minutes leave focus on the cell", async () => {
    const select = vi.spyOn(HTMLInputElement.prototype, "select");
    const { user } = renderQuick();
    await buildB(user);

    await user.click(cell("Bathing", "Monday", 45));
    expect(cellInput("Bathing", "Monday", 45)).toHaveFocus();
    expect(select).toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(cell("Bathing", "Monday", 45)).toHaveFocus());

    await changeCell(user, "Bathing", "Monday", 45, 30);
    await waitFor(() => expect(cell("Bathing", "Monday", 30)).toHaveFocus());

    await changeCell(user, "Bathing", "Tuesday", 45, 60);
    expect(screen.getByRole("alert")).toHaveTextContent("The most Bathing can have on Tuesday is 55 minutes.");
    await waitFor(() => expect(cell("Bathing", "Tuesday", 45)).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Use 55 minutes" }));
    await waitFor(() => expect(cell("Bathing", "Tuesday", 55)).toHaveFocus());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    select.mockRestore();
  });

  it("days a task isn't on read as \"Not scheduled\"", async () => {
    const { user } = renderQuick();
    await buildB(user);
    const row = screen.getByRole("rowheader", { name: /^Clean Bath/ }).closest("tr")!;
    expect(within(row).getAllByText("Not scheduled").length).toBe(6);
  });
});

describe("Quick Schedule: month", () => {
  it("says exactly which tasks are cut on which dates when the month's units run out, and why", async () => {
    const { user } = renderQuick();
    await buildB(user, B_AT_440);
    expect(screen.getByLabelText("Units in December 2025")).toBeInTheDocument();

    expect(
      screen.getByText(/This month's tasks need more than Fusion's 440 units, so the schedule stops 320 minutes early, starting Dec 30, 2025\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Dec 30, 2025: Meal Prep/Eating 60 min, Bathing 45 min, Wash Dishes 15 min, Dressing/Grooming 5 min")).toBeInTheDocument();
    expect(screen.getByText(/^Dec 31, 2025: Meal Prep\/Eating 60 min, Bathing 45 min, Clean Bath 20 min, /)).toBeInTheDocument();
    expect(screen.getByText(/a consistent need to change a task should prompt a request to the care plan change team \(INFO 09-25-02\)/)).toBeInTheDocument();

    const label = screen.getByText(/^Wednesday 31: \d+ minutes, 195 minutes trimmed because the month's units run out$/);
    expect(label).toHaveClass("sr-only");
    expect(label.parentElement).toHaveTextContent("−195 min");
    expect(label.parentElement).toHaveClass("border-warn");
    expect(screen.getByText(/^Monday 1: \d+ minutes$/)).toHaveClass("sr-only");
  });

  it("AC-26: shows the month's units authorized, scheduled and left, and every month on request", async () => {
    const { user } = renderQuick();
    await buildB(user);
    const balance = screen.getByLabelText("Units in December 2025");
    expect(within(balance).getByText("469 units")).toBeInTheDocument();
    expect(within(balance).getByText("Fusion, for 31 days")).toBeInTheDocument();
    expect(within(balance).getByText(/for tasks, 23 for transportation$/)).toBeInTheDocument();
    expect(screen.getByText("Fusion, for a 31-day month: 469 units − 23 transportation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show every month" }));
    const table = screen.getByRole("table", { name: "Units by month" });
    const february = within(table).getByRole("rowheader", { name: "February 2026" }).closest("tr")!;
    expect(within(february).getAllByRole("cell")[0]).toHaveTextContent("434");
    expect(within(table).getAllByRole("row")).toHaveLength(12);
  });
});

describe("Quick Schedule: print", () => {
  it("prints the Must fix and Needs review checks, not Worth checking, Good to know or the controls", async () => {
    const { user } = renderQuick();
    // At 440 units Fusion's figure differs from the tasks, so there's a Needs review check (AUTH-07).
    await buildB(user, B_AT_440);
    await changeCell(user, "Bathing", "Monday", 45, 30);

    expect(hiddenInPrint(screen.getByRole("heading", { level: 3, name: /^Needs review/ }))).toBe(false);
    expect(hiddenInPrint(screen.getByText(/^Good to know \(\d+\)$/))).toBe(true);
    expect(hiddenInPrint(screen.getByRole("button", { name: "Previous month" }))).toBe(true);
    expect(hiddenInPrint(screen.getByRole("button", { name: "Next month" }))).toBe(true);
    expect(hiddenInPrint(screen.getByRole("button", { name: "Undo my minute changes" }))).toBe(true);
    expect(hiddenInPrint(screen.getByRole("heading", { level: 2, name: "Month" }))).toBe(false);
  });
});
