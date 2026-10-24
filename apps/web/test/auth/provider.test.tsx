import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth, type AuthUser } from "../../src/features/auth/authContext";
import { AuthProvider } from "../../src/features/auth/AuthProvider";
import { RequireAuth } from "../../src/features/auth/guards";

// A fake Firebase session: watchAuth reports the current person; signing out reports null.
const fake = vi.hoisted(() => {
  const state: { user: unknown; listener: ((user: unknown) => void) | null } = { user: null, listener: null };
  return state;
});

vi.mock("../../src/features/auth/authService", () => ({
  watchAuth: (callback: (user: unknown) => void) => {
    fake.listener = callback;
    callback(fake.user);
    return () => {
      fake.listener = null;
    };
  },
  signOutUser: async () => {
    fake.user = null;
    fake.listener?.(null);
  },
  reloadCurrentUser: async () => fake.user,
}));

const USER: AuthUser = {
  uid: "u-test-01",
  email: "p-test-01@example.com",
  displayName: "P-TEST-01",
  emailVerified: true,
  usesPassword: true,
};

function Where({ page }: { page: string }) {
  const location = useLocation();
  return <p data-testid="where">{`${page} ${location.pathname}${location.search}`}</p>;
}

function SignOutButton({ to }: { to: string }) {
  const { signOut } = useAuth();
  return (
    <button type="button" onClick={() => void signOut(to, to === "/" ? { state: { toast: "Signed out" } } : { replace: true })}>
      Sign out
    </button>
  );
}

/** The app's shape: "/" outside the provider, sign-in and /app inside it. */
function renderApp(signOutTo: string) {
  const visited: string[] = [];
  function Track() {
    const location = useLocation();
    visited.push(`${location.pathname}${location.search}`);
    return null;
  }
  render(
    <MemoryRouter initialEntries={["/app/account"]}>
      <Track />
      <Routes>
        <Route path="/" element={<Where page="home" />} />
        <Route
          element={
            <AuthProvider>
              <Outlet />
            </AuthProvider>
          }
        >
          <Route path="/sign-in" element={<Where page="sign-in" />} />
          <Route
            path="/app/*"
            element={
              <RequireAuth>
                <SignOutButton to={signOutTo} />
              </RequireAuth>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return visited;
}

beforeEach(() => {
  fake.user = USER;
  fake.listener = null;
});

describe("AuthProvider sign-out", () => {
  it("Sign out goes home, never by way of /sign-in", async () => {
    const user = userEvent.setup();
    const visited = renderApp("/");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("home /"));
    expect(visited.some((path) => path.startsWith("/sign-in"))).toBe(false);
  });

  it("a timeout lands on /sign-in?reason=timeout, not /sign-in?next=…", async () => {
    const user = userEvent.setup();
    const visited = renderApp("/sign-in?reason=timeout");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("sign-in /sign-in?reason=timeout"));
    expect(visited.some((path) => path.includes("next="))).toBe(false);
  });

  it("a session that ends some other way (another tab) still goes to sign-in with next", async () => {
    renderApp("/");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    act(() => {
      fake.user = null;
      fake.listener?.(null);
    });
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent("sign-in /sign-in?next=%2Fapp%2Faccount"),
    );
  });
});
