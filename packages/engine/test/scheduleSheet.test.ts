import { describe, expect, it } from "vitest";
import {
  monthTaskUnits,
  usageMeasures,
  type ScheduleTemplate,
  type TemplateEntry,
} from "../src/index.js";

/**
 * Permanent regression for the DHSS Agency Model workbook demonstration
 * (CALC-09): a weekly task pattern totaling 590 minutes, a worksheet
 * monthly-unit estimate of 181 units, and an October calendar that expands to
 * 2,630 scheduled minutes — 175 whole 15-minute units plus a 5-minute
 * remainder. The three figures are asserted as separate values so the
 * remainder is shown, never silently dropped.
 *
 * The October total depends on the weekday mix, so the fixture pins October
 * 2025 (October 1, 2025 is a Wednesday). October 2026 falls differently and
 * would expand to 2,610 minutes, not 2,630.
 */

function entry(taskId: string, weekday: number, minutes: number): TemplateEntry {
  return { taskId, weekday: weekday as TemplateEntry["weekday"], minutes };
}

/** The weekly pattern as it appears in the Agency Model workbook demonstration. */
function agencyOctoberTemplate(): ScheduleTemplate {
  return {
    id: "tpl-agency-october",
    participantId: "P-TEST-01",
    start: "2025-09-01",
    end: "2026-08-31",
    rulePackVersion: "mo-2026-07",
    entries: [
      // Bathing, 30 min, Monday/Wednesday/Friday.
      entry("P-TEST-bathing", 1, 30),
      entry("P-TEST-bathing", 3, 30),
      entry("P-TEST-bathing", 5, 30),
      // Toileting, 15 min, every day.
      entry("P-TEST-toileting", 0, 15),
      entry("P-TEST-toileting", 1, 15),
      entry("P-TEST-toileting", 2, 15),
      entry("P-TEST-toileting", 3, 15),
      entry("P-TEST-toileting", 4, 15),
      entry("P-TEST-toileting", 5, 15),
      entry("P-TEST-toileting", 6, 15),
      // Meals, 45 min, every day.
      entry("P-TEST-meals", 0, 45),
      entry("P-TEST-meals", 1, 45),
      entry("P-TEST-meals", 2, 45),
      entry("P-TEST-meals", 3, 45),
      entry("P-TEST-meals", 4, 45),
      entry("P-TEST-meals", 5, 45),
      entry("P-TEST-meals", 6, 45),
      // Laundry, 30 min, Tuesday/Thursday.
      entry("P-TEST-laundry", 2, 30),
      entry("P-TEST-laundry", 4, 30),
      // Clean kitchen, 10 min, Sunday/Saturday.
      entry("P-TEST-kitchen", 0, 10),
      entry("P-TEST-kitchen", 6, 10),
    ],
  };
}

/** The same task set as worksheet rows: [taskId, weeklyMinutes, timesPerWeek]. */
const AGENCY_WORKSHEET_ROWS: ReadonlyArray<readonly [string, number, number]> = [
  ["P-TEST-bathing", 90, 3],
  ["P-TEST-toileting", 105, 7],
  ["P-TEST-meals", 315, 7],
  ["P-TEST-laundry", 60, 2],
  ["P-TEST-kitchen", 20, 2],
];

describe("CALC-09: DHSS agency-model October regression (590 / 181 / 2,630)", () => {
  it("weekly pattern totals 590 minutes", () => {
    const template = agencyOctoberTemplate();
    const weeklyMinutes = template.entries.reduce((sum, e) => sum + e.minutes, 0);
    expect(weeklyMinutes).toBe(590);
  });

  it("worksheet monthly-unit estimate is 181 units on a 31-day month", () => {
    const units = AGENCY_WORKSHEET_ROWS.reduce(
      (sum, [, weeklyMinutes, timesPerWeek]) =>
        sum + monthTaskUnits(weeklyMinutes, timesPerWeek, 31).units,
      0,
    );
    expect(units).toBe(181);
  });

  it("October 2025 expands to 2,630 minutes: 175 whole units plus a 5-minute remainder, shown", () => {
    const measures = usageMeasures(agencyOctoberTemplate(), ["2025-10"]);
    expect(measures.calendarMinutes).toBe(2630);
    expect(measures.monthlyWholeUnits).toBe(175);
    expect(measures.monthEndRemainderMinutes).toBe(5); // shown, never dropped
  });
});
