import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderQuick, setUpQuickTests } from "./ui-helpers";

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
