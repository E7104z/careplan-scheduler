import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureQ from "@fixtures/fusion/Q-care-plan-report-apc-rn.txt?raw";

// The Nov 17, 2026 review, on the screen: fixture Q (APC, two RN authorizations, PC - Agency).
setUpQuickTests(new Date("2026-11-17T12:00:00-06:00"));

function weekPanel(): HTMLElement {
  return screen.getByRole("heading", { level: 2, name: "The participant's week" }).closest("section")!;
}

describe("Quick Schedule: an APC and RN care plan (Nov 17, 2026 review)", () => {
  it("builds APC as Advanced Personal Care without asking, on four spread days, and flags the RN units", async () => {
    const { user } = renderQuick();
    await openCarePlanText(user, fixtureQ);
    await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT Q" });
    expect(screen.queryByRole("heading", { name: /Which service is/ })).not.toBeInTheDocument();

    const table = screen.getByRole("table", { name: /Each service's authorization/ });
    expect(within(table).getByText(/Advanced Personal Care · T1019TF/)).toBeInTheDocument();

    for (const name of ["Monday", "Wednesday", "Friday", "Saturday"]) {
      expect(within(within(weekPanel()).getByRole("region", { name })).getByText("Bowel Program")).toBeInTheDocument();
    }
    for (const name of ["Sunday", "Tuesday", "Thursday"]) {
      expect(within(within(weekPanel()).getByRole("region", { name })).getByText("No service")).toBeInTheDocument();
    }

    expect(
      screen.getByText(/RN \(PA 20260000000052\): its tasks add up to 3 visits a month \(Eval APC Plan 2, Train APC 1\), but Fusion authorized 2 a month\./),
    ).toBeInTheDocument();
    const visits = (await screen.findByRole("heading", { level: 2, name: "Nurse visits" }, { timeout: 5000 })).closest("section")!;
    expect(within(visits).getAllByText("Eval APC Plan, Train APC")).toHaveLength(6);
  });
});
