import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { addPage, emptyImportFlow, next, setChoice } from "../../src/features/import/importFlow";
import type { QuickState } from "../../src/features/quick-schedule/types";
import fixtureB1 from "@fixtures/fusion/B-page1-of-2.txt?raw";
import fixtureB2 from "@fixtures/fusion/B-page2-of-2.txt?raw";
import fixtureD from "@fixtures/fusion/D-page1-only-incomplete.txt?raw";
import fixtureA from "@fixtures/fusion/A-run-together-5day-466.txt?raw";

const TODAY = new Date("2026-10-21T12:00:00-05:00");
/** Inside fixture D's plan (Sep 1, 2025 to Jun 30, 2026); on TODAY it has ended. */
const DURING_D = new Date("2026-01-15T12:00:00-06:00");

function readyState(flow: ReturnType<typeof emptyImportFlow>): QuickState {
  const outcome = next(flow, MO_2026_07, TODAY);
  if (outcome.kind !== "ready") throw new Error("Expected a ready outcome");
  return outcome.state;
}

describe("import flow", () => {
  it("fixture D needs \"incomplete\"; accepting builds with the note", () => {
    const flow = addPage(emptyImportFlow(), fixtureD);
    const needs = next(flow, MO_2026_07, DURING_D);
    expect(needs.kind).toBe("needs");
    if (needs.kind === "needs") {
      expect(needs.issues.map((i) => i.code)).toContain("incomplete");
    }

    const accepted = next(setChoice(flow, { kind: "acceptPartial" }), MO_2026_07, DURING_D);
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

  it("a plan that ended before this month needs \"plan-ended\" and doesn't build (D on Oct 21, 2026)", () => {
    const outcome = next(setChoice(addPage(emptyImportFlow(), fixtureD), { kind: "acceptPartial" }), MO_2026_07, TODAY);
    expect(outcome.kind).toBe("needs");
    if (outcome.kind === "needs") {
      expect(outcome.issues).toEqual([
        { level: "error", code: "plan-ended", message: "This care plan ended on Jun 30, 2026." },
      ]);
    }
  });

  it("plan dates entered that have ended keep the date fields open, so they can be entered again", () => {
    const flow = setChoice(addPage(emptyImportFlow(), "300 units Bathing 30 7"), {
      kind: "plan",
      plan: { start: "2025-01-01", end: "2025-12-31" },
    });
    const outcome = next(flow, MO_2026_07, TODAY);
    expect(outcome.kind).toBe("needs");
    if (outcome.kind === "needs") expect(outcome.issues.map((i) => i.code)).toEqual(["no-plan-dates", "plan-ended"]);
    const fixed = setChoice(flow, { kind: "plan", plan: { start: "2026-10-01", end: "2027-09-30" } });
    expect(readyState(fixed).plan).toEqual({ start: "2026-10-01", end: "2027-09-30" });
  });

  it("a plan ending this month still builds: this month is scheduled", () => {
    const state = readyState(addPage(addPage(emptyImportFlow(), fixtureB1), fixtureB2));
    expect(state.plan.end).toBe("2026-10-31");
    expect(state.fromMonth).toBe("2026-10");
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

function codesOf(outcome: ReturnType<typeof next>): string[] {
  return outcome.kind === "needs" ? outcome.issues.map((issue) => issue.code) : [];
}

const TWO_SERVICES = [
  "PC - CDS | TEST PROVIDER | 5555550100 | 01/01/2026 - 12/31/2026 | 300 units | PA: 20250000000009",
  "300 units\tBathing\t17\t7", // odd minutes: a note for the first service only
  "XX - ABC | TEST PROVIDER | 5555550100 | 01/01/2026 - 12/31/2026 | 200 units | PA: 20250000000010",
  "200 units\tTrash\t5\t7",
  "200 units\tPet Care\t15\t7",
].join("\n");

const TWO_KNOWN = TWO_SERVICES.replace("XX - ABC", "PC - CDS");

describe("import flow: recovering from a wrong page or a choice", () => {
  it("IMP-12: a page for a different participant is refused, and the right page still builds", () => {
    let flow = addPage(emptyImportFlow(), fixtureB1);
    flow = addPage(flow, fixtureA);
    const refused = next(flow, MO_2026_07, TODAY);
    expect(codesOf(refused)).toContain("different-participant");
    if (refused.kind === "needs") {
      const issue = refused.issues.find((i) => i.code === "different-participant");
      expect(issue?.message).toBe("Page 2 is for a different participant.");
    }

    flow = addPage(flow, fixtureB2);
    const state = readyState(flow);
    expect(state.tasks).toHaveLength(15);
    expect(state.identity?.dcn).toBe("10000002");
  });

  it("with several services, waits for one to be chosen before asking which service a label is", () => {
    const flow = addPage(emptyImportFlow(), TWO_SERVICES);
    const outcome = next(flow, MO_2026_07, TODAY);
    expect(outcome.kind).toBe("needs");
    if (outcome.kind === "needs") {
      expect(outcome.serviceIndex).toBeNull();
      expect(outcome.issues.map((i) => i.code)).not.toContain("unknown-service");
    }
  });

  it("a known service builds without a service choice, and a stray choice doesn't change it", () => {
    const flow = setChoice(addPage(emptyImportFlow(), TWO_SERVICES), { kind: "serviceIndex", index: 0 });
    expect(readyState(flow).serviceCode).toBe("T1019U2");
    const stray = setChoice(flow, { kind: "serviceCode", code: "S5130" });
    expect(readyState(stray).serviceCode).toBe("T1019U2");
  });

  it("an unknown service asks which service it is, and only its own rows become notes", () => {
    const flow = setChoice(addPage(emptyImportFlow(), TWO_SERVICES), { kind: "serviceIndex", index: 1 });
    expect(codesOf(next(flow, MO_2026_07, TODAY))).toEqual(["unknown-service"]);
    const state = readyState(setChoice(flow, { kind: "serviceCode", code: "S5130" }));
    expect(state.serviceCode).toBe("S5130");
    expect(state.tasks.map((t) => t.name)).toEqual(["Trash", "Pet Care"]);
    expect(state.notes.map((n) => [n.code, n.name])).toEqual([["unknown-task", "Pet Care"]]);
  });

  it("a service choice out of range waits for a real choice", () => {
    const flow = setChoice(addPage(emptyImportFlow(), TWO_KNOWN), { kind: "serviceIndex", index: 5 });
    const outcome = next(flow, MO_2026_07, TODAY);
    expect(outcome.kind).toBe("needs");
    if (outcome.kind === "needs") expect(outcome.serviceIndex).toBeNull();
  });

  it("dates the person enters must be real dates, ending after they start", () => {
    const flow = addPage(emptyImportFlow(), "300 units Bathing 30 7");
    for (const plan of [
      { start: "2026-12-31", end: "2026-01-01" },
      { start: "2026-02-30", end: "2026-12-31" },
      { start: "", end: "" },
    ]) {
      expect(codesOf(next(setChoice(flow, { kind: "plan", plan }), MO_2026_07, TODAY))).toContain("bad-dates");
    }
  });

  it("plan dates that don't make sense on the care plan can be corrected by entering them", () => {
    const text = "SAMPLE PARTICIPANT E (DCN: 10000005) Care Plan: 02/30/2026 - 12/31/2026\n300 units\tBathing\t30\t7";
    const flow = addPage(emptyImportFlow(), text);
    expect(codesOf(next(flow, MO_2026_07, TODAY))).toEqual(["bad-dates"]);
    const plan = { start: "2026-03-01", end: "2026-12-31" };
    expect(readyState(setChoice(flow, { kind: "plan", plan })).plan).toEqual(plan);
  });
});
