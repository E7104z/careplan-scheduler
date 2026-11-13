import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-7 on the page: fixture F on Apr 15, 2026.
setUpQuickTests(new Date("2026-04-15T12:00:00-05:00"));

async function openF() {
  const result = renderQuick();
  await openCarePlanText(result.user, fixtureF);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT F" });
  await screen.findByRole("heading", { level: 2, name: "Other programs" }, { timeout: 5000 });
  return result;
}

function section(name: string): HTMLElement {
  return screen.getByRole("heading", { level: 2, name }).closest("section")!;
}

describe("Other programs (APP-SPEC 5.8, PRG-01 to PRG-03)", () => {
  it("starts with none entered and nothing about programs in Visit checks", async () => {
    await openF();
    expect(within(section("Other programs")).getByText("None entered")).toBeInTheDocument();
    expect(within(section("Visit checks")).queryByText("HCBS can't be given during PACE")).not.toBeInTheDocument();
  });

  it("PACE is recorded, not refused, and Visit checks says what it rules out", async () => {
    const { user } = await openF();
    await user.click(within(section("Other programs")).getByRole("button", { name: "Add a program" }));
    const panel = section("Other programs");
    expect(within(panel).getByText("1 entered")).toBeInTheDocument();
    expect(within(panel).getByLabelText("Program")).toHaveValue("PACE");
    expect(await within(section("Visit checks")).findByText("HCBS can't be given during PACE")).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v3")).toContain('"program":"PACE"'));
    expect(sessionStorage.getItem("cps.quick.v3")).not.toMatch(/SAMPLE PARTICIPANT|10000006/);
  });

  it("changing to a DMH program changes the check, and removing it clears it", async () => {
    const { user } = await openF();
    await user.click(within(section("Other programs")).getByRole("button", { name: "Add a program" }));
    await user.selectOptions(within(section("Other programs")).getByLabelText("Program"), "DD_ISL");
    expect(await within(section("Visit checks")).findByText("This DMH program rules out this personal care")).toBeInTheDocument();
    await user.click(within(section("Other programs")).getByRole("button", { name: "Remove program 1" }));
    await waitFor(() => expect(within(section("Other programs")).getByText("None entered")).toBeInTheDocument());
    expect(within(section("Visit checks")).queryByText("This DMH program rules out this personal care")).not.toBeInTheDocument();
  });
});
