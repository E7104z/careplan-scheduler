import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Account } from "../../src/features/auth/Account";
import { AuthContext, type AuthContextValue, type AuthUser } from "../../src/features/auth/authContext";
import * as service from "../../src/features/auth/authService";
import { ResetPassword } from "../../src/features/auth/ResetPassword";
import { SignIn } from "../../src/features/auth/SignIn";
import { SignUp } from "../../src/features/auth/SignUp";
import { VerifyEmail } from "../../src/features/auth/VerifyEmail";
import { ToastHost } from "../../src/ui/ToastHost";

vi.mock("../../src/features/auth/authService", () => ({
  finishGoogleRedirect: vi.fn(async () => undefined),
  signInWithEmail: vi.fn(async () => undefined),
  signUpWithEmail: vi.fn(async () => undefined),
  signInWithGoogle: vi.fn(async () => undefined),
  sendPasswordReset: vi.fn(async () => undefined),
  resendVerification: vi.fn(async () => undefined),
  saveDisplayName: vi.fn(async () => undefined),
}));

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
    signOut: vi.fn(async () => undefined),
    refresh: vi.fn(async () => user?.emailVerified ?? false),
    ...overrides,
  };
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

/** Renders `page` at `path`; anywhere else shows where navigation went. */
function renderPage(page: ReactNode, entry: InitialEntry, value: AuthContextValue) {
  const path = (typeof entry === "string" ? entry : (entry.pathname ?? "/")).split("?")[0];
  const user = userEvent.setup();
  render(
    <AuthContext.Provider value={value}>
      <ToastHost>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path={path} element={page} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </ToastHost>
    </AuthContext.Provider>,
  );
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Create account", () => {
  it("says what each field needs and focuses the first one", async () => {
    const user = renderPage(<SignUp />, "/sign-up", auth(null));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter an email address like name@agency.com.")).toBeInTheDocument();
    expect(screen.getByText("Use at least 12 characters.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your name" })).toHaveFocus();
    expect(service.signUpWithEmail).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: "Your name" }), "P-TEST-01");
    await user.type(screen.getByRole("textbox", { name: "Work email" }), "p-test-01@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByLabelText("Password", { selector: "input" })).toHaveFocus();
    expect(service.signUpWithEmail).not.toHaveBeenCalled();
  });

  it("creates the account, then goes to Check your email keeping next", async () => {
    const user = renderPage(<SignUp />, "/sign-up?next=%2Fapp%2Faccount", auth(null));
    await user.type(screen.getByRole("textbox", { name: "Your name" }), "  P-TEST-01 ");
    await user.type(screen.getByRole("textbox", { name: "Work email" }), "p-test-01@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "p-test-password-01");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(service.signUpWithEmail).toHaveBeenCalledWith("P-TEST-01", "p-test-01@example.com", "p-test-password-01");
    expect(await screen.findByTestId("where")).toHaveTextContent("/verify-email?next=%2Fapp%2Faccount");
  });

  it("shows the password and hides it again", async () => {
    const user = renderPage(<SignUp />, "/sign-up", auth(null));
    const input = screen.getByLabelText("Password", { selector: "input" });
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });
});

describe("Sign in", () => {
  it("explains a timeout, and turns a Firebase error into its sentence", async () => {
    vi.mocked(service.signInWithEmail).mockRejectedValueOnce({ code: "auth/invalid-credential" });
    const user = renderPage(<SignIn />, "/sign-in?reason=timeout", auth(null));
    expect(screen.getByRole("note")).toHaveTextContent("You were signed out after 30 minutes without activity.");

    await user.type(screen.getByRole("textbox", { name: "Email" }), "p-test-01@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "p-test-password-01");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email and password don't match. Try again or reset your password.",
    );
  });

  it("a closed Google popup shows nothing", async () => {
    vi.mocked(service.signInWithGoogle).mockRejectedValueOnce({ code: "auth/popup-closed-by-user" });
    const user = renderPage(<SignIn />, "/sign-in", auth(null));
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(service.signInWithGoogle).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps next on the link to Create an account", () => {
    renderPage(<SignIn />, "/sign-in?next=%2Fapp%2Faccount", auth(null));
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/sign-up?next=%2Fapp%2Faccount",
    );
  });
});

describe("Reset password", () => {
  it("gives the same answer for any email", async () => {
    const user = renderPage(<ResetPassword />, "/reset-password", auth(null));
    await user.type(screen.getByRole("textbox", { name: "Email" }), "p-test-01@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(service.sendPasswordReset).toHaveBeenCalledWith("p-test-01@example.com");
    expect(await screen.findByText("If an account uses that email, a reset link is on its way.")).toBeInTheDocument();
  });
});

describe("Check your email", () => {
  const unverified = { ...USER, emailVerified: false };

  it("right after sign-up, Send the email again waits; I've verified says when it isn't yet", async () => {
    const value = auth(unverified, { refresh: vi.fn(async () => false) });
    const user = renderPage(<VerifyEmail />, { pathname: "/verify-email", state: { sent: true } }, value);
    expect(screen.getByText("p-test-01@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send the email again" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "I've verified my email" }));
    expect(
      await screen.findByText("We don't see the verification yet. Open the link in the email, then try again."),
    ).toBeInTheDocument();
  });

  it("sending again disables the button and says so", async () => {
    const user = renderPage(<VerifyEmail />, "/verify-email", auth(unverified));
    const resend = screen.getByRole("button", { name: "Send the email again" });
    expect(resend).toBeEnabled();
    await user.click(resend);
    expect(service.resendVerification).toHaveBeenCalled();
    expect(resend).toBeDisabled();
    expect(await screen.findByText("We sent the email again.")).toBeInTheDocument();
  });

  it("once verified, goes on to next", () => {
    renderPage(<VerifyEmail />, "/verify-email?next=%2Fapp%2Faccount", auth(USER));
    expect(screen.getByTestId("where")).toHaveTextContent("/app/account");
  });
});

describe("Your account", () => {
  it("saves the name with a toast", async () => {
    const value = auth(USER);
    const user = renderPage(<Account />, "/app/account", value);
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("P-TEST-01");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("readonly");

    await user.clear(name);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Enter your name.")).toBeInTheDocument();
    expect(service.saveDisplayName).not.toHaveBeenCalled();

    await user.type(name, "P-TEST-02");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(service.saveDisplayName).toHaveBeenCalledWith("P-TEST-02");
    expect(value.refresh).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getAllByRole("status").some((element) => element.textContent?.includes("Changes saved"))).toBe(true),
    );
  });

  it("offers a password reset email only to password accounts", async () => {
    const user = renderPage(<Account />, "/app/account", auth(USER));
    await user.click(screen.getByRole("button", { name: "Send password reset email" }));
    expect(service.sendPasswordReset).toHaveBeenCalledWith("p-test-01@example.com");
  });

  it("has no password section for a Google account", () => {
    renderPage(<Account />, "/app/account", auth({ ...USER, usesPassword: false }));
    expect(screen.queryByRole("button", { name: "Send password reset email" })).not.toBeInTheDocument();
  });

  it("Appearance applies and remembers the theme; Sign out goes home with the toast", async () => {
    const value = auth(USER);
    const user = renderPage(<Account />, "/app/account", value);
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("cps.theme")).toBe("dark");
    await user.click(screen.getByRole("radio", { name: "System" }));
    expect(document.documentElement).not.toHaveAttribute("data-theme");

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(value.signOut).toHaveBeenCalledWith("/", { state: { toast: "Signed out" } });
  });
});
