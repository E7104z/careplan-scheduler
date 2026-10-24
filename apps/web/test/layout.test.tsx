import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { PublicLayout } from "../src/layouts/PublicLayout";

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<h1>Home page</h1>} />
          <Route path="rules" element={<h1>Rules page</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicLayout phone navigation", () => {
  it("is a disclosure of plain links, not an app menu (WAI-ARIA site navigation)", async () => {
    const user = userEvent.setup();
    renderLayout();
    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const nav = screen.getByRole("navigation", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-controls", nav.id);
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Quick Schedule",
      "Rules and sources",
      "Sign in",
      "Create agency account",
    ]);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes after following a link", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(within(screen.getByRole("navigation", { name: "Menu" })).getByRole("link", { name: "Rules and sources" }));
    expect(screen.getByRole("heading", { name: "Rules page" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Menu" })).toBeNull();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape and returns focus to the button", async () => {
    const user = userEvent.setup();
    renderLayout();
    const toggle = screen.getByRole("button", { name: "Menu" });
    await user.click(toggle);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Menu" })).toBeNull();
    expect(toggle).toHaveFocus();
  });
});
