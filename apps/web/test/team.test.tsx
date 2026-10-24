import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgencyContext } from "../src/features/agency/agencyContext";
import * as invites from "../src/features/agency/invites";
import * as members from "../src/features/agency/members";
import { Team } from "../src/features/agency/Team";
import type { AgencyContextValue, AgencyState, Invite, Member, MemberRole } from "../src/features/agency/types";
import { AuthContext, type AuthContextValue } from "../src/features/auth/authContext";
import { ToastHost } from "../src/ui/ToastHost";

vi.mock("../src/features/agency/invites", () => ({
  createInvite: vi.fn(),
  revokeInvite: vi.fn(async () => undefined),
}));

vi.mock("../src/features/agency/members", () => ({
  changeRole: vi.fn(async () => undefined),
  removeMember: vi.fn(async () => undefined),
}));

// 2026-11-03 12:00 America/Chicago.
const NOV_3_NOON = Date.UTC(2026, 10, 3, 18, 0);

const ME: Member = { uid: "u-test-01", role: "owner", email: "p-test-01@example.com", displayName: "P-TEST-01", joinedAt: NOV_3_NOON };
const SCHEDULER: Member = {
  uid: "u-test-02",
  role: "scheduler",
  email: "p-test-02@example.com",
  displayName: "P-TEST-02",
  joinedAt: NOV_3_NOON,
};
const PENDING: Invite = {
  id: "i-test-01",
  tenantId: "t-test-01",
  tenantName: "P-TEST-AGENCY-01",
  email: "p-test-03@example.com",
  role: "scheduler",
  status: "pending",
  expiresAt: NOV_3_NOON,
};

function authValue(uid: string): AuthContextValue {
  return {
    user: { uid, email: `${uid.replace("u-", "p-")}@example.com`, displayName: uid.toUpperCase(), emailVerified: true, usesPassword: true },
    loading: false,
    emailVerified: true,
    leaving: false,
    signOut: vi.fn(async () => undefined),
    refresh: vi.fn(async () => true),
  };
}

function agencyValue(role: MemberRole, reload = vi.fn(async () => undefined)): AgencyContextValue {
  const state: AgencyState = {
    memberships: [{ tenantId: "t-test-01", name: "P-TEST-AGENCY-01", role }],
    tenantId: "t-test-01",
    tenant: { name: "P-TEST-AGENCY-01", state: "MO", timeZone: "America/Chicago", workweekStart: 0 },
    role,
    members: [ME, SCHEDULER],
    agencyInvites: role === "owner" ? [PENDING] : [],
    myInvites: [],
  };
  return { state, ready: true, error: null, reload, switchAgency: vi.fn(async () => undefined) };
}

function renderTeam(value: AgencyContextValue, uid = "u-test-01") {
  return render(
    <AuthContext.Provider value={authValue(uid)}>
      <AgencyContext.Provider value={value}>
        <ToastHost>
          <MemoryRouter>
            <Team />
          </MemoryRouter>
        </ToastHost>
      </AgencyContext.Provider>
    </AuthContext.Provider>,
  );
}

function statusWith(text: string): boolean {
  return screen.getAllByRole("status").some((element) => element.textContent?.includes(text));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Team: owner view", () => {
  it("lists members with actions on others only, and pending invites with their links", () => {
    renderTeam(agencyValue("owner"));
    expect(screen.getByRole("heading", { level: 1, name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite someone" })).toBeInTheDocument();

    const membersTable = screen.getByRole("table", { name: "Members" });
    const schedulerRow = within(membersTable).getByRole("row", { name: /P-TEST-02/ });
    expect(schedulerRow).toHaveTextContent("p-test-02@example.com");
    expect(schedulerRow).toHaveTextContent("Scheduler");
    expect(schedulerRow).toHaveTextContent("Nov 3, 2026");
    expect(within(schedulerRow).getByRole("button", { name: "Actions for P-TEST-02" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions for P-TEST-01" })).not.toBeInTheDocument();

    const invitesTable = screen.getByRole("table", { name: "Pending invites" });
    const inviteRow = within(invitesTable).getByRole("row", { name: /p-test-03@example.com/ });
    expect(inviteRow).toHaveTextContent("Scheduler");
    expect(inviteRow).toHaveTextContent("Nov 3, 2026");
    expect(within(inviteRow).getByRole("button", { name: "Copy link for p-test-03@example.com" })).toBeInTheDocument();
    expect(within(inviteRow).getByRole("button", { name: "Revoke invite for p-test-03@example.com" })).toBeInTheDocument();
    expect(screen.queryByText("Only an owner can invite or remove people.")).not.toBeInTheDocument();
  });

  it("changes another member's role from their menu", async () => {
    const reload = vi.fn(async () => undefined);
    const user = userEvent.setup();
    renderTeam(agencyValue("owner", reload));
    await user.click(screen.getByRole("button", { name: "Actions for P-TEST-02" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Make scheduler" })).not.toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "Make viewer" }));

    await waitFor(() => expect(members.changeRole).toHaveBeenCalledWith("t-test-01", "u-test-02", "viewer"));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    await waitFor(() => expect(statusWith("Role changed to Viewer")).toBe(true));
  });

  it("asks before removing someone, then removes them", async () => {
    const user = userEvent.setup();
    renderTeam(agencyValue("owner"));
    await user.click(screen.getByRole("button", { name: "Actions for P-TEST-02" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove from team" }));

    const dialog = await screen.findByRole("dialog", { name: "Remove from team" });
    expect(dialog).toHaveTextContent("Remove P-TEST-02 from P-TEST-AGENCY-01? They lose access right away.");
    expect(members.removeMember).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Remove from team" }));

    await waitFor(() => expect(members.removeMember).toHaveBeenCalledWith("t-test-01", "u-test-02"));
    await waitFor(() => expect(statusWith("Removed from team")).toBe(true));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancelling the removal changes nothing", async () => {
    const user = userEvent.setup();
    renderTeam(agencyValue("owner"));
    await user.click(screen.getByRole("button", { name: "Actions for P-TEST-02" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove from team" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(members.removeMember).not.toHaveBeenCalled();
  });

  it("revokes a pending invite", async () => {
    const user = userEvent.setup();
    renderTeam(agencyValue("owner"));
    await user.click(screen.getByRole("button", { name: "Revoke invite for p-test-03@example.com" }));
    await waitFor(() => expect(invites.revokeInvite).toHaveBeenCalledWith("i-test-01"));
    await waitFor(() => expect(statusWith("Invite revoked")).toBe(true));
  });

  it("copies a pending invite's link", async () => {
    const user = userEvent.setup();
    renderTeam(agencyValue("owner"));
    await user.click(screen.getByRole("button", { name: "Copy link for p-test-03@example.com" }));
    await waitFor(() => expect(statusWith("Invite link copied")).toBe(true));
    await expect(navigator.clipboard.readText()).resolves.toBe(`${window.location.origin}/join/i-test-01`);
  });
});

describe("Team: invite dialog", () => {
  it("checks the email before creating an invite", async () => {
    const user = userEvent.setup();
    renderTeam(agencyValue("owner"));
    await user.click(screen.getByRole("button", { name: "Invite someone" }));
    const dialog = await screen.findByRole("dialog", { name: "Invite someone" });

    await user.click(within(dialog).getByRole("button", { name: "Create invite" }));
    expect(within(dialog).getByText("Enter an email address like name@agency.com.")).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "Email" })).toHaveFocus();

    await user.type(within(dialog).getByRole("textbox", { name: "Email" }), "not-an-email");
    await user.click(within(dialog).getByRole("button", { name: "Create invite" }));
    expect(within(dialog).getByText("Enter an email address like name@agency.com.")).toBeInTheDocument();

    await user.clear(within(dialog).getByRole("textbox", { name: "Email" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Email" }), "P-TEST-02@example.com");
    await user.click(within(dialog).getByRole("button", { name: "Create invite" }));
    expect(within(dialog).getByText("That person is already on your team.")).toBeInTheDocument();
    expect(invites.createInvite).not.toHaveBeenCalled();
  });

  it("offers the three roles with what each can do, Scheduler first", async () => {
    const user = userEvent.setup();
    renderTeam(agencyValue("owner"));
    await user.click(screen.getByRole("button", { name: "Invite someone" }));
    const dialog = await screen.findByRole("dialog", { name: "Invite someone" });
    expect(within(dialog).getByRole("radio", { name: "Scheduler" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "Viewer" })).not.toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "Owner" })).not.toBeChecked();
    expect(dialog).toHaveTextContent("Builds and changes schedules");
    expect(dialog).toHaveTextContent("Can look but not change");
    expect(dialog).toHaveTextContent("Also manages agency details and the team");
  });

  it("creates the invite, then shows the link to copy or email", async () => {
    vi.mocked(invites.createInvite).mockResolvedValueOnce({ ...PENDING, id: "i-test-02", email: "p-test-04@example.com", role: "viewer" });
    const reload = vi.fn(async () => undefined);
    const user = userEvent.setup();
    renderTeam(agencyValue("owner", reload));
    await user.click(screen.getByRole("button", { name: "Invite someone" }));
    const dialog = await screen.findByRole("dialog", { name: "Invite someone" });
    await user.type(within(dialog).getByRole("textbox", { name: "Email" }), " P-TEST-04@example.com ");
    await user.click(within(dialog).getByRole("radio", { name: "Viewer" }));
    await user.click(within(dialog).getByRole("button", { name: "Create invite" }));

    await waitFor(() =>
      expect(invites.createInvite).toHaveBeenCalledWith(
        { uid: "u-test-01", email: "p-test-01@example.com", displayName: "U-TEST-01", emailVerified: true },
        "t-test-01",
        "P-TEST-AGENCY-01",
        "p-test-04@example.com",
        "viewer",
      ),
    );
    const link = `${window.location.origin}/join/i-test-02`;
    expect(await within(dialog).findByRole("textbox", { name: "Invite link" })).toHaveValue(link);
    const mailto = within(dialog).getByRole("link", { name: "Open in my email app" }).getAttribute("href") ?? "";
    expect(mailto.startsWith("mailto:p-test-04@example.com?")).toBe(true);
    expect(new URLSearchParams(mailto.slice(mailto.indexOf("?") + 1)).get("subject")).toBe(
      "Join P-TEST-AGENCY-01 on CarePlan Scheduler",
    );
    expect(reload).toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Copy invite link" }));
    await waitFor(() => expect(statusWith("Invite link copied")).toBe(true));
    await expect(navigator.clipboard.readText()).resolves.toBe(link);
  });

  it("when the browser won't copy, selects the link so it can be copied by hand", async () => {
    vi.mocked(invites.createInvite).mockResolvedValueOnce({ ...PENDING, id: "i-test-02" });
    const user = userEvent.setup();
    renderTeam(agencyValue("owner"));
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("blocked"));
    await user.click(screen.getByRole("button", { name: "Invite someone" }));
    const dialog = await screen.findByRole("dialog", { name: "Invite someone" });
    await user.type(within(dialog).getByRole("textbox", { name: "Email" }), "p-test-03@example.com");
    await user.click(within(dialog).getByRole("button", { name: "Create invite" }));
    await user.click(await within(dialog).findByRole("button", { name: "Copy invite link" }));

    const input = within(dialog).getByRole<HTMLInputElement>("textbox", { name: "Invite link" });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(dialog).toHaveTextContent("Your browser didn't allow copying. The link is selected, so copy it from the box.");
  });
});

describe("Team: scheduler view", () => {
  it("shows the members without any actions and says who can change the team", () => {
    renderTeam(agencyValue("scheduler"), "u-test-02");
    expect(screen.getByText("Only an owner can invite or remove people.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite someone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revoke/ })).not.toBeInTheDocument();
    const membersTable = screen.getByRole("table", { name: "Members" });
    expect(within(membersTable).getByRole("row", { name: /P-TEST-01/ })).toHaveTextContent("Owner");
    expect(within(membersTable).getByRole("row", { name: /P-TEST-02/ })).toHaveTextContent("Scheduler");
  });
});
