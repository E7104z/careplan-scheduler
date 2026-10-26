import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { parseFusionText } from "@careplan/import";
import { fromFusion } from "../../src/features/import/fromFusion";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { checksumLines } from "../../src/features/quick-schedule/checksumText";
import fixtureA from "@fixtures/fusion/A-run-together-5day-466.txt?raw";
import fixtureB from "@fixtures/fusion/B-tabbed-7day-455.txt?raw";
import fixtureC from "@fixtures/fusion/C-rows-only-older-plan-402.txt?raw";

const TODAY = new Date("2026-10-21T12:00:00-05:00");

function checksumOf(fixture: string) {
  const checksum = buildQuickModel(fromFusion(parseFusionText(fixture, MO_2026_07), 0, TODAY), MO_2026_07).checksum;
  if (!checksum) throw new Error("Expected a checksum");
  return checksum;
}

describe("IMP-15 / APP-SPEC 5.1 checksum line", () => {
  it("says every task was read when our total matches Fusion's (fixture A)", () => {
    expect(checksumLines(checksumOf(fixtureA))).toEqual({
      lead: "Every task read.",
      detail: "Our total from these tasks matches Fusion's 466 units a month.",
    });
  });

  it("says which month length Fusion's figure is for, and what Fusion's proration gives the others (fixture B)", () => {
    expect(checksumLines(checksumOf(fixtureB))).toEqual({
      lead: "Every task read.",
      detail:
        "Our total from these tasks matches Fusion's 455 units for a 30-day month. Fusion counts the days in each " +
        "month for daily tasks, so a 31-day month has 469 and a 28-day month 434.",
    });
  });

  it("lists our figure for each month length when it doesn't match (fixture C)", () => {
    expect(checksumLines(checksumOf(fixtureC))).toEqual({
      lead: "Our total doesn't match Fusion's 402 units.",
      detail:
        "From these tasks we get 374 in a 28-day month, 391 in a 30-day month, 401 in a 31-day month. " +
        "Check that every row came through. We schedule against Fusion's figure, lowered in shorter months by what " +
        "the daily tasks lose there.",
    });
  });
});
