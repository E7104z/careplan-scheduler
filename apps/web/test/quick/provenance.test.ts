import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { fromFusion } from "../../src/features/import/fromFusion";
import { buildQuickModel } from "../../src/features/quick-schedule/model";

const TODAY = new Date("2026-10-21T12:00:00-05:00");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Two authorizations that each read a "Bathing" task, so the same label shows up twice. */
const TWO_SERVICES = [
  "PC - CDS | TEST PROVIDER | 5555550100 | 01/01/2026 - 12/31/2026 | 300 units | PA: 20250000000009",
  "300 units\tBathing\t30\t7",
  "PC - CDS | TEST PROVIDER | 5555550100 | 01/01/2026 - 12/31/2026 | 200 units | PA: 20250000000010",
  "200 units\tBathing\t30\t7",
].join("\n");

describe("CP2-6: task UUIDs and provenance", () => {
  it("JOIN-03: the same task label in two authorizations gets two distinct UUIDs, each under its own authorization UUID", () => {
    const parsed = parseFusionText(TWO_SERVICES, MO_2026_07);
    expect(parsed.services).toHaveLength(2);
    const first = fromFusion(parsed, 0, TODAY);
    const second = fromFusion(parsed, 1, TODAY);

    expect(first.id).toMatch(UUID);
    expect(second.id).toMatch(UUID);
    expect(first.id).not.toBe(second.id);

    const firstBath = first.tasks.find((task) => task.name === "Bathing");
    const secondBath = second.tasks.find((task) => task.name === "Bathing");
    expect(firstBath).toBeDefined();
    expect(secondBath).toBeDefined();
    expect(firstBath!.id).toMatch(UUID);
    expect(secondBath!.id).toMatch(UUID);
    expect(firstBath!.id).not.toBe(secondBath!.id);

    // The model wires each task to its own authorization, not a shared one.
    expect(buildQuickModel(first, MO_2026_07).auth.id).toBe(first.id);
    expect(buildQuickModel(first, MO_2026_07).tasks[0]!.serviceAuthId).toBe(first.id);
    expect(buildQuickModel(second, MO_2026_07).auth.id).toBe(second.id);
    expect(buildQuickModel(second, MO_2026_07).tasks[0]!.serviceAuthId).toBe(second.id);
  });

  it("SOURCE-01: fromFusion keeps each task's raw row and page/line, and the authorization's page/line", () => {
    const parsed = parseFusionText(TWO_SERVICES, MO_2026_07);
    const first = fromFusion(parsed, 0, TODAY);
    const second = fromFusion(parsed, 1, TODAY);
    const firstBath = first.tasks.find((task) => task.name === "Bathing")!;
    const secondBath = second.tasks.find((task) => task.name === "Bathing")!;

    expect(first.sourceRef).toEqual({ page: 1, line: 1 });
    expect(firstBath.raw).toBe("Bathing\t30\t7");
    expect(firstBath.source).toEqual({ page: 1, line: 2 });
    expect(second.sourceRef).toEqual({ page: 1, line: 3 });
    expect(secondBath.raw).toBe("Bathing\t30\t7");
    expect(secondBath.source).toEqual({ page: 1, line: 4 });
  });
});
