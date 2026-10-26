import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { AuthContext, type AuthContextValue, type AuthUser } from "../../src/features/auth/authContext";
import { RedirectSignedIn, RequireAuth, RequireVerified } from "../../src/features/auth/guards";
import { safeNext } from "../../src/features/auth/next";

const USER: AuthUser = {
  uid: "u-test-01",
  email: "p-test-01@example.com",
  displayName: "P-TEST-01",
  emailVerified: true,
  usesPassword: true,
};

function auth(user: AuthUser | null, overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user,
    loading: false,
    emailVerified: user?.emailVerified ?? false,
    leaving: false,
    signOut: async () => {},
    refresh: async () => user?.emailVerified ?? false,
    ...overrides,
  };
}

function Where({ page }: { page: string }) {
  const location = useLocation();
  return <p data-testid="where">{`${page} ${location.pathname}${location.search}`}</p>;
}

function renderAt(path: string, value: AuthContextValue, hold = false) {
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/app/*"
            element={
              <RequireAuth>
                <RequireVerified>
                  <Where page="app" />
                </RequireVerified>
              </RequireAuth>
            }
          />
          <Route
            path="/sign-in"
            element={
              <RedirectSignedIn hold={hold}>
                <Where page="sign-in" />
              </RedirectSignedIn>
            }
          />
          <Route path="/verify-email" element={<Where page="verify" />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function where(): string {
  return screen.getByTestId("where").textContent ?? "";
}

describe("route guards (APP-SPEC 3)", () => {
  it("signed out: an /app path goes to /sign-in with the path as next", () => {
    renderAt("/app/account?tab=name", auth(null));
    expect(where()).toBe("sign-in /sign-in?next=%2Fapp%2Faccount%3Ftab%3Dname");
  });

  it("while the session is loading, nothing redirects", () => {
    renderAt("/app", auth(null, { loading: true }));
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading the page");
  });

  it("while signing out on purpose, the app page doesn't bounce to sign-in", () => {
    renderAt("/app", auth(null, { leaving: true }));
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
  });

  it("signed in but not verified: /verify-email, keeping next", () => {
    renderAt("/app/account", auth({ ...USER, emailVerified: false }));
    expect(where()).toBe("verify /verify-email?next=%2Fapp%2Faccount");
  });

  it("signed in and verified: the app page", () => {
    renderAt("/app", auth(USER));
    expect(where()).toBe("app /app");
  });
});

describe("next after sign-in", () => {
  it("keeps /app and /join/ paths", () => {
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/app/account?tab=name")).toBe("/app/account?tab=name");
    expect(safeNext("/join/inv-test-01")).toBe("/join/inv-test-01");
  });

  it.each([
    "https://evil.example",
    "//evil",
    "/sign-in",
    "/application",
    "/app//evil.example",
    "/app\\evil",
    "/join/",
    "javascript:alert(1)",
    "",
    null,
  ])("%s goes to /app", (next) => {
    expect(safeNext(next)).toBe("/app");
  });

  it.each(["https://evil.example", "//evil", "/sign-in"])(
    "a signed-in visit to /sign-in?next=%s lands on /app",
    (next) => {
      renderAt(`/sign-in?next=${encodeURIComponent(next)}`, auth(USER));
      expect(where()).toBe("app /app");
    },
  );

  it("a signed-in visit to /sign-in with a good next goes there", () => {
    renderAt(`/sign-in?next=${encodeURIComponent("/app/account")}`, auth(USER));
    expect(where()).toBe("app /app/account");
  });

  it("signed out, or while a sign-up is still finishing, the sign-in page stays", () => {
    renderAt("/sign-in?next=%2Fapp", auth(null));
    expect(where()).toBe("sign-in /sign-in?next=%2Fapp");
  });

  it("holds the page while a sign-up is still finishing", () => {
    renderAt("/sign-in", auth(USER), true);
    expect(where()).toBe("sign-in /sign-in");
  });
});
