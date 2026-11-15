import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Visit } from "@careplan/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgencyContext } from "../src/features/agency/agencyContext";
import * as participants from "../src/features/agency/participants";
import { WorkerLoad } from "../src/features/agency/WorkerLoad";
import type { AgencyContextValue, AgencyState } from "../src/features/agency/types";

vi.mock("../src/features/agency/participants", () => ({
  listParticipants: vi.fn(),
  listVisits: vi.fn(),
}));

function agencyValue(): AgencyContextValue {
  const state: AgencyState = {
    memberships: [{ tenantId: "t-test-01", name: "P-TEST-AGENCY-01", role: "owner" }],
    tenantId: "t-test-01",
    tenant: { name: "P-TEST-AGENCY-01", state: "MO", timeZone: "America/Chicago", workweekStart: 0 },
    role: "owner",
    members: [],
    agencyInvites: [],
    myInvites: [],
  };
  return { state, ready: true, error: null, reload: vi.fn(async () => undefined), switchAgency: vi.fn(async () => undefined) };
}

function renderPage() {
  return render(
    <AgencyContext.Provider value={agencyValue()}>
      <WorkerLoad />
    </AgencyContext.Provider>,
  );
}

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: "v-test",
    participantId: "p-test-1",
    caregiverId: "cg-test-01",
    serviceCode: "T1019",
    start: "2026-07-06T09:00",
    end: "2026-07-06T10:00",
    taskIds: ["task-1"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(participants.listParticipants).mockResolvedValue([]);
  vi.mocked(participants.listVisits).mockResolvedValue([]);
});

describe("Worker load page (CP4-9)", () => {
  it("shows each participant by its agency alias only", async () => {
    vi.mocked(participants.listParticipants).mockResolvedValue([
      { id: "p-test-1", displayName: "P-001" },
      { id: "p-test-2", displayName: "P-002" },
    ]);
    renderPage();

    expect(await screen.findByText("P-001")).toBeInTheDocument();
    expect(screen.getByText("P-002")).toBeInTheDocument();
    // The participants list renders exactly the two aliases, never a name, DCN or address.
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("flags a worker in two participants' visits at once as must-fix", async () => {
    vi.mocked(participants.listParticipants).mockResolvedValue([
      { id: "p-test-1", displayName: "P-001" },
      { id: "p-test-2", displayName: "P-002" },
    ]);
    vi.mocked(participants.listVisits).mockResolvedValue([
      visit({ id: "v-1", participantId: "p-test-1", start: "2026-07-06T09:00", end: "2026-07-06T11:00" }),
      visit({ id: "v-2", participantId: "p-test-2", start: "2026-07-06T10:00", end: "2026-07-06T12:00" }),
    ]);
    renderPage();

    expect(await screen.findByText("Must fix")).toBeInTheDocument();
    expect(screen.getByText("Caregiver cg-test-01 overlaps across participants")).toBeInTheDocument();
  });

  it("flags a worker over 40 hours in the workweek as a check", async () => {
    vi.mocked(participants.listParticipants).mockResolvedValue([{ id: "p-test-1", displayName: "P-001" }]);
    vi.mocked(participants.listVisits).mockResolvedValue(
      [0, 1, 2, 3, 4, 5].map((day) =>
        visit({
          id: `v-${day}`,
          start: `2026-07-${String(6 + day).padStart(2, "0")}T09:00`,
          end: `2026-07-${String(6 + day).padStart(2, "0")}T16:00`,
        }),
      ),
    );
    renderPage();

    expect(await screen.findByText("Check")).toBeInTheDocument();
  });

  it("says how to fix a failed load and offers a retry", async () => {
    vi.mocked(participants.listParticipants).mockRejectedValueOnce({ code: "unavailable" });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeInTheDocument();

    vi.mocked(participants.listParticipants).mockResolvedValueOnce([{ id: "p-test-1", displayName: "P-001" }]);
    vi.mocked(participants.listVisits).mockResolvedValueOnce([]);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("P-001")).toBeInTheDocument();
  });
});
