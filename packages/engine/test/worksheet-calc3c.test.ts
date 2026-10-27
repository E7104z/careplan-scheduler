import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DAYS_ISSUE, MINUTES_ISSUE, MO_2026_07, TRANSPORT_ISSUE, UNITS_ISSUE, calculate3c, dollars, hcbs3cTaskUnits, oneDecimal,
  type DaysPerWeek, type Worksheet3cInput,
} from "../src/index.js";

function one(minPerDay: number | null, daysPerWeek: number | null, tab: "CDS" | "ILW" = "CDS"): Worksheet3cInput {
  return { tab, rows: [{ taskCode: "BATHING", minPerDay, daysPerWeek }], transportMinutesPerMonth: null };
}

describe("calculate3c task rows", () => {
  it("TC-04: 309 min a day, 5 days a week → 474 units", () => {
    const result = calculate3c(one(309, 5), MO_2026_07);
    expect(result.rows[0]?.totalUnits).toBe(474);
    expect(result.rows[0]?.maxDaysPerMonth).toBe(23);
    expect(result.rows[0]?.formulaText).toBe("309 min ÷ 15 × 23 days = 473.8, rounded up to 474 units");
  });

  it("equals F-2a (hcbs3cTaskUnits) for every whole minute 0–1,440 and 1–7 days", () => {
    const differences: string[] = [];
    for (let days = 1; days <= 7; days++) {
      for (let min = 0; min <= 1440; min++) {
        const units = calculate3c(one(min, days), MO_2026_07).rows[0]?.totalUnits;
        if (units !== hcbs3cTaskUnits(min, days as DaysPerWeek).units) differences.push(`${min}×${days}`);
      }
    }
    expect(differences).toEqual([]);
  });

  it("gives Units/Day and Units/Wk as exact fractions and as the sheet's one-decimal text", () => {
    const row = calculate3c(one(7, 3), MO_2026_07).rows[0]!;
    expect(row.unitsPerDay).toEqual({ num: 7, den: 15 });
    expect(row.unitsPerWeek).toEqual({ num: 21, den: 15 });
    expect(row.unitsPerDayDisplay).toBe("0.5");
    expect(row.unitsPerWeekDisplay).toBe("1.4");
    expect(oneDecimal({ num: 1440 * 7, den: 15 })).toBe("672.0");
    expect(oneDecimal({ num: 1, den: 15 })).toBe("0.1");
    expect(oneDecimal({ num: 3, den: 2 })).toBe("1.5");
    expect(oneDecimal({ num: 1, den: 20 })).toBe("0.1");
    expect([dollars(335243), dollars(5), dollars(0), dollars(123456789)]).toEqual(["$3,352.43", "$0.05", "$0.00", "$1,234,567.89"]);
  });

  it("says an exact result without rounding", () => {
    expect(calculate3c(one(45, 3), MO_2026_07).rows[0]?.formulaText).toBe("45 min ÷ 15 × 15 days = 45 units");
    expect(calculate3c(one(1, 1), MO_2026_07).rows[0]?.formulaText).toBe("1 min ÷ 15 × 5 days = 0.3, rounded up to 1 unit");
  });
});

describe("Excel cross-check", () => {
  // The three values Jason confirms in Excel (Prompt 2). If Excel shows anything else, stop (W-2).
  it.each([
    [61, 7, 127],
    [45, 3, 45],
    [309, 5, 474],
  ])("%i min × %i days → %i units", (min, days, units) => {
    expect(calculate3c(one(min, days), MO_2026_07).rows[0]?.totalUnits).toBe(units);
  });
});

describe("calculate3c blank and invalid rows", () => {
  it("counts nothing for a row with no Days/Wk, as the sheet does", () => {
    const row = calculate3c(one(45, null), MO_2026_07).rows[0]!;
    expect(row.totalUnits).toBeNull();
    expect(row.unitsPerDayDisplay).toBe("");
    expect(row.unitsPerWeekDisplay).toBe("0.0");
    expect(row.maxDaysPerMonth).toBeNull();
  });

  it("counts 0 for a row with days and no minutes", () => {
    const row = calculate3c(one(null, 4), MO_2026_07).rows[0]!;
    expect(row.totalUnits).toBe(0);
    expect(row.unitsPerDayDisplay).toBe("0.0");
  });

  it("lists bad minutes and days as issues, counts the row as nothing and does not throw", () => {
    const input: Worksheet3cInput = {
      tab: "CDS",
      rows: [
        { taskCode: "BATHING", minPerDay: 1441, daysPerWeek: 7 },
        { taskCode: "TRASH", minPerDay: 12.5, daysPerWeek: 1 },
        { taskCode: "MAKE_BED", minPerDay: -5, daysPerWeek: 1 },
        { taskCode: "TREATMENTS", minPerDay: 15, daysPerWeek: 8 },
        { taskCode: "MEDICATIONS", minPerDay: 15, daysPerWeek: 0 },
      ],
      transportMinutesPerMonth: 30.5,
    };
    const result = calculate3c(input, MO_2026_07);
    expect(result.rows.map((row) => row.totalUnits)).toEqual([null, null, null, null, null]);
    expect(result.totalUnits).toBe(0);
    expect(result.issues.map((issue) => [issue.rowIndex, issue.field, issue.message])).toEqual([
      [0, "minPerDay", MINUTES_ISSUE],
      [1, "minPerDay", MINUTES_ISSUE],
      [2, "minPerDay", MINUTES_ISSUE],
      [3, "daysPerWeek", DAYS_ISSUE],
      [4, "daysPerWeek", DAYS_ISSUE],
      [undefined, "transportMinutesPerMonth", TRANSPORT_ISSUE],
    ]);
    expect(MINUTES_ISSUE).toBe("Enter whole minutes from 0 to 1,440.");
    expect(DAYS_ISSUE).toBe("Choose 1 to 7 days.");
  });
});

describe("calculate3c totals", () => {
  it("rounds transportation down and keeps the minutes the sheet drops (TC-20)", () => {
    const result = calculate3c({ tab: "CDS", rows: [], transportMinutesPerMonth: 250 }, MO_2026_07);
    expect(result.transport).toEqual({
      minutesPerMonth: 250, units: 16, unallocatedMinutes: 10,
      formulaText: "250 min a month ÷ 15 = 16 units, rounded down (10 minutes left over)",
    });
  });

  it("adds task units and transportation units, and prices them at the sheet's rate", () => {
    const input: Worksheet3cInput = {
      tab: "CDS",
      rows: [{ taskCode: "BATHING", minPerDay: 45, daysPerWeek: 3 }, { taskCode: "TRASH", minPerDay: 10, daysPerWeek: 1 }],
      transportMinutesPerMonth: 345,
    };
    const result = calculate3c(input, MO_2026_07);
    expect(result.totalUnits).toBe(45 + 4 + 23);
    expect(result.costCents).toBe(72 * MO_2026_07.worksheet3c!.unitRateCents);
    expect(result.costText).toBe("72 units × $5.23 = $376.56");
    expect(result.edition).toBe("DSDS-HCBS-3c (10/26)");
  });

  it("flags the total above the tab's ceiling, not at it", () => {
    const at = calculate3c({ tab: "CDS", rows: [], transportMinutesPerMonth: 641 * 15 }, MO_2026_07);
    const above = calculate3c({ tab: "CDS", rows: [], transportMinutesPerMonth: 642 * 15 }, MO_2026_07);
    expect([at.totalUnits, at.overCeiling, above.overCeiling]).toEqual([641, false, true]);
    const ilw = calculate3c({ tab: "ILW", rows: [], transportMinutesPerMonth: 868 * 15 }, MO_2026_07);
    expect([ilw.ceiling, ilw.overCeiling, ilw.edition]).toEqual([868, false, "DSDS-HCBS-3c (07/26)"]);
  });
});

describe("calculate3c ILW service lines", () => {
  it("prices FMS, SMS, SME and EAA by units, and gives Case Management's flat amount for any entry", () => {
    const result = calculate3c({
      tab: "ILW", rows: [], transportMinutesPerMonth: null,
      ilwExtras: { fmsUnits: 2, caseManagementUnits: 0, smsUnits: 3, smeUnits: 0, eaaUnits: 1 },
    }, MO_2026_07);
    expect(result.ilwExtras).toEqual({ fmsCents: 31578, caseManagementCents: 45809, smsCents: 30000, smeCents: 0, eaaCents: 10000 });
  });

  it("shows no Case Management amount when it is blank, and none of the lines on the CDS tab", () => {
    const ilw = calculate3c({ tab: "ILW", rows: [], transportMinutesPerMonth: null }, MO_2026_07);
    expect(ilw.ilwExtras).toEqual({ fmsCents: 0, caseManagementCents: null, smsCents: 0, smeCents: 0, eaaCents: 0 });
    expect(calculate3c({ tab: "CDS", rows: [], transportMinutesPerMonth: null }, MO_2026_07).ilwExtras).toBeNull();
  });

  it("lists a bad unit count as an issue", () => {
    const result = calculate3c({
      tab: "ILW", rows: [], transportMinutesPerMonth: null,
      ilwExtras: { fmsUnits: 1.5, caseManagementUnits: null, smsUnits: null, smeUnits: null, eaaUnits: null },
    }, MO_2026_07);
    expect(result.ilwExtras?.fmsCents).toBe(0);
    expect(result.issues).toEqual([{ field: "ilwExtras", message: UNITS_ISSUE }]);
  });
});

describe("WS-C15 the worksheet's 31-day basis", () => {
  it("is the 7-day row of the days-per-month table, which the 3a prints as its footnote", () => {
    const guidance = JSON.parse(readFileSync(fileURLToPath(new URL("../../../docs/fixtures/state/worksheet-guidance.json", import.meta.url)), "utf8")) as { "3a": { footnote: string } };
    expect(MO_2026_07.worksheet3c?.daysBasis).toBe(MO_2026_07.daysPerMonthFactor[7]);
    expect(guidance["3a"].footnote).toContain(`based on a ${MO_2026_07.worksheet3c?.daysBasis} day month`);
  });
});
