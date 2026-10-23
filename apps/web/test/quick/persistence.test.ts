import { afterEach, describe, expect, it, vi } from "vitest";
import { exampleStateB } from "../../src/features/quick-schedule/state";
import { loadQuickState, saveQuickState } from "../../src/features/quick-schedule/persistence";

const TODAY = new Date("2026-10-21T12:00:00-05:00");

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("Quick Schedule persistence", () => {
  it("round trip drops identity and marks the plan as not an example", () => {
    const state = exampleStateB(TODAY);
    expect(state.identity).not.toBeNull();

    saveQuickState(state);
    const loaded = loadQuickState();

    expect(loaded).not.toBeNull();
    expect(loaded!.identity).toBeNull();
    expect(loaded!.isExample).toBe(false);
    expect(loaded!.source).toBe("fusion");
    expect(loaded!.tasks).toHaveLength(state.tasks.length);
  });

  it("corrupt JSON -> null", () => {
    sessionStorage.setItem("cps.quick.v2", "{not json");
    expect(loadQuickState()).toBeNull();
  });

  it("throwing storage -> null", () => {
    vi.spyOn(sessionStorage, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    expect(loadQuickState()).toBeNull();
  });

  it("invalid shape -> null", () => {
    sessionStorage.setItem("cps.quick.v2", JSON.stringify({ source: "fusion" }));
    expect(loadQuickState()).toBeNull();
  });
});
