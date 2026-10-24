import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgencyContext } from "../src/features/agency/agencyContext";
import { AgencyDetails } from "../src/features/agency/AgencyDetails";
import { AgencyProvider } from "../src/features/agency/AgencyProvider";
import { RequireMembership } from "../src/features/agency/guards";
import * as memberships from "../src/features/agency/memberships";
import { NewAgency } from "../src/features/agency/NewAgency";
import * as tenants from "../src/features/agency/tenants";
import type { AgencyContextValue, AgencyState, Member } from "../src/features/agency/types";
import { AuthContext, type AuthContextValue, type AuthUser } from "../src/features/auth/authContext";
import { Home } from "../src/pages/Home";
import { ToastHost } from "../src/ui/ToastHost";

vi.mock("../src/features/agency/tenants", () => ({
  createAgency: vi.fn(async () => "t-test-01"),
  updateAgency: vi.fn(async () => undefined),
}));

vi.mock("../src/features/agency/memberships", () => ({
  loadAgencyData: vi.fn(),
  setLastTenantId: vi.fn(async () => undefined),
}));

const USER: AuthUser = {
  uid: "u-test-01",
  email: "p-test-01@example.com",
  displayName: "P-TEST-01",
  emailVerified: true,
  usesPassword: true,
};

function authValue(): AuthContextValue {
  return {
    user: USER,
    loading: false,
    emailVerified: true,
    leaving: false,
    signOut: vi.fn(async () => undefined),
    refresh: vi.fn(async () => true),
  };
}

function agencyValue(overrides: Partial<AgencyState> = {}, reload = vi.fn(async () => undefined)): AgencyContextValue {
  const state: AgencyState = {
    memberships: [],
    tenantId: null,
    tenant: null,
    role: null,
    members: [],
    pendingInvites: 0,
    ...overrides,
  };
  return { state, ready: true, error: null, reload, switchAgency: vi.fn(async () => undefined) };
}

function statusWith(text: string): boolean {
  return screen.getAllByRole("status").some((element) => element.textContent?.includes(text));
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}</p>;
}

function renderPage(page: ReactNode, value: AgencyContextValue) {
  return render(
    <AuthContext.Provider value={authValue()}>
      <AgencyContext.Provider value={value}>
        <ToastHost>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={page} />
              <Route path="/app" element={<Where />} />
              <Route path="/app/new-agency" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </ToastHost>
      </AgencyContext.Provider>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.removeItem("cps.quick.v2");
});

describe("Set up your agency (NewAgency)", () => {
  it("asks for a name, then its length, before calling the service", async () => {
    const user = userEvent.setup();
    renderPage(<NewAgency />, agencyValue());
    await user.click(screen.getByRole("button", { name: "Set up agency" }));
    expect(screen.getByText("Enter an agency name.")).toBeInTheDocument();
    expect(tenants.createAgency).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Agency name" })).toHaveFocus();

    await user.type(screen.getByRole("textbox", { name: "Agency name" }), "A");
    await user.click(screen.getByRole("button", { name: "Set up agency" }));
    expect(screen.getByText("Use 2 to 120 characters.")).toBeInTheDocument();
    expect(tenants.createAgency).not.toHaveBeenCalled();
  });

  it("creates the agency, reloads, toasts and goes home", async () => {
    const reload = vi.fn(async () => undefined);
    const user = userEvent.setup();
    renderPage(<NewAgency />, agencyValue({}, reload));
    await user.type(screen.getByRole("textbox", { name: "Agency name" }), "  P-TEST-AGENCY-01  ");
    await user.click(screen.getByRole("button", { name: "Set up agency" }));

    await waitFor(() =>
      expect(tenants.createAgency).toHaveBeenCalledWith(
        { uid: "u-test-01", email: "p-test-01@example.com", displayName: "P-TEST-01", emailVerified: true },
        "P-TEST-AGENCY-01",
        0,
      ),
    );
    await waitFor(() => expect(reload).toHaveBeenCalled());
    await waitFor(() => expect(statusWith("Agency set up")).toBe(true));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app"));
  });
});

describe("Agency details", () => {
  const TENANT = { name: "P-TEST-AGENCY-01", state: "MO", timeZone: "America/Chicago", workweekStart: 0 };

  it("an owner edits and saves, with the toast", async () => {
    const reload = vi.fn(async () => undefined);
    const value = agencyValue(
      { tenantId: "t-test-01", tenant: TENANT, role: "owner", memberships: [{ tenantId: "t-test-01", name: TENANT.name, role: "owner" }] },
      reload,
    );
    const user = userEvent.setup();
    renderPage(<AgencyDetails />, value);

    const name = screen.getByRole("textbox", { name: "Agency name" });
    expect(name).not.toHaveAttribute("readonly");
    expect(screen.getByRole("combobox", { name: "Workweek starts on" })).toBeEnabled();

    await user.clear(name);
    await user.type(name, "P-TEST-AGENCY-02");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(tenants.updateAgency).toHaveBeenCalledWith("t-test-01", { name: "P-TEST-AGENCY-02", workweekStart: 0 }),
    );
    await waitFor(() => expect(reload).toHaveBeenCalled());
    await waitFor(() => expect(statusWith("Changes saved")).toBe(true));
  });

  it("a scheduler sees read-only values and no save", () => {
    renderPage(
      <AgencyDetails />,
      agencyValue({
        tenantId: "t-test-01",
        tenant: TENANT,
        role: "scheduler",
        memberships: [{ tenantId: "t-test-01", name: TENANT.name, role: "scheduler" }],
      }),
    );

    expect(screen.getByRole("textbox", { name: "Agency name" })).toHaveAttribute("readonly");
    expect(screen.getByRole("combobox", { name: "Workweek starts on" })).toBeDisabled();
    expect(screen.getByText("Only an owner can change agency details.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });
});

describe("Home checklist", () => {
  it("greets with the first name and the agency name", () => {
    renderPage(
      <Home />,
      agencyValue({
        tenantId: "t-test-01",
        tenant: { name: "P-TEST-AGENCY-01", state: "MO", timeZone: "America/Chicago", workweekStart: 0 },
        role: "owner",
      }),
    );
    expect(screen.getByRole("heading", { level: 1, name: "Hi P-TEST-01" })).toBeInTheDocument();
    expect(screen.getByText("P-TEST-AGENCY-01")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a Quick Schedule" })).toHaveAttribute("href", "/app/quick");
  });

  it("Invite your team is done once someone else is a member", () => {
    renderPage(
      <Home />,
      agencyValue({
        members: [
          { uid: "u-test-01", role: "owner", email: "p-test-01@example.com", displayName: "P-TEST-01", joinedAt: null },
          { uid: "u-test-02", role: "scheduler", email: "p-test-02@example.com", displayName: "P-TEST-02", joinedAt: null },
        ],
      }),
    );
    const invite = screen.getByRole("link", { name: "Invite your team" });
    expect(invite).toHaveAttribute("href", "/app/agency/members");
    expect(invite.closest("li")).toHaveTextContent("Done");
  });

  it("Invite your team is done once an invite is pending", () => {
    renderPage(<Home />, agencyValue({ pendingInvites: 1 }));
    expect(screen.getByRole("link", { name: "Invite your team" }).closest("li")).toHaveTextContent("Done");
  });

  it("Invite your team is to do with one member, and Try Quick Schedule follows sessionStorage", () => {
    const members: Member[] = [{ uid: "u-test-01", role: "owner", email: "p-test-01@example.com", displayName: "P-TEST-01", joinedAt: null }];
    const { rerender } = renderPage(<Home />, agencyValue({ members }));
    expect(screen.getByRole("link", { name: "Invite your team" }).closest("li")).toHaveTextContent("To do");
    expect(screen.getByRole("link", { name: "Try Quick Schedule" }).closest("li")).toHaveTextContent("To do");

    sessionStorage.setItem("cps.quick.v2", "{}");
    rerender(
      <AuthContext.Provider value={authValue()}>
        <AgencyContext.Provider value={agencyValue({ members })}>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<Home />} />
            </Routes>
          </MemoryRouter>
        </AgencyContext.Provider>
      </AuthContext.Provider>,
    );
    expect(screen.getByRole("link", { name: "Try Quick Schedule" }).closest("li")).toHaveTextContent("Done");
  });
});

describe("Loading the agency", () => {
  const LOADED: AgencyState = {
    memberships: [{ tenantId: "t-test-01", name: "P-TEST-AGENCY-01", role: "owner" }],
    tenantId: "t-test-01",
    tenant: { name: "P-TEST-AGENCY-01", state: "MO", timeZone: "America/Chicago", workweekStart: 0 },
    role: "owner",
    members: [],
    pendingInvites: 0,
  };

  function renderGuarded() {
    return render(
      <AuthContext.Provider value={authValue()}>
        <AgencyProvider>
          <MemoryRouter initialEntries={["/app"]}>
            <Routes>
              <Route path="/app" element={<RequireMembership><p>P-TEST member page</p></RequireMembership>} />
              <Route path="/app/new-agency" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </AgencyProvider>
      </AuthContext.Provider>,
    );
  }

  it("a failed load says how to fix it and offers a retry, instead of sending a member to set-up", async () => {
    vi.mocked(memberships.loadAgencyData).mockRejectedValueOnce({ code: "unavailable" });
    const user = userEvent.setup();
    renderGuarded();

    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();

    vi.mocked(memberships.loadAgencyData).mockResolvedValueOnce(LOADED);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("P-TEST member page")).toBeInTheDocument();
  });

  it("a load with no memberships goes to set-up", async () => {
    vi.mocked(memberships.loadAgencyData).mockResolvedValueOnce({ ...LOADED, memberships: [], tenantId: null, tenant: null, role: null });
    renderGuarded();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/app/new-agency"));
  });
});
