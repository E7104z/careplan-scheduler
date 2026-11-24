import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { exampleStateB } from "../../src/features/quick-schedule/state";
import { cellRefusal, maxCellMinutes, tryChange } from "../../src/features/quick-schedule/guard";
import { reduce } from "../../src/features/quick-schedule/state";
import { buildQuickModel } from "../../src/features/quick-schedule/model";

const TODAY = new Date("2026-10-21T12:00:00-05:00");

describe("Quick Schedule guard", () => {
  it("accepts a minute change that puts a task over its monthly units: over-authorization is a warning, not a refusal", () => {
    const state = exampleStateB(TODAY);
    const bathing = state.tasks.find((t) => t.name === "Bathing")!;
    const key = `${bathing.id}:1`;
    const next = structuredClone(state);
    next.edits[key] = 60;

    const result = tryChange(next, MO_2026_07);
    expect(result.ok).toBe(true);
    // SCH-08 is a WARN now: the month is flagged, the change is accepted.
    expect(result.model.results.filter((r) => r.ruleId === "SCH-08").some((r) => r.severity === "WARN")).toBe(true);
    expect(maxCellMinutes(state, key, 60, MO_2026_07)).toBe(60);
  });

  it("gives no refusal box for a change that goes over: the month is flagged, not refused", () => {
    const state = exampleStateB(TODAY);
    const bathing = state.tasks.find((t) => t.name === "Bathing")!;
    expect(cellRefusal(state, `${bathing.id}:1`, 60, MO_2026_07)).toBeNull();
  });

  it("gives no refusal box for a change that fits", () => {
    const state = exampleStateB(TODAY);
    const bathing = state.tasks.find((t) => t.name === "Bathing")!;
    expect(cellRefusal(state, `${bathing.id}:1`, 30, MO_2026_07)).toBeNull();
  });

  it("refuses a second Clean Bath day by the pin limit", () => {
    const state = exampleStateB(TODAY);
    const cleanBath = state.tasks.find((t) => t.name === "Clean Bath")!;
    const placed = buildQuickModel(state, MO_2026_07).entries
      .filter((e) => e.taskId === cleanBath.id)
      .map((e) => e.weekday);
    const otherDay: 0 | 1 | 2 | 3 | 4 | 5 | 6 = (placed[0] ?? 1) === 1 ? 2 : 1;

    const result = reduce(
      state,
      { type: "togglePinDay", taskId: cleanBath.id, weekday: otherDay, placedDays: placed },
      MO_2026_07,
    );
    expect(result.refusal).toBe("Clean Bath is authorized for 1 day a week. Unselect a day first.");
    expect(result.state).toBe(state);
  });
});
