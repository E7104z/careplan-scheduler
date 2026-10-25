import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { pasteText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";

setUpQuickTests();

async function buildB(user: UserEvent): Promise<void> {
  await pasteText(user, fixtureB);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });
}

function cell(task: string, weekday: string, minutes: number): HTMLElement {
  return screen.getByRole("button", { name: `${task}, ${weekday}, ${minutes} minutes. Change minutes` });
}

function cellInput(task: string, weekday: string, minutes: number): HTMLElement {
  return screen.getByRole("spinbutton", { name: `${task}, ${weekday}, ${minutes} minutes. Enter 0 to remove this day.` });
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
  // Several edits on fixture B's 11-month plan: about 4 s alone, more when the whole suite runs.
  it("QS-10: scheduled cells are tinted, changed cells underlined, and minutes above the task's own get the warn fill", { timeout: 15_000 }, async () => {
    const { user } = renderQuick();
    await buildB(user);
    expect(cell("Bathing", "Monday", 45)).toHaveClass("bg-brand-tint");
    expect(changed(cell("Bathing", "Monday", 45))).toBe(false);

    await changeCell(user, "Bathing", "Monday", 45, 30);
    expect(changed(cell("Bathing", "Monday", 30))).toBe(true);
    expect(cell("Bathing", "Monday", 30)).not.toHaveClass("bg-warn-bg");
    expect(changed(cell("Bathing", "Wednesday", 45))).toBe(false);

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
  it("names a trimmed date for screen readers and marks it \"−95 min\"", async () => {
    const { user } = renderQuick();
    await buildB(user);
    for (let i = 0; i < 10; i++) await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("December 2025")).toBeInTheDocument();

    const label = screen.getByText(/^Wednesday 31: \d+ minutes, 95 minutes trimmed because the month's units run out$/);
    expect(label).toHaveClass("sr-only");
    expect(label.parentElement).toHaveTextContent("−95 min");
    expect(label.parentElement).toHaveClass("border-warn");
    expect(screen.getByText(/^Monday 1: \d+ minutes$/)).toHaveClass("sr-only");
  });
});

describe("Quick Schedule: print", () => {
  it("prints the Must fix and Needs review checks, not Worth checking, Good to know or the controls", async () => {
    const { user } = renderQuick();
    await buildB(user);
    await changeCell(user, "Bathing", "Monday", 45, 30);

    expect(hiddenInPrint(screen.getByRole("heading", { level: 3, name: /^Needs review/ }))).toBe(false);
    expect(hiddenInPrint(screen.getByText(/^Good to know \(\d+\)$/))).toBe(true);
    expect(hiddenInPrint(screen.getByRole("button", { name: "Previous month" }))).toBe(true);
    expect(hiddenInPrint(screen.getByRole("button", { name: "Next month" }))).toBe(true);
    expect(hiddenInPrint(screen.getByRole("button", { name: "Undo my minute changes" }))).toBe(true);
    expect(hiddenInPrint(screen.getByRole("heading", { level: 2, name: "Month" }))).toBe(false);
  });
});
