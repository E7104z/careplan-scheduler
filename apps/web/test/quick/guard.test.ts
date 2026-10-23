import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { exampleStateB } from "../../src/features/quick-schedule/state";
import { maxCellMinutes, refusalText, tryChange } from "../../src/features/quick-schedule/guard";
import { reduce } from "../../src/features/quick-schedule/state";
import { buildQuickModel } from "../../src/features/quick-schedule/model";

const TODAY = new Date("2026-10-21T12:00:00-05:00");

describe("Quick Schedule guard", () => {
  it("refuses Bathing Monday 45 -> 60 with the SCH-08 sentence and max 45", () => {
    const state = exampleStateB(TODAY);
    const bathing = state.tasks.find((t) => t.name === "Bathing")!;
    const key = `${bathing.id}:1`;
    const next = structuredClone(state);
    next.edits[key] = 60;

    const result = tryChange(next, MO_2026_07);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(refusalText(result.blocks, next, result.model)).toBe(
        "That would put Bathing over its 93 units in October 2026.",
      );
    }
    expect(maxCellMinutes(state, key, 60, MO_2026_07)).toBe(45);
  });

  it("accepts Monday 45 -> 30, then refuses Tuesday 45 -> 60 with max 55", () => {
    let state = exampleStateB(TODAY);
    const bathing = state.tasks.find((t) => t.name === "Bathing")!;
    const monday = `${bathing.id}:1`;
    const mondayChange = tryChange(
      { ...structuredClone(state), edits: { [monday]: 30 } },
      MO_2026_07,
    );
    expect(mondayChange.ok).toBe(true);

    state = structuredClone(state);
    state.edits[monday] = 30;
    const tuesday = `${bathing.id}:2`;
    const tuesdayChange = tryChange(
      { ...structuredClone(state), edits: { ...state.edits, [tuesday]: 60 } },
      MO_2026_07,
    );
    expect(tuesdayChange.ok).toBe(false);
    expect(maxCellMinutes(state, tuesday, 60, MO_2026_07)).toBe(55);
    // Every accepted change leaves zero BLOCK.
    expect(buildQuickModel(state, MO_2026_07).results.filter((r) => r.severity === "BLOCK")).toHaveLength(0);
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
