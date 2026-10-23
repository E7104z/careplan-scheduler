import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { routes } from "../src/router";

describe("public routing", () => {
  it("sets the landing title and focuses its heading", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={router} />);

    expect(document.title).toBe("CarePlan Scheduler");
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("renders the rules route with its title and focus", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/rules"] });
    render(<RouterProvider router={router} />);

    const heading = screen.getByRole("heading", { level: 1, name: "Rules and sources" });
    expect(heading).toBeInTheDocument();
    expect(document.title).toBe("Rules and sources | CarePlan Scheduler");
    expect(heading).toHaveFocus();
  });
});
