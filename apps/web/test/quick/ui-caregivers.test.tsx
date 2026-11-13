import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-2 on the page: fixture F on Apr 15, 2026. Names are made up ("Caregiver A").
setUpQuickTests(new Date("2026-04-15T12:00:00-05:00"));

async function openF() {
  const result = renderQuick();
  await openCarePlanText(result.user, fixtureF);
  await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT F" });
  await screen.findByRole("heading", { level: 2, name: "Caregivers" }, { timeout: 5000 });
  return result;
}

function section(name: string): HTMLElement {
  return screen.getByRole("heading", { level: 2, name }).closest("section")!;
}

describe("Caregivers (APP-SPEC 5.8, Coverage Phase 4)", () => {
  it("starts with none, and says names stay in this tab", async () => {
    await openF();
    const panel = section("Caregivers");
    expect(within(panel).getByText("None added")).toBeInTheDocument();
    expect(within(panel).getByText(/Names stay in this tab and are never saved\.$/)).toBeInTheDocument();
    expect(within(panel).queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("a new caregiver has nothing entered; a name shows on the page and in no storage", async () => {
    const { user } = await openF();
    await user.click(within(section("Caregivers")).getByRole("button", { name: "Add a caregiver" }));
    const panel = section("Caregivers");
    expect(within(panel).getByText("1 added")).toBeInTheDocument();
    expect(within(panel).getByLabelText("Relationship of Caregiver 1 to the participant")).toHaveValue("");
    expect(within(panel).getByLabelText("Agency employee: Caregiver 1")).toHaveValue("");
    expect(within(panel).getByLabelText("Nurse license: Caregiver 1")).toHaveValue("");
    expect(within(panel).getByLabelText("On the Family Care Safety Registry: Caregiver 1")).toHaveValue("");

    await user.type(within(panel).getByLabelText("Name of Caregiver 1 (kept in this tab only, never saved)"), "Caregiver A");
    expect(within(panel).getByText("Caregiver A")).toBeInTheDocument();
    await user.selectOptions(within(panel).getByLabelText("Relationship of Caregiver 1 to the participant"), "none");
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v3")).toContain('"relationship":"none"'));
    expect(sessionStorage.getItem("cps.quick.v3")).not.toContain("Caregiver A");
    expect(localStorage.length).toBe(0);
  });

  it("assigning with nothing entered is 'Needs review' in Visit checks; entering it clears the review", async () => {
    const { user } = await openF();
    await user.click(within(section("Caregivers")).getByRole("button", { name: "Add a caregiver" }));
    const panel = section("Caregivers");
    await user.click(within(panel).getByRole("checkbox", { name: "PC - Agency" }));
    const checks = section("Visit checks");
    expect(await within(checks).findByText("Caregiver details are missing")).toBeInTheDocument();
    expect(within(checks).getByText("PC - Agency · CON-17")).toBeInTheDocument();

    await user.selectOptions(within(panel).getByLabelText("Relationship of Caregiver 1 to the participant"), "none");
    await user.selectOptions(within(panel).getByLabelText("Agency employee: Caregiver 1"), "yes");
    await waitFor(() => expect(within(section("Visit checks")).queryByText("Caregiver details are missing")).not.toBeInTheDocument());
  });

  it("a spouse can't be made the CDS attendant: refused in the panel, and the box stays unticked", async () => {
    const { user } = await openF();
    await user.click(within(section("Caregivers")).getByRole("button", { name: "Add a caregiver" }));
    const panel = section("Caregivers");
    await user.selectOptions(within(panel).getByLabelText("Relationship of Caregiver 1 to the participant"), "spouse");
    await user.click(within(panel).getByRole("checkbox", { name: "PC - CDS" }));
    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "Not changed. This attendant can't be paid for this participant. A spouse or legal guardian can't be the CDS attendant.",
    );
    expect(within(panel).getByRole("checkbox", { name: "PC - CDS" })).not.toBeChecked();
  });

  it("after a reload the caregiver is 'Caregiver 1', still assigned, with what was entered", async () => {
    const { user, unmount } = await openF();
    await user.click(within(section("Caregivers")).getByRole("button", { name: "Add a caregiver" }));
    let panel = section("Caregivers");
    await user.type(within(panel).getByLabelText("Name of Caregiver 1 (kept in this tab only, never saved)"), "Caregiver A");
    await user.selectOptions(within(panel).getByLabelText("Relationship of Caregiver 1 to the participant"), "none");
    await user.selectOptions(within(panel).getByLabelText("Agency employee: Caregiver 1"), "yes");
    await user.click(within(panel).getByRole("checkbox", { name: "HC" }));
    await waitFor(() => expect(sessionStorage.getItem("cps.quick.v3")).toContain('"caregiverIds"'));

    unmount();
    renderQuick();
    await screen.findByRole("heading", { level: 2, name: "Caregivers" }, { timeout: 5000 });
    panel = section("Caregivers");
    expect(within(panel).getByText("Caregiver 1")).toBeInTheDocument();
    expect(within(panel).queryByText("Caregiver A")).not.toBeInTheDocument();
    expect(within(panel).getByLabelText("Name of Caregiver 1 (kept in this tab only, never saved)")).toHaveValue("");
    expect(within(panel).getByLabelText("Agency employee: Caregiver 1")).toHaveValue("yes");
    expect(within(panel).getByRole("checkbox", { name: "HC" })).toBeChecked();

    await user.click(within(panel).getByRole("button", { name: "Remove Caregiver 1" }));
    await waitFor(() => expect(within(section("Caregivers")).getByText("None added")).toBeInTheDocument());
  });
});
