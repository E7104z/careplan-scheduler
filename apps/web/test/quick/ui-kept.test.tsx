import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { openCarePlanText, renderQuick, setUpQuickTests } from "./ui-helpers";
import fixtureA from "@fixtures/fusion/A-run-together-5day-466.txt?raw";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";
import fixtureG from "@fixtures/fusion/G-care-plan-report-kept.txt?raw";

// IMP-19 / AC-30 on the page: what the schedule doesn't place is still shown, and a service we
// don't know can be kept rather than forced into one we do.
function othersPanel(): HTMLElement {
  return screen.getByRole("heading", { level: 2, name: "Other authorizations" }).closest("section")!;
}

describe("Quick Schedule: other authorizations (IMP-19)", () => {
  describe("fixture G, Oct 31, 2026", () => {
    setUpQuickTests(new Date("2026-10-31T12:00:00-05:00"));

    it("schedules CDS and lists the five others with their own units and why", async () => {
      const { user } = renderQuick();
      await openCarePlanText(user, fixtureG);
      await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT G" });

      const panel = othersPanel();
      expect(within(panel).getByText("· Home Delivered Meals · S5170")).toBeInTheDocument();
      expect(within(panel).getByText("62 meals a month, Nov 2026 to Apr 2027")).toBeInTheDocument();
      expect(within(panel).getByText("· Not an Appendix 1 service · H2015")).toBeInTheDocument();
      expect(within(panel).getByText("Not recognized: kept for review")).toBeInTheDocument();
      expect(within(panel).getAllByText("Arranged by date")).toHaveLength(3);
      expect(within(panel).getByText("No caregiver time")).toBeInTheDocument();
      expect(within(panel).getAllByText("As read from Fusion")).toHaveLength(5);
      // The participant's name and DCN are only in the summary, never in this panel.
      expect(panel.textContent).not.toMatch(/SAMPLE PARTICIPANT|10000007/);
    });
  });

  describe("fixture F, Oct 21, 2026 (JOIN-01)", () => {
    setUpQuickTests();

    it("says on the whole care plan what was read and what became of it", async () => {
      const { user } = renderQuick();
      await openCarePlanText(user, fixtureF);
      const summary = await screen.findByRole("region", { name: "SAMPLE PARTICIPANT F" });
      expect(within(summary).getByText(/5 authorizations read: 3 scheduled in the week, 2 nurse visits by month\./)).toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 2, name: "Other authorizations" })).not.toBeInTheDocument();
    });
  });

  describe("a label we haven't seen, Jan 15, 2026", () => {
    setUpQuickTests(new Date("2026-01-15T12:00:00-06:00"));

    it("can be kept instead of named, and then says there's nothing to place in the week", async () => {
      const { user } = renderQuick();
      await openCarePlanText(user, fixtureA.replace("PC - CDS", "PC - Foo"));
      await screen.findByRole("heading", { name: 'Which service is "PC - Foo"?' });
      await user.click(screen.getByRole("button", { name: "Keep it, don't schedule it" }));
      expect(await screen.findByRole("heading", { name: "Nothing in this care plan goes in the week" })).toBeInTheDocument();
      expect(screen.getByText(/has tasks to place in the week: PC - Foo\./)).toBeInTheDocument();
    });
  });
});
