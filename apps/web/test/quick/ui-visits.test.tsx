import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// Apr 15, 2026: inside fixture F's plan, before its May and August evaluations (CP3-2).
setUpQuickTests(new Date("2026-04-15T12:00:00-05:00"));

async function openF() {
  const result = renderQuick();
  await openCarePlanText(result.user, fixtureF);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT F" });
  // The dated side is its own chunk: wait for it.
  await screen.findByRole("heading", { level: 2, name: "Nurse visits" });
  return result;
}

function visitsPanel(): HTMLElement {
  return screen.getByRole("heading", { level: 2, name: "Nurse visits" }).closest("section")!;
}

function pickDate(name: RegExp, value: string): void {
  fireEvent.change(within(visitsPanel()).getByLabelText(name), { target: { value } });
}

describe("Nurse visits on dates (APP-SPEC 5.8, RN-01 to RN-04)", () => {
  it("lists each authorized visit with no date, and a date picker limited to its month", async () => {
    await openF();
    const panel = visitsPanel();
    expect(within(panel).getByText("Each is authorized for one month. Pick the date the nurse will come; it has to be in that month.")).toBeInTheDocument();
    expect(within(panel).getAllByText("No date yet")).toHaveLength(2);
    const may = within(panel).getByLabelText("Pick a date for General Health Evaluation, May 2026");
    expect(may).toHaveAttribute("type", "date");
    expect(may).toHaveAttribute("min", "2026-05-01");
    expect(may).toHaveAttribute("max", "2026-05-31");
    expect(within(panel).getByLabelText("Pick a date for General Health Evaluation, August 2026")).toHaveAttribute("min", "2026-08-01");
  });

  it("picking a date places the visit, shows it and adds the upload reminder for the next month", async () => {
    await openF();
    pickDate(/^Pick a date for General Health Evaluation, May 2026$/, "2026-05-12");
    const panel = visitsPanel();
    expect(await within(panel).findByText("May 12, 2026")).toBeInTheDocument();
    expect(within(panel).getByLabelText("Visit date for General Health Evaluation, May 2026")).toHaveValue("2026-05-12");
    expect(within(panel).getByText("Reminder, not a visit · Jun 15, 2026 · Upload the evaluation (HCBS 08-26-01)")).toBeInTheDocument();
    // One visit is authorized, so there is no second picker for May.
    expect(within(panel).queryByLabelText("Pick a date for General Health Evaluation, May 2026")).not.toBeInTheDocument();
    expect(within(panel).getAllByText("No date yet")).toHaveLength(1);
  });

  it("a date outside the month is refused beside the visit, and nothing is placed", async () => {
    await openF();
    pickDate(/^Pick a date for General Health Evaluation, May 2026$/, "2026-06-02");
    const alert = await within(visitsPanel()).findByRole("alert");
    expect(alert).toHaveTextContent(
      "Not placed. Jun 2, 2026 is outside May 2026, the month this is authorized for. Pick a date in that month.",
    );
    expect(within(visitsPanel()).getAllByText("No date yet")).toHaveLength(2);
  });

  it("the date can be changed and removed; the reminder follows", async () => {
    const { user } = await openF();
    pickDate(/^Pick a date for General Health Evaluation, May 2026$/, "2026-05-12");
    await within(visitsPanel()).findByText("May 12, 2026");
    pickDate(/^Visit date for General Health Evaluation, May 2026$/, "2026-05-20");
    expect(await within(visitsPanel()).findByText("May 20, 2026")).toBeInTheDocument();

    await user.click(within(visitsPanel()).getByRole("button", { name: "Remove the date for General Health Evaluation, May 2026" }));
    await waitFor(() => expect(within(visitsPanel()).getAllByText("No date yet")).toHaveLength(2));
    expect(within(visitsPanel()).queryByText(/Reminder, not a visit/)).not.toBeInTheDocument();
  });

  it("a reload keeps the placed date, and storage holds no name or DCN", async () => {
    const { unmount } = await openF();
    pickDate(/^Pick a date for General Health Evaluation, August 2026$/, "2026-08-20");
    await within(visitsPanel()).findByText("Aug 20, 2026");
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v3")).toContain("2026-08-20"));
    expect(sessionStorage.getItem("cps.quick.v3")).not.toMatch(/SAMPLE PARTICIPANT|10000006/);
    unmount();
    renderQuick();
    expect(within(visitsPanel()).getByText("Aug 20, 2026")).toBeInTheDocument();
  });
});

describe("a passed visit month (RN-04)", () => {
  it("says no date was placed, and stops saying it once one is", async () => {
    // Fixture F on Oct 21, 2026: May and August have passed.
    vi.setSystemTime(new Date("2026-10-21T12:00:00-05:00"));
    await openF();
    const panel = visitsPanel();
    expect(within(panel).getAllByText("No date was placed for this month's visit. Pick a date above if one was arranged.")).toHaveLength(2);
    pickDate(/^Pick a date for General Health Evaluation, May 2026$/, "2026-05-12");
    await within(visitsPanel()).findByText("May 12, 2026");
    expect(within(visitsPanel()).getAllByText("No date was placed for this month's visit. Pick a date above if one was arranged.")).toHaveLength(1);
  });
});
