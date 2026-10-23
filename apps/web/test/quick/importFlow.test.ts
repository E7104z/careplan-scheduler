import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { addPage, emptyImportFlow, next, setChoice } from "../../src/features/import/importFlow";
import type { QuickState } from "../../src/features/quick-schedule/types";
import fixtureB1 from "@fixtures/fusion/B-page1-of-2.txt?raw";
import fixtureB2 from "@fixtures/fusion/B-page2-of-2.txt?raw";
import fixtureD from "@fixtures/fusion/D-page1-only-incomplete.txt?raw";

const TODAY = new Date("2026-10-21T12:00:00-05:00");

function readyState(flow: ReturnType<typeof emptyImportFlow>): QuickState {
  const outcome = next(flow, MO_2026_07, TODAY);
  if (outcome.kind !== "ready") throw new Error("Expected a ready outcome");
  return outcome.state;
}

describe("import flow", () => {
  it("fixture D needs \"incomplete\"; accepting builds with the note", () => {
    const flow = addPage(emptyImportFlow(), fixtureD);
    const needs = next(flow, MO_2026_07, TODAY);
    expect(needs.kind).toBe("needs");
    if (needs.kind === "needs") {
      expect(needs.issues.map((i) => i.code)).toContain("incomplete");
    }

    const accepted = next(setChoice(flow, { kind: "acceptPartial" }), MO_2026_07, TODAY);
    expect(accepted.kind).toBe("ready");
    if (accepted.kind === "ready") {
      expect(accepted.state.notes.some((n) => n.code === "incomplete")).toBe(true);
    }
  });

  it("B page 1 then page 2 builds 15 tasks", () => {
    let flow = addPage(emptyImportFlow(), fixtureB1);
    expect(next(flow, MO_2026_07, TODAY).kind).toBe("needs");
    flow = addPage(flow, fixtureB2);
    expect(readyState(flow).tasks).toHaveLength(15);
  });

  it("table-only text needs \"no-plan-dates\" then builds after dates", () => {
    const tableOnly = "300 units Bathing 30 7";
    const flow = addPage(emptyImportFlow(), tableOnly);
    const needs = next(flow, MO_2026_07, TODAY);
    expect(needs.kind).toBe("needs");
    if (needs.kind === "needs") {
      expect(needs.issues.map((i) => i.code)).toContain("no-plan-dates");
    }

    const chosen = setChoice(flow, {
      kind: "plan",
      plan: { start: "2026-01-01", end: "2026-12-31" },
    });
    const state = readyState(chosen);
    expect(state.tasks).toHaveLength(1);
    expect(state.plan).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("junk needs \"no-rows\"", () => {
    const flow = addPage(emptyImportFlow(), "This is not a care plan");
    const outcome = next(flow, MO_2026_07, TODAY);
    expect(outcome.kind).toBe("needs");
    if (outcome.kind === "needs") {
      expect(outcome.issues.map((i) => i.code)).toContain("no-rows");
    }
  });

  it("an unknown service label needs \"unknown-service\" then builds after a choice", () => {
    const text =
      "XX - ABC | TEST PROVIDER | 5555550100 | 01/01/2026 - 12/31/2026 | 300 units | $100.00 | PA: 20250000000009\n" +
      "300 units Bathing 30 7";
    const flow = addPage(emptyImportFlow(), text);
    const needs = next(flow, MO_2026_07, TODAY);
    expect(needs.kind).toBe("needs");
    if (needs.kind === "needs") {
      expect(needs.issues.map((i) => i.code)).toContain("unknown-service");
    }

    const chosen = setChoice(flow, { kind: "serviceCode", code: "T1019U2" });
    const state = readyState(chosen);
    expect(state.serviceCode).toBe("T1019U2");
    expect(state.tasks).toHaveLength(1);
  });
});
