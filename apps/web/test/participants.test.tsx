import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { MO_2026_07 } from "@careplan/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addPage, emptyImportFlow, next } from "../src/features/import/importFlow";
import { AgencyContext } from "../src/features/agency/agencyContext";
import { OPENED_PLAN_KEY } from "../src/features/agency/openedPlan";
import { ParticipantDetail } from "../src/features/agency/ParticipantDetail";
import * as participants from "../src/features/agency/participants";
import { Participants } from "../src/features/agency/ParticipantsPage";
import * as savedPlans from "../src/features/agency/savedPlans";
import type { AgencyContextValue, MemberRole, Tenant } from "../src/features/agency/types";
import { AuthContext, type AuthContextValue } from "../src/features/auth/authContext";
import type { CarePlan } from "../src/features/quick-schedule/types";
import { ToastHost } from "../src/ui/ToastHost";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

vi.mock("../src/features/agency/participants", () => ({ listParticipants: vi.fn(), listVisits: vi.fn() }));
vi.mock("../src/features/agency/savedPlans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/agency/savedPlans")>();
  return {
    ...actual,
    phiStorageEnabled: vi.fn(),
    createParticipant: vi.fn(),
    renameParticipant: vi.fn(),
    participantName: vi.fn(),
    listPlans: vi.fn(),
    savePlanFor: vi.fn(),
    openSavedPlan: vi.fn(),
    deleteSavedPlan: vi.fn(),
    deleteParticipant: vi.fn(),
  };
});

const TENANT: Tenant = { name: "P-TEST-AGENCY-01", state: "MO", timeZone: "America/Chicago", workweekStart: 0 };
const WITH_BAA: Tenant = { ...TENANT, baaVersion: "1.0", baaAcceptedBy: "u-test-01", baaAcceptedAt: 0 };

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

function agency(role: MemberRole, tenant: Tenant): AgencyContextValue {
  return {
    state: { memberships: [], tenantId: "t-test-01", tenant, role, members: [], agencyInvites: [], myInvites: [] },
    ready: true,
    error: null,
    reload: vi.fn(async () => undefined),
    switchAgency: vi.fn(async () => undefined),
  };
}

function renderAt(path: string, role: MemberRole = "owner", tenant: Tenant = WITH_BAA) {
  const user = userEvent.setup();
  render(
    <AuthContext.Provider value={auth()}>
      <AgencyContext.Provider value={agency(role, tenant)}>
        <ToastHost>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/app/participants" element={<Participants />} />
              <Route path="/app/participants/:participantId" element={<ParticipantDetail />} />
              <Route path="/app/quick" element={<p>Quick Schedule page</p>} />
            </Routes>
          </MemoryRouter>
        </ToastHost>
      </AgencyContext.Provider>
    </AuthContext.Provider>,
  );
  return user;
}

function planF(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), MO_2026_07, new Date("2026-04-15T12:00:00-05:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture F should build");
  return outcome.plan;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(savedPlans.phiStorageEnabled).mockResolvedValue(true);
  vi.mocked(participants.listParticipants).mockResolvedValue([{ id: "p-test-1", displayName: "P-001" }]);
  vi.mocked(savedPlans.participantName).mockResolvedValue("P-001");
  vi.mocked(savedPlans.listPlans).mockResolvedValue([
    { id: "plan-1", name: "Care plan Apr 2026 to Mar 2027", planStart: "2026-04-01", planEnd: "2027-03-31", savedAt: Date.UTC(2026, 10, 16, 18), savedBy: "u-test-01" },
  ]);
});

describe("Participants (PHASE-3-SPEC section 6)", () => {
  it("says why saving is closed until the owner accepts the BAA, and links the owner to it", async () => {
    renderAt("/app/participants", "owner", TENANT);
    expect(await screen.findByText("Saving to your agency needs the business associate agreement")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review and accept the agreement" })).toHaveAttribute("href", "/app/agency/baa");
    expect(screen.queryByRole("button", { name: "Add participant" })).not.toBeInTheDocument();
  });

  it("says saving isn't on yet while the deployment's PHI storage is off", async () => {
    vi.mocked(savedPlans.phiStorageEnabled).mockResolvedValue(false);
    renderAt("/app/participants");
    expect(await screen.findByText("Saving to your agency isn't turned on yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add participant" })).not.toBeInTheDocument();
  });

  it("adds a participant by alias, refusing a DCN, and opens them", async () => {
    vi.mocked(savedPlans.createParticipant).mockResolvedValue("p-test-1");
    const user = renderAt("/app/participants", "scheduler");
    expect(await screen.findByRole("link", { name: "P-001" })).toHaveAttribute("href", "/app/participants/p-test-1");

    const name = await screen.findByRole("textbox", { name: "Name or alias" });
    await user.type(name, "P-002 10000002");
    await user.click(screen.getByRole("button", { name: "Add participant" }));
    expect(screen.getByText("Leave the DCN out. Use a name or your agency's alias.")).toBeInTheDocument();
    expect(savedPlans.createParticipant).not.toHaveBeenCalled();

    await user.clear(name);
    await user.type(name, "  P-002  ");
    await user.click(screen.getByRole("button", { name: "Add participant" }));
    await waitFor(() => expect(savedPlans.createParticipant).toHaveBeenCalledWith("t-test-01", expect.objectContaining({ uid: "u-test-01" }), "P-002"));
    expect(await screen.findByRole("heading", { level: 1, name: "P-001" })).toBeInTheDocument();
  });

  it("a viewer reads the list but adds nothing", async () => {
    renderAt("/app/participants", "viewer");
    expect(await screen.findByText("You can open saved plans. An owner or scheduler saves and changes them.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add participant" })).not.toBeInTheDocument();
  });
});

describe("A participant's saved plans", () => {
  it("opens a saved plan in Quick Schedule through the tab's copy, with no name in storage", async () => {
    vi.mocked(savedPlans.openSavedPlan).mockResolvedValue(planF());
    const user = renderAt("/app/participants/p-test-1");
    const plan = await screen.findByRole("listitem");
    expect(within(plan).getByText("Care plan Apr 2026 to Mar 2027")).toBeInTheDocument();
    expect(within(plan).getByText("Apr 1, 2026 to Mar 31, 2027 · Saved Nov 16, 2026")).toBeInTheDocument();

    await user.click(within(plan).getByRole("button", { name: "Open in Quick Schedule" }));
    expect(await screen.findByText("Quick Schedule page")).toBeInTheDocument();
    expect(savedPlans.openSavedPlan).toHaveBeenCalledWith("t-test-01", "p-test-1", "plan-1");
    const tab = sessionStorage.getItem("cps.quick.v3")!;
    expect(tab).not.toBeNull();
    expect(tab).not.toMatch(/SAMPLE PARTICIPANT|10000006/);
    expect(JSON.parse(sessionStorage.getItem(OPENED_PLAN_KEY)!)).toMatchObject({ tenantId: "t-test-01", participantId: "p-test-1", planId: "plan-1" });
  });

  it("a damaged plan isn't opened, and says what to do", async () => {
    vi.mocked(savedPlans.openSavedPlan).mockRejectedValue(new savedPlans.SavedPlanError());
    const user = renderAt("/app/participants/p-test-1");
    await user.click(await screen.findByRole("button", { name: "Open in Quick Schedule" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/doesn't match what was saved\. Open the care plan PDF instead\./);
    expect(sessionStorage.getItem("cps.quick.v3")).toBeNull();
  });

  it("only an owner deletes, after saying what goes", async () => {
    vi.mocked(savedPlans.deleteParticipant).mockResolvedValue();
    const user = renderAt("/app/participants/p-test-1");
    await user.click(await screen.findByRole("button", { name: "Delete participant" }));
    const dialog = screen.getByRole("dialog", { name: "Delete participant" });
    expect(within(dialog).getByText("Delete P-001 and their saved plan? This can't be undone.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete participant" }));
    await waitFor(() => expect(savedPlans.deleteParticipant).toHaveBeenCalledWith("t-test-01", "p-test-1"));
    expect(await screen.findByRole("heading", { level: 1, name: "Participants" })).toBeInTheDocument();
  });

  it("a scheduler sees no delete buttons", async () => {
    renderAt("/app/participants/p-test-1", "scheduler");
    expect(await screen.findByRole("button", { name: "Open in Quick Schedule" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change name" })).toBeInTheDocument();
  });
});
