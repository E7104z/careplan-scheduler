import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-1 on the page: fixture F on Apr 15, 2026.
setUpQuickTests(new Date("2026-04-15T12:00:00-05:00"));

async function openF() {
  const result = renderQuick();
  await openCarePlanText(result.user, fixtureF);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT F" });
  // Visit checks are in the dated-side chunk: wait for them.
  await screen.findByRole("heading", { level: 2, name: "Visit checks" }, { timeout: 5000 });
  return result;
}

function section(name: string): HTMLElement {
  return screen.getByRole("heading", { level: 2, name }).closest("section")!;
}

describe("Visit checks and start times (APP-SPEC 5.8, Coverage Phase 4)", () => {
  it("a plan as opened says overlaps can't be checked yet: needs review, never a pass", async () => {
    await openF();
    const checks = section("Visit checks");
    expect(within(checks).getByText("1 needs review")).toBeInTheDocument();
    expect(within(checks).getByText("Needs review")).toBeInTheDocument();
    expect(within(checks).getByText("No clock times yet, so overlaps can't be checked")).toBeInTheDocument();
    expect(within(checks).getByText("PC - Agency, PC - CDS, HC · CON-01, CON-02")).toBeInTheDocument();
    expect(within(checks).queryByText(/Every visit rule we can check/)).not.toBeInTheDocument();
  });

  it("a service in detail offers a start time for each care day, with the visit's length", async () => {
    const { user } = await openF();
    await user.click(screen.getByRole("button", { name: "Open PC - CDS" }));
    const times = (await screen.findByRole("heading", { level: 2, name: "Visit start times" }, { timeout: 5000 })).closest("section")!;
    expect(within(times).getByText("Optional. Add a start time to check overlaps with other services.")).toBeInTheDocument();
    expect(within(times).getByText("None set")).toBeInTheDocument();
    const friday = within(times).getByLabelText("Friday start time");
    expect(friday).toHaveAttribute("type", "time");
    expect(within(times).getByText("Visit length 2 h")).toBeInTheDocument();

    fireEvent.change(friday, { target: { value: "09:00" } });
    expect(await within(times).findByText("Visit length 2 h, ends 11:00 AM")).toBeInTheDocument();
    expect(within(times).getByText("1 of 1 set")).toBeInTheDocument();
    // The daily task list shows it where the visit is.
    expect(within(section("Daily task list")).getByText("Starts 9:00 AM")).toBeInTheDocument();
    // On the whole care plan, that service is no longer under review; the others still are.
    await user.click(screen.getByRole("button", { name: /Whole care plan/ }));
    await waitFor(() => expect(within(section("Visit checks")).getByText("PC - Agency, HC · CON-01, CON-02")).toBeInTheDocument());

    // Clearing the time puts the service back under review.
    await user.click(screen.getByRole("button", { name: "Open PC - CDS" }));
    const again = (await screen.findByRole("heading", { level: 2, name: "Visit start times" })).closest("section")!;
    fireEvent.change(within(again).getByLabelText("Friday start time"), { target: { value: "" } });
    expect(await within(again).findByText("None set")).toBeInTheDocument();
  });

  it("a visit that runs past midnight says it ends the next day", async () => {
    const { user } = await openF();
    await user.click(screen.getByRole("button", { name: "Open PC - CDS" }));
    const times = (await screen.findByRole("heading", { level: 2, name: "Visit start times" }, { timeout: 5000 })).closest("section")!;
    fireEvent.change(within(times).getByLabelText("Friday start time"), { target: { value: "23:00" } });
    expect(await within(times).findByText("Visit length 2 h, ends 1:00 AM the next day")).toBeInTheDocument();
  });

  it("the example has neither panel: they are for a plan the person opened or built", async () => {
    renderQuick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("heading", { level: 2, name: "Visit checks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Visit start times" })).not.toBeInTheDocument();
  });
});
