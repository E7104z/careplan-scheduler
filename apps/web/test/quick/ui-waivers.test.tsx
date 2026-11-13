import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-3 on the page: fixture F on Apr 15, 2026.
setUpQuickTests(new Date("2026-04-15T12:00:00-05:00"));

async function openF() {
  const result = renderQuick();
  await openCarePlanText(result.user, fixtureF);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT F" });
  await screen.findByRole("heading", { level: 2, name: "Waivers" }, { timeout: 5000 });
  return result;
}

function section(name: string): HTMLElement {
  return screen.getByRole("heading", { level: 2, name }).closest("section")!;
}

describe("Waivers (APP-SPEC 5.8, CON-16)", () => {
  it("starts with none entered", async () => {
    await openF();
    const panel = section("Waivers");
    expect(within(panel).getByText("None entered")).toBeInTheDocument();
    expect(within(panel).queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("a waiver is added with the plan's dates and can be changed", async () => {
    const { user } = await openF();
    await user.click(within(section("Waivers")).getByRole("button", { name: "Add a waiver" }));
    const panel = section("Waivers");
    expect(within(panel).getByText("1 entered")).toBeInTheDocument();
    expect(within(panel).getByLabelText("Waiver")).toHaveValue("ADW");
    await user.selectOptions(within(panel).getByLabelText("Waiver"), "ILW");
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v3")).toContain('"waiver":"ILW"'));
    expect(sessionStorage.getItem("cps.quick.v3")).not.toMatch(/SAMPLE PARTICIPANT|10000006/);
  });

  it("two overlapping enrollments are refused in the panel", async () => {
    const { user } = await openF();
    const add = within(section("Waivers")).getByRole("button", { name: "Add a waiver" });
    await user.click(add);
    await user.click(add);
    expect(await within(section("Waivers")).findByRole("alert")).toHaveTextContent(
      "Not changed. Two waiver enrollments overlap.",
    );
    // Only the first enrollment stayed.
    expect(within(section("Waivers")).getByText("1 entered")).toBeInTheDocument();
  });

  it("removing the enrollment returns the panel to none entered", async () => {
    const { user } = await openF();
    await user.click(within(section("Waivers")).getByRole("button", { name: "Add a waiver" }));
    await user.click(within(section("Waivers")).getByRole("button", { name: "Remove waiver 1" }));
    await waitFor(() => expect(within(section("Waivers")).getByText("None entered")).toBeInTheDocument());
  });
});
