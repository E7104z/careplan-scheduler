import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-8 on the page: fixture F on Apr 15, 2026.
setUpQuickTests(new Date("2026-04-15T12:00:00-05:00"));

async function openF() {
  const result = renderQuick();
  await openCarePlanText(result.user, fixtureF);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT F" });
  await screen.findByRole("heading", { level: 2, name: "Backup coverage" }, { timeout: 5000 });
  return result;
}

function section(name: string): HTMLElement {
  return screen.getByRole("heading", { level: 2, name }).closest("section")!;
}

describe("Backup coverage (APP-SPEC 5.8, Manual 4.15)", () => {
  it("asks for caregivers first", async () => {
    await openF();
    expect(within(section("Backup coverage")).getByText(/Add caregivers and visit times first/)).toBeInTheDocument();
  });

  it("marks a caregiver away, refusing dates that aren't entered, and changes nothing else", async () => {
    const { user } = await openF();
    await user.click(within(section("Caregivers")).getByRole("button", { name: "Add a caregiver" }));
    const panel = () => section("Backup coverage");
    await user.click(await within(panel()).findByRole("button", { name: "Mark away" }));
    expect(await within(panel()).findByRole("alert")).toHaveTextContent("Not changed. Enter the first and last day away as dates.");
    await user.type(within(panel()).getByLabelText("First day away"), "2026-05-03");
    await user.type(within(panel()).getByLabelText("Last day away"), "2026-05-09");
    await user.click(within(panel()).getByRole("button", { name: "Mark away" }));
    expect(await within(panel()).findByText("Caregiver 1 away May 3, 2026 to May 9, 2026")).toBeInTheDocument();
    // No visit times or assignments yet, so nothing is left uncovered and no one was assigned.
    expect(within(panel()).getByText("Nothing uncovered")).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v3")).toContain('"unavailable":[{'));
    expect(sessionStorage.getItem("cps.quick.v3")).toContain('"substitutes":[]');
    await user.click(within(panel()).getByRole("button", { name: "Remove absence 1" }));
    await waitFor(() => expect(within(panel()).queryByText(/away May 3, 2026/)).not.toBeInTheDocument());
  });
});
