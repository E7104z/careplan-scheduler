import { describe, expect, it } from "vitest";
import { parseFusionText } from "../src/index.js";
import { fixtureText, PACK } from "./helpers.js";

// Fixture Q: a real Nov 2026 care plan report's layout (APC, two RN authorizations, PC - Agency),
// with made-up identifiers. Fusion prints T1019 for APC, and an RN block lists each task with
// its visits a month.
describe("IMP-T34 fixture Q: APC and nurse visit tasks", () => {
  const result = parseFusionText(fixtureText("Q-care-plan-report-apc-rn.txt"), PACK);

  it("names APC as Advanced Personal Care (T1019TF), not CDS, though Fusion prints T1019", () => {
    expect(result.services.map((service) => [service.label, service.serviceCode])).toEqual([
      ["APC", "T1019TF"],
      ["PC - Agency", "T1019"],
    ]);
    expect(result.issues.some((issue) => issue.code === "unknown-service")).toBe(false);
    // What Fusion printed is kept, so the printout can say where the modifier came from.
    expect(result.services.map((service) => service.procedureCode)).toEqual(["T1019", "T1019"]);
  });

  it("keeps every task of a nurse visit authorization, with its visits a month", () => {
    const first = result.visits.filter((visit) => visit.pa === "20260000000052");
    expect(first).toHaveLength(6);
    for (const visit of first) {
      expect(visit.tasks).toEqual([
        { name: "Eval APC Plan", unitsPerMonth: 2 },
        { name: "Train APC", unitsPerMonth: 1 },
      ]);
      expect(visit.name).toBe("Eval APC Plan, Train APC");
    }
    const second = result.visits.filter((visit) => visit.pa === "20260000000054");
    expect(second.map((visit) => visit.tasks)).toEqual(Array(6).fill([{ name: "Eval APC Plan", unitsPerMonth: 1 }]));
  });

  it("flags tasks that add up to more visits than Fusion authorized, once per authorization", () => {
    const flagged = result.issues.filter((issue) => issue.code === "visit-units");
    expect(flagged).toEqual([
      {
        level: "warn",
        code: "visit-units",
        label: "RN",
        message:
          "RN (PA 20260000000052): its tasks add up to 3 visits a month (Eval APC Plan 2, Train APC 1), but Fusion authorized 2 a month. Ask the care manager which is right; the plan keeps Fusion's 2.",
      },
    ]);
  });

  it("notes each RN authorization's tasks, not only the first task", () => {
    const notes = result.issues.filter((issue) => issue.code === "not-scheduled").map((issue) => issue.message);
    expect(notes).toEqual(["RN (Eval APC Plan, Train APC) is a nurse visit, so it's listed by month, not in the week."]);
  });
});

describe("IMP-T35 fixture Q split into its pages", () => {
  it("keeps the visit tasks and the units note when the pages are opened one by one", async () => {
    const { mergeFusionText } = await import("../src/index.js");
    const text = fixtureText("Q-care-plan-report-apc-rn.txt");
    const pages = text.split(/(?=Date Generated: 11\/01\/2026 \| Page [2-4] of 5)/);
    const merged = mergeFusionText(pages, PACK);
    const whole = parseFusionText(text, PACK);
    expect(merged.visits.map((visit) => visit.tasks)).toEqual(whole.visits.map((visit) => visit.tasks));
    expect(merged.issues.filter((issue) => issue.code === "visit-units")).toHaveLength(1);
    expect(merged.issues.filter((issue) => issue.code === "not-scheduled")).toHaveLength(1);
  });
});
