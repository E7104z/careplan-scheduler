// Pure types and state for the signed-in agency (tenant) context. No Firebase here:
// the guards and menu components import this without pulling in the SDK (D-06).

export type MemberRole = "owner" | "scheduler" | "viewer";

/** The signed-in person as the agency services need them (never the Firebase SDK object). */
export interface AuthActor {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

/** `tenants/{id}` document data (APP-SPEC 7.2). */
export interface Tenant {
  name: string;
  state: string;
  timeZone: string;
  workweekStart: number;
}

/** One of the person's agency memberships, with the agency's name for the switcher. */
export interface Membership {
  tenantId: string;
  name: string;
  role: MemberRole;
}

/** A row of the Team table: `tenants/{id}/members/{uid}`. */
export interface Member {
  uid: string;
  role: MemberRole;
  email: string;
  displayName: string;
  joinedAt: string | null;
}

/** Everything the shell and Home need about the person's agencies. */
export interface AgencyState {
  memberships: Membership[];
  tenantId: string | null;
  tenant: Tenant | null;
  role: MemberRole | null;
  members: Member[];
  pendingInvites: number;
}

export function agencyInitialState(): AgencyState {
  return { memberships: [], tenantId: null, tenant: null, role: null, members: [], pendingInvites: 0 };
}

export type AgencyAction = { type: "reset" } | { type: "loaded"; state: AgencyState };

export function agencyReducer(state: AgencyState, action: AgencyAction): AgencyState {
  switch (action.type) {
    case "reset":
      return agencyInitialState();
    case "loaded":
      return action.state;
  }
}

export interface AgencyContextValue {
  state: AgencyState;
  /** True once the first load has finished (the membership guards wait for it). */
  ready: boolean;
  /** The APP-SPEC 6.6 sentence when the last load failed; the guards show it instead of guessing. */
  error: string | null;
  reload: () => Promise<void>;
  switchAgency: (tenantId: string) => Promise<void>;
}
