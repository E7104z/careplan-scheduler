import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { Button } from "../src/ui/Button";
import { Dialog } from "../src/ui/Dialog";
import { Field } from "../src/ui/Field";
import { FlashToast } from "../src/ui/FlashToast";
import { Menu } from "../src/ui/Menu";
import { PageLoading } from "../src/ui/PageLoading";
import { TextInput } from "../src/ui/TextInput";
import { ToastHost, useToast } from "../src/ui/ToastHost";

function statusWith(text: string): boolean {
  return screen.getAllByRole("status").some((element) => element.textContent?.includes(text));
}

describe("TextInput", () => {
  it("takes its label from Field and keeps its type", () => {
    render(
      <Field label="Work email" hint="Required">
        <TextInput type="email" />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Work email" });
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAccessibleDescription("Required");
  });
});

describe("PageLoading", () => {
  it("says the page is loading", () => {
    render(<PageLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the page");
  });
});

describe("Dialog without a trigger", () => {
  it("opens from state, with its title as its name", () => {
    render(
      <Dialog title="You'll be signed out in 2 minutes" open>
        <p>Time left</p>
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "You'll be signed out in 2 minutes" })).toBeInTheDocument();
  });
});

describe("Dialog with a toast showing", () => {
  it("Escape closes the dialog and leaves the toast, and focus returns to the trigger", async () => {
    function Copy() {
      const toast = useToast();
      return <Button onClick={() => toast("Invite link copied")}>Copy invite link</Button>;
    }
    // The toast itself (its message, inside the li), not Radix's screen-reader copy of its text.
    // The open dialog hides the rest of the page from screen readers, hence `hidden: true`.
    const toastItem = () =>
      screen.getAllByRole("status", { hidden: true }).find((element) => element.closest("li") !== null);
    const user = userEvent.setup();
    render(
      <ToastHost>
        <Dialog title="Invite someone" trigger={<Button>Invite someone</Button>}>
          <Copy />
        </Dialog>
      </ToastHost>,
    );
    await user.click(screen.getByRole("button", { name: "Invite someone" }));
    await user.click(screen.getByRole("button", { name: "Copy invite link" }));
    expect(toastItem()).toHaveTextContent("Invite link copied");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toastItem()).toHaveTextContent("Invite link copied");
    expect(screen.getByRole("button", { name: "Invite someone" })).toHaveFocus();
  });
});

describe("Menu with a two-line label", () => {
  it("shows the label above the items", async () => {
    const user = userEvent.setup();
    render(
      <Menu
        label={
          <>
            <span>P-TEST-01</span>
            <span>p-test-01@example.com</span>
          </>
        }
        trigger={<Button>Account</Button>}
        items={[{ label: "Sign out" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Account" }));
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveTextContent("p-test-01@example.com");
  });
});

describe("ToastHost", () => {
  it("shows a toast from anywhere below it", async () => {
    function Save() {
      const toast = useToast();
      return <Button onClick={() => toast("Changes saved")}>Save changes</Button>;
    }
    const user = userEvent.setup();
    render(
      <ToastHost>
        <Save />
      </ToastHost>,
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(statusWith("Changes saved")).toBe(true);
  });
});

describe("FlashToast", () => {
  it("shows the handed-over message, and clears it from history when closed", async () => {
    function Where() {
      const location = useLocation();
      return <p data-testid="state">{JSON.stringify(location.state)}</p>;
    }
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/", state: { toast: "Signed out" } }]}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Where />
                <FlashToast message="Signed out" />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(statusWith("Signed out")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("null"));
  });
});
