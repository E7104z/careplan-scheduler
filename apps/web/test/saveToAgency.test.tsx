import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgencyContext } from "../src/features/agency/agencyContext";
import { AgencyQuickSchedule } from "../src/features/agency/AgencyQuickSchedule";
import { OPENED_PLAN_KEY } from "../src/features/agency/openedPlan";
import * as participants from "../src/features/agency/participants";
import * as savedPlans from "../src/features/agency/savedPlans";
import type { AgencyContextValue, MemberRole } from "../src/features/agency/types";
import { AuthContext, type AuthContextValue } from "../src/features/auth/authContext";
import type { CarePlan } from "../src/features/quick-schedule/types";
import { BEFORE_B, openCarePlanText, setUpQuickTests } from "./quick/ui-helpers";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";

vi.mock("../src/features/agency/participants", () => ({ listParticipants: vi.fn(), listVisits: vi.fn() }));
vi.mock("../src/features/agency/savedPlans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/agency/savedPlans")>();
  return { ...actual, phiStorageEnabled: vi.fn(), createParticipant: vi.fn(), listPlans: vi.fn(), savePlanFor: vi.fn() };
});

setUpQuickTests(BEFORE_B);

function auth(): AuthContextValue {
  return {
    user: { uid: "u-test-01", email: "p-test-01@example.com", displayName: "P-TEST-01", emailVerified: true, usesPassword: true },
    loading: false,
    emailVerified: true,
    leaving: false,
    signOut: vi.fn(async () => undefined),
    refresh: vi.fn(async () => true),
  };
}

function agency(role: MemberRole): AgencyContextValue {
  return {
    state: {
      memberships: [],
      tenantId: "t-test-01",
      tenant: { name: "P-TEST-AGENCY-01", state: "MO", timeZone: "America/Chicago", workweekStart: 0, baaVersion: "1.0" },
      role,
      members: [],
      agencyInvites: [],
      myInvites: [],
    },
    ready: true,
    error: null,
    reload: vi.fn(async () => undefined),
    switchAgency: vi.fn(async () => undefined),
  };
}

function renderAgencyQuick(role: MemberRole = "scheduler") {
  const user = userEvent.setup();
  render(
    <AuthContext.Provider value={auth()}>
      <AgencyContext.Provider value={agency(role)}>
        <MemoryRouter>
          <AgencyQuickSchedule />
        </MemoryRouter>
      </AgencyContext.Provider>
    </AuthContext.Provider>,
  );
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(savedPlans.phiStorageEnabled).mockResolvedValue(true);
  vi.mocked(participants.listParticipants).mockResolvedValue([{ id: "p-test-1", displayName: "P-001" }]);
  vi.mocked(savedPlans.createParticipant).mockResolvedValue("p-test-2");
  vi.mocked(savedPlans.savePlanFor).mockResolvedValue("plan-9");
  vi.mocked(savedPlans.listPlans).mockResolvedValue([]);
});

describe("Quick Schedule's Save to agency (PHASE-3-SPEC section 6)", () => {
  it("saves the plan under a new participant, then offers to update that same plan", async () => {
    const user = renderAgencyQuick();
    expect(screen.getByRole("note")).toHaveTextContent("Nothing is saved to your agency until you choose Save to agency.");
    await openCarePlanText(user, fixtureB);
    await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });

    await user.click(await screen.findByRole("button", { name: "Save to agency" }));
    let dialog = await screen.findByRole("dialog", { name: "Save to your agency" });
    await user.selectOptions(await within(dialog).findByRole("combobox", { name: /^Participant/ }), "A new participant");
    await user.type(within(dialog).getByRole("textbox", { name: /^New participant's name or alias/ }), "P-002");
    expect(within(dialog).getByRole("textbox", { name: /^Plan name/ })).toHaveValue("Care plan Dec 2025 to Oct 2026");
    await user.click(within(dialog).getByRole("button", { name: "Save plan" }));

    expect(await within(dialog).findByRole("status")).toHaveTextContent("Saved to P-002.");
    expect(savedPlans.createParticipant).toHaveBeenCalledWith("t-test-01", expect.objectContaining({ uid: "u-test-01" }), "P-002");
    const [, participantId, , change] = vi.mocked(savedPlans.savePlanFor).mock.calls[0]!;
    expect(participantId).toBe("p-test-2");
    expect(change).toMatchObject({ planId: null, name: "Care plan Dec 2025 to Oct 2026" });
    expect((change.plan as CarePlan).services[0]!.isExample).toBe(false);
    expect(sessionStorage.getItem(OPENED_PLAN_KEY)).not.toMatch(/SAMPLE PARTICIPANT|10000002|P-002/);
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    // Saved once, the plan now belongs to that participant: saving again updates it.
    vi.mocked(participants.listParticipants).mockResolvedValue([
      { id: "p-test-1", displayName: "P-001" },
      { id: "p-test-2", displayName: "P-002" },
    ]);
    vi.mocked(savedPlans.listPlans).mockResolvedValue([
      { id: "plan-9", name: "Care plan Dec 2025 to Oct 2026", planStart: "2025-12-01", planEnd: "2026-10-31", savedAt: 1, savedBy: "u-test-01" },
    ]);
    await user.click(screen.getByRole("button", { name: "Save to agency" }));
    dialog = await screen.findByRole("dialog", { name: "Save to your agency" });
    expect(await within(dialog).findByText("This plan was opened from P-002")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Update “Care plan Dec 2025 to Oct 2026”" })).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Update plan" }));
    await waitFor(() => expect(savedPlans.savePlanFor).toHaveBeenCalledTimes(2));
    expect(vi.mocked(savedPlans.savePlanFor).mock.calls[1]![1]).toBe("p-test-2");
    expect(vi.mocked(savedPlans.savePlanFor).mock.calls[1]![3]).toMatchObject({ planId: "plan-9" });
  });

  it("while the gate is closed it says why and saves nothing", async () => {
    vi.mocked(savedPlans.phiStorageEnabled).mockResolvedValue(false);
    const user = renderAgencyQuick();
    await openCarePlanText(user, fixtureB);
    await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });
    await user.click(await screen.findByRole("button", { name: "Save to agency" }));
    const dialog = await screen.findByRole("dialog", { name: "Save to your agency" });
    expect(within(dialog).getByText("Saving to your agency isn't turned on yet")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Save plan" })).not.toBeInTheDocument();
    expect(savedPlans.savePlanFor).not.toHaveBeenCalled();
  });

  it("a viewer is told who saves", async () => {
    const user = renderAgencyQuick("viewer");
    await openCarePlanText(user, fixtureB);
    await screen.findByRole("heading", { level: 2, name: "SAMPLE PARTICIPANT B" });
    await user.click(await screen.findByRole("button", { name: "Save to agency" }));
    const dialog = await screen.findByRole("dialog", { name: "Save to your agency" });
    expect(within(dialog).getByText("You can open saved plans. An owner or scheduler saves and changes them.")).toBeInTheDocument();
  });
});
