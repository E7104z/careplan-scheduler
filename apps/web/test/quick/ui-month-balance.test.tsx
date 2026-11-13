import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { MonthBalance } from "../../src/features/quick-schedule/MonthBalance";
import { buildQuickModel, monthFigures } from "../../src/features/quick-schedule/model";
import { manualState, reduce } from "../../src/features/quick-schedule/state";

const TODAY = new Date("2026-10-21T12:00:00-05:00");

function respiteModel(code: "S5150" | "S5150TF") {
  let state = reduce(manualState(TODAY), { type: "setService", code }, MO_2026_07).state;
  state = reduce(state, { type: "setFusionUnits", month: "2026-11", units: 500 }, MO_2026_07).state;
  return buildQuickModel(state, MO_2026_07);
}

describe("MonthBalance combined respite figure", () => {
  it("shows the combined Basic + Advanced figure on a respite service", () => {
    const model = respiteModel("S5150");
    const { container } = render(
      <MonthBalance
        model={model}
        month="2026-11"
        figures={monthFigures(model, "2026-11")}
        combinedRespite={{ units: 1000, ceiling: 868 }}
      />,
    );
    expect(container.textContent).toContain("Combined respite (Basic + Advanced): 1000 of 868 units");
  });

  it("does not show the combined line on a non-respite service", () => {
    const model = buildQuickModel(
      reduce(manualState(TODAY), { type: "setService", code: "T1019" }, MO_2026_07).state,
      MO_2026_07,
    );
    const { container } = render(
      <MonthBalance
        model={model}
        month="2026-11"
        figures={monthFigures(model, "2026-11")}
        combinedRespite={{ units: 1000, ceiling: 868 }}
      />,
    );
    expect(container.textContent).not.toContain("Combined respite (Basic + Advanced):");
  });
});
