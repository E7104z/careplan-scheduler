import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { MO_2026_07, RULE_CATALOG } from "@careplan/engine";
import {
  exampleMatchLine,
  exampleRefusal,
  exampleWeek,
} from "../src/features/landing/example";
import { Landing } from "../src/pages/Landing";
import { NotFound } from "../src/pages/NotFound";
import { Privacy } from "../src/pages/Privacy";
import { Rules } from "../src/pages/Rules";

describe("Landing", () => {
  it("renders the spec copy and engine-computed figures", () => {
    render(<Landing />, { wrapper: MemoryRouter });

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Paste a Fusion care plan. Get a schedule that follows Missouri's rules.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Copy the care plan from Fusion or open its PDF. CarePlan Scheduler reads every " +
          "task, checks its total against Fusion's, builds the week, and won't let anyone " +
          "change it in a way that breaks a rule. Every check names the policy it comes from.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try Quick Schedule" })).toHaveAttribute(
      "href",
      "/quick",
    );
    expect(screen.getByRole("link", { name: "Create agency account" })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    expect(
      screen.getByText("Quick Schedule needs no account. Nothing you paste is uploaded."),
    ).toBeInTheDocument();

    // The four figures come from the engine and the import package, not hardcoded output.
    const matchLine = "Every task read. Our total from these tasks matches Fusion's 466 units a month.";
    const weekText = "70, 90, 90, 90, 90, 90, 70";
    const refusalSentence = "That would put Bathing over its 69 units in October 2025.";
    const refusalFix =
      "Bathing can't have more than 45 minutes on Tuesday. To add time here, take it from another day first.";

    expect(exampleMatchLine()).toBe(matchLine);
    expect(exampleWeek().weekText).toBe(weekText);
    const refusal = exampleRefusal();
    expect(refusal.sentence).toBe(refusalSentence);
    expect(refusal.fix).toBe(refusalFix);

    expect(screen.getByText(matchLine)).toBeInTheDocument();
    expect(screen.getByText(weekText)).toBeInTheDocument();
    expect(screen.getByText(refusalSentence)).toBeInTheDocument();
    expect(screen.getByText(refusalFix)).toBeInTheDocument();
  });
});

describe("Rules", () => {
  it("lists every rule, every service code and every monthly ceiling", () => {
    render(<Rules />, { wrapper: MemoryRouter });

    expect(
      screen.getByRole("heading", { level: 1, name: "Rules and sources" }),
    ).toBeInTheDocument();

    for (const rule of RULE_CATALOG) {
      expect(screen.getByText(rule.id)).toBeInTheDocument();
    }
    // SCH-17 (October 2025 end-of-month trim) is part of the catalog.
    expect(screen.getByText("SCH-17")).toBeInTheDocument();

    for (const service of MO_2026_07.services) {
      expect(screen.getByText(service.code)).toBeInTheDocument();
      if (service.monthlyCeiling !== null) {
        expect(
          screen.getAllByText(String(service.monthlyCeiling)).length,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe("Privacy", () => {
  it("explains local reading, accounts and the contact address", () => {
    render(<Privacy />, { wrapper: MemoryRouter });

    expect(screen.getByRole("heading", { level: 1, name: "Privacy" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing you paste is uploaded/)).toBeInTheDocument();
    expect(screen.getByText(/business associate agreement/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "support@thecdscloud.com" })).toHaveAttribute(
      "href",
      "mailto:support@thecdscloud.com",
    );
  });
});

describe("NotFound", () => {
  it("offers links home and to Quick Schedule", () => {
    render(<NotFound />, { wrapper: MemoryRouter });

    expect(
      screen.getByRole("heading", { level: 1, name: "We can't find that page" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Try Quick Schedule" })).toHaveAttribute(
      "href",
      "/quick",
    );
  });
});
