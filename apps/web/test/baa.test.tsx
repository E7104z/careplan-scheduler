import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgencyContext } from "../src/features/agency/agencyContext";
import { Baa } from "../src/features/agency/Baa";
import { BAA_SECTIONS, BAA_TITLE, BAA_VERSION } from "../src/features/agency/baaText";
import { acceptBaa } from "../src/features/agency/tenants";
import type { AgencyContextValue, AgencyState, Tenant } from "../src/features/agency/types";
import { AuthContext, type AuthContextValue, type AuthUser } from "../src/features/auth/authContext";
import { niceDateFromMillis } from "../src/lib/format";
import { ToastHost } from "../src/ui/ToastHost";

vi.mock("../src/features/agency/tenants", () => ({
  acceptBaa: vi.fn(async () => undefined),
  updateAgency: vi.fn(async () => undefined),
}));

const USER: AuthUser = {
  uid: "u-test-01",
  email: "p-test-01@example.com",
  displayName: "P-TEST-01",
  emailVerified: true,
  usesPassword: true,
};

const TENANT: Tenant = {
  name: "P-TEST-AGENCY-01",
  state: "MO",
  timeZone: "America/Chicago",
  workweekStart: 0,
};

const ACCEPTED_TENANT: Tenant = {
  ...TENANT,
  baaVersion: "1.0",
  baaAcceptedBy: USER.uid,
  baaAcceptedAt: Date.UTC(2026, 10, 3, 18, 0),
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
    agencyInvites: [],
    myInvites: [],
    ...overrides,
  };
  return { state, ready: true, error: null, reload, switchAgency: vi.fn(async () => undefined) };
}

function renderBaa(value: AgencyContextValue) {
  return render(
    <AuthContext.Provider value={authValue()}>
      <AgencyContext.Provider value={value}>
        <ToastHost>
          <Baa />
        </ToastHost>
      </AgencyContext.Provider>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the business associate agreement text", () => {
  it("is version 1.0 with a title and complete sections", () => {
    expect(BAA_VERSION).toBe("1.0");
    expect(BAA_TITLE).toBe("Business associate agreement");
    expect(BAA_SECTIONS.length).toBeGreaterThanOrEqual(8);
    for (const section of BAA_SECTIONS) {
      expect(section.heading).not.toBe("");
      expect(section.paragraphs.length).toBeGreaterThan(0);
      for (const paragraph of section.paragraphs) {
        expect(paragraph).not.toBe("");
        expect(paragraph).not.toMatch(/TODO|lorem|placeholder/i);
      }
    }
  });

  it("renders the acceptance date in words", () => {
    expect(niceDateFromMillis(Date.UTC(2026, 10, 3, 18, 0))).toBe("Nov 3, 2026");
  });
});

describe("accepting the business associate agreement", () => {
  it("lets an owner accept once the authorization checkbox is ticked", async () => {
    const reload = vi.fn(async () => undefined);
    const user = userEvent.setup();
    renderBaa(agencyValue({ tenantId: "t-test-01", tenant: TENANT, role: "owner" }, reload));

    expect(screen.getByRole("status")).toHaveTextContent("Not accepted yet");
    const checkbox = screen.getByRole("checkbox", {
      name: /I am authorized to accept this agreement for P-TEST-AGENCY-01/,
    });
    expect(checkbox).not.toBeChecked();
    const button = screen.getByRole("button", { name: "Accept agreement" });
    expect(button).toBeDisabled();

    await user.click(checkbox);
    expect(button).toBeEnabled();

    await user.click(button);
    await waitFor(() => expect(acceptBaa).toHaveBeenCalledWith("t-test-01", USER));
    expect(reload).toHaveBeenCalled();
    expect(await screen.findByText("Agreement accepted")).toBeInTheDocument();
  });

  it("tells a non-owner that only an owner can accept", () => {
    renderBaa(agencyValue({ tenantId: "t-test-01", tenant: TENANT, role: "scheduler" }));

    expect(screen.getByRole("status")).toHaveTextContent("Not accepted yet");
    expect(screen.getByText("Only an owner can accept this agreement.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept agreement" })).not.toBeInTheDocument();
  });

  it("shows the accepted status and no accept form once signed", () => {
    renderBaa(agencyValue({ tenantId: "t-test-01", tenant: ACCEPTED_TENANT, role: "owner" }));

    expect(screen.getByRole("status")).toHaveTextContent(/Accepted on Nov 3, 2026 · version 1\.0/);
    expect(screen.queryByRole("button", { name: "Accept agreement" })).not.toBeInTheDocument();
  });
});
