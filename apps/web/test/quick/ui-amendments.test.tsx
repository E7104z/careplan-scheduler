import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BEFORE_B, openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";

// CP3-6 on the page: fixture B on Nov 20, 2025, before its plan (Dec 1, 2025 to Oct 31, 2026) starts.
setUpQuickTests(BEFORE_B);

async function openB() {
  const result = renderQuick();
  await openCarePlanText(result.user, fixtureB);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });
  // The panel is in the dated-side chunk: wait for it.
  await screen.findByRole("heading", { level: 2, name: "Care plan changes" }, { timeout: 5000 });
  return result;
}

function form(): HTMLElement {
  return screen.getByRole("group", { name: "Record a care plan change" });
}

function panel(): HTMLElement {
  return screen.getByRole("heading", { level: 2, name: "Care plan changes" }).closest("section")!;
}

describe("Care plan changes (APP-SPEC 5.8, Manual 4.20)", () => {
  it("offers the form on a plan the person opened, and not on the example", async () => {
    renderQuick();
    expect(screen.getByRole("heading", { level: 2, name: "Example care plan" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("heading", { level: 2, name: "Care plan changes" })).not.toBeInTheDocument();
  });

  it("the form has the kind, the date, the units and every task with its present minutes and days", async () => {
    await openB();
    expect(within(panel()).getByText("None recorded")).toBeInTheDocument();
    const kind = within(form()).getByLabelText("Kind of change");
    expect(within(kind).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Increase", "Decrease", "Reduction asked for by the participant",
    ]);
    const date = within(form()).getByLabelText("Effective date");
    expect(date).toHaveAttribute("min", "2025-12-01");
    expect(date).toHaveAttribute("max", "2026-10-31");
    expect(within(form()).getByLabelText("Bathing: minutes a day from the change on")).toHaveValue("45");
    expect(within(form()).getByLabelText("Bathing: days a week from the change on")).toHaveValue("7");
    expect(within(form()).getByLabelText("The care plan shows this date")).not.toBeChecked();
  });

  it("recording an increase lists it with its date, what changes and that it needs review", async () => {
    const { user } = await openB();
    fireEvent.change(within(form()).getByLabelText("Effective date"), { target: { value: "2026-01-15" } });
    const minutes = within(form()).getByLabelText("Bathing: minutes a day from the change on");
    await user.clear(minutes);
    await user.type(minutes, "60");
    await user.click(within(form()).getByRole("button", { name: "Record change" }));

    const recorded = await within(panel()).findByRole("list", { name: "Recorded care plan changes" });
    expect(within(recorded).getByText("Increase · Takes effect Jan 15, 2026")).toBeInTheDocument();
    expect(within(recorded).getByText("Bathing: 45 min a day, 7 days a week → 60 min a day, 7 days a week")).toBeInTheDocument();
    expect(
      within(recorded).getByText("Needs review: check the date this change takes effect against the care plan (Manual 4.20)."),
    ).toBeInTheDocument();
    expect(within(panel()).getByText("1 recorded")).toBeInTheDocument();
    // What Fusion printed is untouched: the read summary still shows 455 and Bathing at 45.
    expect(screen.getByText(/^Our total from these tasks matches Fusion's 455 units for a 30-day month\./)).toBeInTheDocument();
  });

  it("a decrease dated mid-month says it starts the first of the next month", async () => {
    const { user } = await openB();
    await user.selectOptions(within(form()).getByLabelText("Kind of change"), "decrease");
    expect(
      within(form()).getByText("A decrease starts on the first of a month. One dated later in a month starts the first of the next month."),
    ).toBeInTheDocument();
    fireEvent.change(within(form()).getByLabelText("Effective date"), { target: { value: "2026-01-15" } });
    const minutes = within(form()).getByLabelText("Bathing: minutes a day from the change on");
    await user.clear(minutes);
    await user.type(minutes, "30");
    await user.click(within(form()).getByLabelText("The care plan shows this date"));
    await user.click(within(form()).getByRole("button", { name: "Record change" }));
    expect(
      await within(panel()).findByText("Decrease · Takes effect Feb 1, 2026 (entered Jan 15, 2026; a decrease starts on the first of a month)"),
    ).toBeInTheDocument();
    expect(within(panel()).getByText("You said the care plan shows this date.")).toBeInTheDocument();
  });

  it("says what is missing, and shows the guard's refusal beside the form", async () => {
    const { user } = await openB();
    await user.click(within(form()).getByRole("button", { name: "Record change" }));
    expect(within(form()).getByRole("alert")).toHaveTextContent("Enter the date the change takes effect.");

    fireEvent.change(within(form()).getByLabelText("Effective date"), { target: { value: "2026-01-15" } });
    await user.click(within(form()).getByRole("button", { name: "Record change" }));
    expect(await within(form()).findByRole("alert")).toHaveTextContent(
      "Not recorded. Change a task's minutes or days, or enter the new units a month.",
    );
    expect(within(panel()).getByText("None recorded")).toBeInTheDocument();
  });

  it("a recorded change can be removed, and a reload keeps what is recorded", async () => {
    const { user, unmount } = await openB();
    fireEvent.change(within(form()).getByLabelText("Effective date"), { target: { value: "2026-01-15" } });
    await user.type(within(form()).getByLabelText("New units a month (optional)"), "480");
    await user.click(within(form()).getByRole("button", { name: "Record change" }));
    await within(panel()).findByText("480 units a month from the change on");
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v3")).toContain('"amendments"'));

    unmount();
    renderQuick();
    await screen.findByRole("heading", { level: 2, name: "Care plan changes" });
    expect(within(panel()).getByText("480 units a month from the change on")).toBeInTheDocument();
    await user.click(within(panel()).getByRole("button", { name: "Remove the change of Jan 15, 2026" }));
    await waitFor(() => expect(within(panel()).getByText("None recorded")).toBeInTheDocument());
  });
});
