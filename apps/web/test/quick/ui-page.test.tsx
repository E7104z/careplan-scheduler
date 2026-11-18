import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";

setUpQuickTests();

describe("Quick Schedule: page", () => {
  it("one column (below 1060px): a link before the care plan skips to the schedule", async () => {
    renderQuick();
    const link = await screen.findByRole("link", { name: "Skip to the schedule" });
    expect(link).toHaveAttribute("href", "#qs-schedule");
    expect(link).toHaveClass("min-[1060px]:hidden");
    const carePlan = screen.getByRole("form", { name: "Care plan" });
    expect(link.compareDocumentPosition(carePlan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const schedule = document.getElementById("qs-schedule")!;
    expect(within(schedule).getByRole("status", { name: "Schedule status" })).toBeInTheDocument();
  });
});

describe("Quick Schedule: plan start by hand", () => {
  it("QS-03: a plan start that isn't a whole month says how to enter it and changes nothing", async () => {
    const { user } = renderQuick();
    await user.click(screen.getByRole("button", { name: "Build a schedule by hand" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Add a task" })).toHaveFocus());
    const start = screen.getByLabelText("Plan starts");

    // A browser without a month picker shows a text box; a cleared picker gives "" too.
    fireEvent.change(start, { target: { value: "" } });
    fireEvent.blur(start);
    expect(screen.getByText("Enter the month the plan starts, like 2026-11.")).toBeInTheDocument();
    expect(start).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("October 2027")).toBeInTheDocument();

    fireEvent.change(start, { target: { value: "2027-01" } });
    expect(screen.queryByText("Enter the month the plan starts, like 2026-11.")).not.toBeInTheDocument();
    expect(screen.getByText("December 2027")).toBeInTheDocument();
  });
});

describe("Quick Schedule: for the caregiver, the participant and EVV", () => {
  async function buildB(user: ReturnType<typeof renderQuick>["user"]): Promise<void> {
    await openCarePlanText(user, fixtureB);
    await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });
  }

  it("AC-26: the daily task list gives each visit's tasks and a visit length that is their total", async () => {
    const { user } = renderQuick();
    await buildB(user);
    const list = screen.getByRole("heading", { level: 2, name: "Daily task list" }).closest("section")!;
    const monday = within(list).getByRole("region", { name: "Monday" });
    expect(within(monday).getByText("Meal Prep/Eating").nextSibling).toHaveTextContent("60 min");
    expect(within(monday).getByText("Visit length 5 h 15 min")).toBeInTheDocument();
    expect(within(monday).getByText("315 minutes = 21 units")).toBeInTheDocument();
    // Friday, the last weekday care day, is the usual transportation day: 175 minutes of tasks and 60 of transportation.
    const friday = within(list).getByRole("region", { name: "Friday" });
    expect(within(friday).getByText("Essential transportation")).toBeInTheDocument();
    expect(within(friday).getByText("Visit length 3 h 55 min")).toBeInTheDocument();
    expect(within(friday).getByText("235 minutes = 15 units + 10 min (175 for tasks, 60 for transportation)")).toBeInTheDocument();
  });

  it("AC-26: reviewed with the participant: today's date by default, printed, and cleared by a change", async () => {
    const { user } = renderQuick();
    await buildB(user);
    expect(screen.getByText("Reviewed with the participant on ______________________")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "I went over this schedule with the participant" }));
    expect(screen.getByLabelText("Date reviewed")).toHaveValue("2026-10-21");
    expect(screen.getByText("Reviewed with the participant on Oct 21, 2026.")).toBeInTheDocument();

    await user.click(within(screen.getByRole("table", { name: "Weekly schedule" })).getByRole("button", { name: "Bathing, Monday, 45 minutes. Change minutes" }));
    await user.keyboard("{Control>}a{/Control}30{Enter}");
    expect(screen.getByRole("checkbox", { name: "I went over this schedule with the participant" })).not.toBeChecked();
  });

  it("QS-03: a plan start in a month that's over says which month is the first", async () => {
    const { user } = renderQuick();
    await user.click(screen.getByRole("button", { name: "Build a schedule by hand" }));
    const start = screen.getByLabelText("Plan starts");
    expect(start).toHaveAttribute("min", "2026-10");
    fireEvent.change(start, { target: { value: "2026-09" } });
    fireEvent.blur(start);
    expect(screen.getByText("Choose October 2026 or later.")).toBeInTheDocument();
    expect(screen.getByText("October 2027")).toBeInTheDocument();
  });
});

