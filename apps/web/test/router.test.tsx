import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, MemoryRouter, RouterProvider, useRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import { routes } from "../src/router";

// Public pages are lazy chunks (APP-SPEC 10). A chunk's first load is compiled on the fly in
// tests, so allow longer than the default 1 s for the heading to appear.
const LAZY = { timeout: 5000 };

/**
 * Waits for the page's h1, then for the effect that focuses it and sets the title: the heading
 * is in the DOM before that effect runs, so the two are checked once it has.
 */
async function expectPage(title: string, name?: string): Promise<void> {
  const heading = await screen.findByRole("heading", name ? { level: 1, name } : { level: 1 }, LAZY);
  await waitFor(() => {
    expect(heading).toHaveFocus();
    expect(document.title).toBe(title);
  });
}

describe("public routing", () => {
  it("sets the landing title and focuses its heading", async () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);
    await expectPage("CarePlan Scheduler");
  });

  it("a printed page leaves out the site's header and footer (the schedule prints its own)", async () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/quick"] })} />);
    await expectPage("Quick Schedule | CarePlan Scheduler", "Quick Schedule");
    // The first banner is the site's header (each panel has a header of its own).
    expect(screen.getAllByRole("banner")[0]).toHaveClass("print:hidden");
    expect(screen.getByRole("contentinfo")).toHaveClass("print:hidden");
  });

  it("renders the rules route with its title and focus", async () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/rules"] })} />);
    await expectPage("Rules and sources | CarePlan Scheduler", "Rules and sources");
  });

  it("moves the title and focus when following links between pages", async () => {
    // Declarative routing over the same route table: jsdom's AbortSignal can't drive a data
    // router's navigate() under Node, but clicking the real links works the same way.
    function App() {
      return useRoutes(routes);
    }
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    await expectPage("CarePlan Scheduler");

    await user.click(within(screen.getByRole("navigation", { name: "Footer" })).getByRole("link", { name: "Privacy" }));
    await expectPage("Privacy | CarePlan Scheduler", "Privacy");

    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Rules and sources" }));
    await expectPage("Rules and sources | CarePlan Scheduler", "Rules and sources");

    await user.click(screen.getByRole("link", { name: "CarePlan Scheduler home" }));
    await expectPage("CarePlan Scheduler", "Open a Fusion care plan PDF. Get a schedule that follows Missouri's rules.");
  });

  it("an unknown path renders Not found right away (it isn't a lazy page)", async () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/nope"] })} />);
    await expectPage("Page not found | CarePlan Scheduler", "We can't find that page");
  });
});
