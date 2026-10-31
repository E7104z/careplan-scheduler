import { afterEach, describe, expect, it, vi } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { exampleStateB, manualState, reduce } from "../../src/features/quick-schedule/state";
import { loadPlan, loadQuickState, savePlan, saveQuickState } from "../../src/features/quick-schedule/persistence";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import type { CarePlan } from "../../src/features/quick-schedule/types";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";
import { buildQuickModel } from "../../src/features/quick-schedule/model";

const TODAY = new Date("2026-10-21T12:00:00-05:00");
const KEY = "cps.quick.v3";

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

/** The saved service with one field replaced, as if the stored copy were old or edited by hand. */
function storedWith(change: (saved: Record<string, unknown>) => void): void {
  saveQuickState(exampleStateB(TODAY));
  const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as { services: Record<string, unknown>[] };
  change(saved.services[0]!);
  sessionStorage.setItem(KEY, JSON.stringify(saved));
}

describe("Quick Schedule persistence", () => {
  it("round trip drops identity and keeps everything else", () => {
    const state = exampleStateB(TODAY);
    expect(state.identity).not.toBeNull();

    saveQuickState(state);
    expect(sessionStorage.getItem(KEY)).not.toContain("SAMPLE PARTICIPANT");
    expect(sessionStorage.getItem(KEY)).not.toContain("10000002");
    const loaded = loadQuickState();

    expect(loaded).toEqual({ ...state, identity: null });
    expect(() => buildQuickModel(loaded!, MO_2026_07)).not.toThrow();
  });

  it("a reloaded example is still the example; a reloaded plan is still a plan", () => {
    saveQuickState(exampleStateB(TODAY));
    expect(loadQuickState()!.isExample).toBe(true);

    saveQuickState({ ...exampleStateB(TODAY), isExample: false });
    expect(loadQuickState()!.isExample).toBe(false);
  });

  it("round trips a by-hand plan with tasks, changes and Fusion units", () => {
    let state = manualState(TODAY);
    state = reduce(state, { type: "addTask", taskCode: "BATHING", name: "Bathing" }, MO_2026_07).state;
    state = reduce(state, { type: "setFusionUnits", month: "2026-11", units: 120 }, MO_2026_07).state;
    state = reduce(state, { type: "setCell", key: `${state.tasks[0]!.id}:1`, minutes: 0 }, MO_2026_07).state;
    saveQuickState(state);
    expect(loadQuickState()).toEqual(state);
  });

  it("corrupt JSON -> null", () => {
    sessionStorage.setItem(KEY, "{not json");
    expect(loadQuickState()).toBeNull();
  });

  it("throwing storage -> null", () => {
    vi.spyOn(sessionStorage, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    expect(loadQuickState()).toBeNull();
  });

  it("invalid shape -> null", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ source: "fusion" }));
    expect(loadQuickState()).toBeNull();
  });

  // Each of these would make buildQuickModel throw or compute nonsense, so the page falls back
  // to the example instead (APP-SPEC 5.6 "restore if the shape validates, else show the example").
  const broken: Record<string, (saved: Record<string, unknown>) => void> = {
    "an unknown service code": (s) => { s.serviceCode = "X9999"; },
    "a plan date that isn't YYYY-MM-DD": (s) => { s.plan = { start: "Dec 1", end: "2026-10-31" }; },
    "a viewed month that isn't YYYY-MM": (s) => { s.viewMonth = "October"; },
    "care days that aren't booleans": (s) => { s.activeDays = [1, 1, 1, 1, 1, 1, 1]; },
    "a task with text minutes": (s) => { (s.tasks as Record<string, unknown>[])[0]!.minPerDay = "45"; },
    "a task with 9 days a week": (s) => { (s.tasks as Record<string, unknown>[])[0]!.daysPerWeek = 9; },
    "a task pinned to day 7": (s) => { (s.tasks as Record<string, unknown>[])[0]!.pinned = [7]; },
    "a cell change that isn't whole minutes": (s) => { s.edits = { "qt-1:1": "30" }; },
    "Fusion transportation without minutes": (s) => { s.transport = { day: 1 }; },
    "header units that aren't a number": (s) => { s.headerUnits = "455"; },
  };
  for (const [what, change] of Object.entries(broken)) {
    it(`rejects ${what}`, () => {
      storedWith(change);
      expect(loadQuickState()).toBeNull();
    });
  }

  it("keeps the month the schedule starts from and the review date; a bad one falls back to the example", () => {
    const state = { ...exampleStateB(TODAY), reviewed: "2026-10-20" };
    saveQuickState(state);
    expect(loadQuickState()).toMatchObject({ fromMonth: "2026-10", reviewed: "2026-10-20" });
    storedWith((saved) => {
      saved.fromMonth = "October";
    });
    expect(loadQuickState()).toBeNull();
    storedWith((saved) => {
      saved.reviewed = "yesterday";
    });
    expect(loadQuickState()).toBeNull();
  });
});

describe("APP-SPEC 5.8: the whole care plan", () => {
  function planF(): CarePlan {
    const outcome = next(addPage(emptyImportFlow(), fixtureF), MO_2026_07, TODAY);
    if (outcome.kind !== "ready") throw new Error("Expected a ready outcome");
    return outcome.plan;
  }

  it("round trips every service, the visits, the notes and the view, without the name or DCN", () => {
    const plan = { ...planF(), view: 2 as const };
    savePlan(plan);
    const raw = sessionStorage.getItem(KEY) ?? "";
    expect(raw).not.toContain("SAMPLE PARTICIPANT");
    expect(raw).not.toContain("10000006");
    expect(loadPlan()).toEqual({ ...plan, services: plan.services.map((state) => ({ ...state, identity: null })) });
  });

  it("still opens a single service saved by the version before", () => {
    const state = { ...exampleStateB(TODAY), identity: null };
    sessionStorage.setItem("cps.quick.v2", JSON.stringify(state));
    expect(loadPlan()).toEqual({ services: [state], visits: [], notes: [], view: 0 });
  });

  const brokenPlan: Record<string, (saved: Record<string, unknown>) => void> = {
    "no services": (s) => { s.services = []; },
    "a view past the last service": (s) => { s.view = 3; },
    "the whole plan with one service": (s) => { s.services = (s.services as unknown[]).slice(0, 1); },
    "a visit without its month": (s) => { (s.visits as Record<string, unknown>[])[0]!.start = "May"; },
    "a visit with an unknown code": (s) => { (s.visits as Record<string, unknown>[])[0]!.serviceCode = "X9999"; },
  };
  for (const [what, change] of Object.entries(brokenPlan)) {
    it(`rejects ${what}`, () => {
      savePlan(planF());
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
      change(saved);
      sessionStorage.setItem(KEY, JSON.stringify(saved));
      expect(loadPlan()).toBeNull();
    });
  }
});
