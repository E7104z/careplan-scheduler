import { beforeEach, describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { fromFusion } from "../../src/features/import/fromFusion";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { loadPlan, PLAN_KEY, savePlan } from "../../src/features/quick-schedule/persistence";
import { planCheckLines } from "../../src/features/quick-schedule/PlanChecks";
import { addProgram, removeProgram, updateProgram } from "../../src/features/quick-schedule/programs";
import { copyFor } from "../../src/features/quick-schedule/ruleCopy";
import { planExtrasValid } from "../../src/features/quick-schedule/storedExtras";
import type { CarePlan, PlanProgram } from "../../src/features/quick-schedule/types";
import { planVisitResults } from "../../src/features/quick-schedule/visits";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-7 on fixture F, built Apr 15, 2026: PC - Agency, PC - CDS and HC.
const PACK = MO_2026_07;

function planF(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), PACK, new Date("2026-04-15T12:00:00-05:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture F should build");
  return outcome.plan;
}

const modelsOf = (plan: CarePlan) => plan.services.map((state) => buildQuickModel(state, PACK));

function withProgram(plan: CarePlan, program: PlanProgram["program"], start?: string, end?: string): CarePlan {
  const added = addProgram(plan);
  const index = added.programs!.length - 1;
  return updateProgram(added, index, { program, ...(start ? { start } : {}), ...(end ? { end } : {}) });
}

function lines(plan: CarePlan) {
  const models = modelsOf(plan);
  return planCheckLines(planVisitResults(plan, models, PACK), plan, models).filter((line) => line.ruleIds.some((id) => id.startsWith("PRG")));
}

beforeEach(() => sessionStorage.clear());

describe("CP4-7: other programs on the plan (PRG-01 to PRG-03)", () => {
  it("none entered: no program check (never inferred)", () => {
    expect(lines(planF())).toEqual([]);
  });

  it("PACE over the plan's dates: every HCBS service is Must fix, said once", () => {
    const found = lines(withProgram(planF(), "PACE"));
    expect(found).toEqual([
      expect.objectContaining({
        severity: "BLOCK",
        text: copyFor("PRG-01", "BLOCK")!.title,
        ruleIds: ["PRG-01"],
        services: ["PC - Agency", "PC - CDS", "HC"],
        count: 3,
      }),
    ]);
  });

  it("DD Individualized Supportive Living rules out State Plan personal care only (not HC)", () => {
    const [line] = lines(withProgram(planF(), "DD_ISL"));
    expect(line).toMatchObject({ severity: "BLOCK", ruleIds: ["PRG-02"], services: ["PC - Agency", "PC - CDS"] });
  });

  it("DMH self-directed services rule out CDS, not agency care", () => {
    const [line] = lines(withProgram(planF(), "DMH_SELF_DIRECTED"));
    expect(line).toMatchObject({ severity: "BLOCK", ruleIds: ["PRG-02"], services: ["PC - CDS"] });
  });

  it("DD waiver personal assistant services: State Plan first, under review", () => {
    const [line] = lines(withProgram(planF(), "DD_WAIVER_PERSONAL_ASSISTANT"));
    expect(line).toMatchObject({ severity: "REVIEW", ruleIds: ["PRG-03"], text: copyFor("PRG-03", "REVIEW")!.title });
  });

  it("a program that ended before the plan: nothing to fix", () => {
    expect(lines(withProgram(planF(), "PACE", "2024-01-01", "2024-12-31"))).toEqual([]);
  });

  it("taking the program off clears the check", () => {
    expect(lines(removeProgram(withProgram(planF(), "PACE"), 0))).toEqual([]);
  });
});

describe("CP4-7: programs in storage", () => {
  it("round-trip with no name or DCN", () => {
    const plan = withProgram(planF(), "DD_SHARED_LIVING", "2026-05-01", "2026-09-30");
    savePlan(plan);
    const stored = sessionStorage.getItem(PLAN_KEY)!;
    expect(stored).toContain('"program":"DD_SHARED_LIVING"');
    expect(stored).not.toMatch(/SAMPLE PARTICIPANT|10000006/);
    expect(loadPlan()!.programs).toEqual([{ program: "DD_SHARED_LIVING", start: "2026-05-01", end: "2026-09-30" }]);
  });

  it("a stored program with an unknown code or a bad date is refused; none at all is fine (older plans)", () => {
    expect(planExtrasValid({ programs: [{ program: "PACE", start: "2026-05-01", end: "2026-09-30" }] })).toBe(true);
    expect(planExtrasValid({ programs: [{ program: "HOSPICE", start: "2026-05-01", end: "2026-09-30" }] })).toBe(false);
    expect(planExtrasValid({ programs: [{ program: "PACE", start: "May 1", end: "2026-09-30" }] })).toBe(false);
    expect(planExtrasValid({})).toBe(true);
  });
});

describe("CP4-7: CDS task labels (CDS-01 to CDS-03) on the service's own checks", () => {
  it("a CDS task Fusion prints as Prompting/Cueing is Must fix, on that task (fixture B, PC - CDS)", () => {
    const state = fromFusion(parseFusionText(fixtureB, PACK), 0, new Date("2025-11-20T12:00:00-06:00"));
    const first = state.tasks[0]!;
    const prompting = { ...first, id: `${first.id}-p`, taskCode: "FUSION:Prompting/Cueing", name: "Prompting/Cueing" };
    const model = buildQuickModel({ ...state, tasks: [...state.tasks, prompting] }, PACK);
    expect(model.results.filter((r) => r.ruleId === "CDS-01").map((r) => [r.severity, r.refs.taskId])).toEqual([["BLOCK", prompting.id]]);
    // The plan as Fusion printed it has none: only CDS-04, for its transportation.
    expect(buildQuickModel(state, PACK).results.filter((r) => r.ruleId.startsWith("CDS-")).map((r) => r.ruleId)).toEqual(["CDS-04"]);
  });
});
