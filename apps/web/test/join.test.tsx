import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as invites from "../src/features/agency/invites";
import { Join } from "../src/features/agency/Join";
import * as memberships from "../src/features/agency/memberships";
import type { Invite } from "../src/features/agency/types";
import { AuthContext, type AuthContextValue, type AuthUser } from "../src/features/auth/authContext";
import { ToastHost } from "../src/ui/ToastHost";

vi.mock("../src/features/agency/invites", () => ({
  getInvite: vi.fn(),
  acceptInvite: vi.fn(async () => undefined),
}));

vi.mock("../src/features/agency/memberships", () => ({
  setLastTenantId: vi.fn(async () => undefined),
}));

// 2026-11-03 12:00 America/Chicago; the tests run on Nov 1 (before) or Nov 10 (after).
const NOV_3_NOON = Date.UTC(2026, 10, 3, 18, 0);
const NOV_1 = new Date(Date.UTC(2026, 10, 1, 18, 0));
const NOV_10 = new Date(Date.UTC(2026, 10, 10, 18, 0));

const ME: AuthUser = {
  uid: "u-test-01",
  email: "p-test-01@example.com",
  displayName: "P-TEST-01",
  emailVerified: true,
  usesPassword: true,
};

const INVITE: Invite = {
  id: "i-test-01",
  tenantId: "t-test-01",
  tenantName: "P-TEST-AGENCY-01",
  email: "p-test-01@example.com",
  role: "scheduler",
  status: "pending",
  expiresAt: NOV_3_NOON,
};

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

function renderJoin(user: AuthUser | null = ME, signOut = vi.fn(async () => undefined)) {
  const auth: AuthContextValue = {
    user,
    loading: false,
    emailVerified: user?.emailVerified ?? false,
    leaving: false,
    signOut,
    refresh: vi.fn(async () => true),
  };
  return render(
    <AuthContext.Provider value={auth}>
      <ToastHost>
        <MemoryRouter initialEntries={["/join/i-test-01"]}>
          <Routes>
            <Route path="/join/:inviteId" element={<Join />} />
            <Route path="/app" element={<Where />} />
            <Route path="/sign-in" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </ToastHost>
    </AuthContext.Provider>,
  );
}

function statusWith(text: string): boolean {
  return screen.getAllByRole("status").some((element) => element.textContent?.includes(text));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Only Date is faked, so promises and user-event timers run as usual.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOV_1);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Join (/join/:inviteId, APP-SPEC 6.4)", () => {
  it("signed out: goes to sign in and comes back here", async () => {
    renderJoin(null);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/sign-in?next=%2Fjoin%2Fi-test-01"));
    expect(invites.getInvite).not.toHaveBeenCalled();
  });

  it("valid: names the agency and role, and joining goes to /app with the toast", async () => {
    vi.mocked(invites.getInvite).mockResolvedValueOnce(INVITE);
    const user = userEvent.setup();
    renderJoin();
    expect(screen.getByRole("heading", { level: 1, name: "Accept invite" })).toBeInTheDocument();
    expect(await screen.findByText("P-TEST-AGENCY-01 invited you to join as a Scheduler.")).toBeInTheDocument();
    expect(invites.getInvite).toHaveBeenCalledWith("i-test-01");
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Join P-TEST-AGENCY-01" }));
    await waitFor(() =>
      expect(invites.acceptInvite).toHaveBeenCalledWith(
        { uid: "u-test-01", email: "p-test-01@example.com", displayName: "P-TEST-01", emailVerified: true },
        INVITE,
      ),
    );
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app"));
    expect(memberships.setLastTenantId).toHaveBeenCalledWith(expect.objectContaining({ uid: "u-test-01" }), "t-test-01");
    await waitFor(() => expect(statusWith("Joined P-TEST-AGENCY-01")).toBe(true));
  });

  it("valid: Not now goes to /app without joining", async () => {
    vi.mocked(invites.getInvite).mockResolvedValueOnce(INVITE);
    const user = userEvent.setup();
    renderJoin();
    await user.click(await screen.findByRole("button", { name: "Not now" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app"));
    expect(invites.acceptInvite).not.toHaveBeenCalled();
  });

  it("valid: a failed join says how to fix it and stays on the page", async () => {
    vi.mocked(invites.getInvite).mockResolvedValueOnce(INVITE);
    vi.mocked(invites.acceptInvite).mockRejectedValueOnce({ code: "unavailable" });
    const user = userEvent.setup();
    renderJoin();
    await user.click(await screen.findByRole("button", { name: "Join P-TEST-AGENCY-01" }));
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
  });

  it("wrong email: shows the invited address masked, and offers another sign-in", async () => {
    vi.mocked(invites.getInvite).mockResolvedValueOnce({ ...INVITE, email: "jordan@example.com" });
    const signOut = vi.fn(async () => undefined);
    const user = userEvent.setup();
    renderJoin(ME, signOut);
    expect(
      await screen.findByText("This invite is for j***@example.com. Sign in with that email to accept it."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Join/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign in with another email" }));
    expect(signOut).toHaveBeenCalledWith("/sign-in?next=%2Fjoin%2Fi-test-01");
  });

  it("expired: gives the date it expired", async () => {
    vi.setSystemTime(NOV_10);
    vi.mocked(invites.getInvite).mockResolvedValueOnce(INVITE);
    renderJoin();
    expect(
      await screen.findByText("This invite expired on Nov 3, 2026. Ask the agency owner for a new one."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Join/ })).not.toBeInTheDocument();
  });

  it("revoked or used: no longer active", async () => {
    vi.mocked(invites.getInvite).mockResolvedValueOnce({ ...INVITE, status: "revoked" });
    renderJoin();
    expect(await screen.findByText("This invite is no longer active.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Join/ })).not.toBeInTheDocument();
  });

  it("not found: says which email was checked and how to fix it", async () => {
    vi.mocked(invites.getInvite).mockResolvedValueOnce(null);
    renderJoin();
    expect(
      await screen.findByText(
        "We couldn't find an invite for p-test-01@example.com at this link. Sign in with the email the invite was sent to, or ask the agency owner for a new link.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with another email" })).toBeInTheDocument();
  });

  it("a failed read maps to the APP-SPEC 6.6 sentence", async () => {
    vi.mocked(invites.getInvite).mockRejectedValueOnce({ code: "unavailable" });
    renderJoin();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeInTheDocument();
  });
});
