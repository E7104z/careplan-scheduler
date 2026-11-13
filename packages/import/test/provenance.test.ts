import { describe, expect, it } from "vitest";
import { mergeFusionText, parseFusionText } from "../src/index.js";
import { PACK, fixtureText } from "./helpers.js";

// SOURCE-01: every parsed value that came from the text carries the page and line it came from.
const F = "F-care-plan-report-multi.txt";

describe("SOURCE-01 provenance: page and line references", () => {
  it("points the participant and plan at their own lines", () => {
    const result = parseFusionText(fixtureText(F), PACK);
    expect(result.sources.participant).toEqual({ page: 1, line: 1 });
    expect(result.sources.plan).toEqual({ page: 1, line: 14 });
    expect(result.sources.totalCost).toBeNull();
  });

  it("points every task at the exact line its raw text came from", () => {
    const text = fixtureText(F);
    const lines = text.split("\n");
    const result = parseFusionText(text, PACK);
    for (const service of result.services) {
      expect(service.source.page).toBe(1);
      expect(service.source.line).toBeGreaterThanOrEqual(1);
      expect(service.source.line).toBeLessThanOrEqual(lines.length);
      for (const task of service.tasks) {
        expect(task.source.page).toBe(1);
        expect(lines[task.source.line - 1]!.trim()).toBe(task.raw);
      }
    }
    for (const visit of result.visits) {
      expect(visit.source.page).toBe(1);
      expect(visit.source.line).toBeGreaterThanOrEqual(1);
      expect(visit.source.line).toBeLessThanOrEqual(lines.length);
    }
  });

  it("numbers pages in a multi-page paste", () => {
    const text = fixtureText(F);
    const cut = text.indexOf("Date Generated: 10/23/2026 | Page 4 of 7");
    const result = mergeFusionText([text.slice(0, cut), text.slice(cut)], PACK);

    const pages = result.services.flatMap((service) => service.tasks.map((task) => task.source.page));
    expect([...new Set(pages)].sort()).toEqual([1, 2]);

    const homemaker = result.services.find((service) => service.label === "HC");
    expect(homemaker!.source.page).toBe(2);
  });
});
