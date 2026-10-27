import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GUIDANCE, MO_2026_07, calculate3a, type Worksheet3aCostLine, type Worksheet3aInput, type Worksheet3aResult, type Worksheet3aSection,
} from "../src/index.js";

const STATE = fileURLToPath(new URL("../../../docs/fixtures/state/", import.meta.url));

type Flag = "H9" | "H10" | "H11" | "L2";
interface GoldenWorkbook {
  inputs: { rows: Record<string, [number, number]>; flags: Record<Flag, boolean>; hdm?: [number, number]; nurseVisits: number | null };
  units: Record<string, number | null>;
  costCents: Record<string, number | null>;
}
interface Golden {
  meta: { sourceSha256: string; edition: string; rateCells: Record<string, number | string>; caseCounts: { taskRows: number; workbooks: number } };
  workbooks: GoldenWorkbook[];
}
const golden = JSON.parse(readFileSync(`${STATE}hcbs3a-golden.json`, "utf8")) as Golden;
const sheet = MO_2026_07.worksheet3a!;

const SECTION_OF_ROW = new Map<string, { section: Worksheet3aSection; taskCode?: string }>([
  ...GUIDANCE["3a"].filter((row) => row.taskCode !== null).map((row) => [String(row.row), {
    section: row.section === "PERSONAL CARE" ? "personalCare" : row.section === "HOMEMAKER" ? "homemaker" : "apc",
    taskCode: row.taskCode!,
  }] as const),
  ["100", { section: "respiteBasic" }], ["103", { section: "respiteAdvanced" }], ["109", { section: "adultDayCare" }],
  ["112", { section: "adultDayCareWaiver" }], ["119", { section: "chore" }],
]);

const COST_CELLS: [string, Worksheet3aCostLine][] = [
  ["O30", "personalCare"], ["O66", "homemaker"], ["O90", "apc"], ["O96", "nurseVisits"], ["O100", "respiteBasic"],
  ["O103", "respiteAdvanced"], ["O106", "homeDeliveredMeals"], ["O109", "adultDayCare"], ["O112", "adultDayCareWaiver"], ["O119", "chore"],
];

function inputOf(workbook: GoldenWorkbook): Worksheet3aInput {
  const { rows, flags, hdm, nurseVisits } = workbook.inputs;
  return {
    flags: { personalCareRcfAlf: flags.H9, apcRcfAlf: flags.H10, nurseRcfAlf: flags.H11, medRelHousehold: flags.L2, homemakerRcfAlf: false, cdsBox: false },
    rows: Object.entries(rows).map(([row, [minPerDay, daysPerWeek]]) => ({ ...SECTION_OF_ROW.get(row)!, minPerDay, daysPerWeek })),
    hdm: hdm ? { unitsPerDay: hdm[0], daysPerWeek: hdm[1] } : null,
    nurse: nurseVisits === null ? null : { visitsPerMonth: nurseVisits, tasks: [], comments: "" },
    chore: { tasks: [] },
  };
}
const REPLAYED: { workbook: GoldenWorkbook; result: Worksheet3aResult }[] =
  golden.workbooks.map((workbook) => ({ workbook, result: calculate3a(inputOf(workbook), MO_2026_07) }));

/** "=IF(H9=TRUE,7.66,IF(H9=FALSE,8.14))" → [766, 814]; 8.14 → [814]. */
function cents(cell: number | string): number[] {
  return String(cell).match(/\d+\.\d\d/g)!.map((amount) => Math.round(Number(amount) * 100));
}

describe("HCBS-3a golden file", () => {
  it("was made from the workbook in docs/fixtures/state", () => {
    const sha = createHash("sha256").update(readFileSync(`${STATE}4.00appendix3da3aform.xlsx`)).digest("hex");
    expect(sha, "The golden file was made from a different edition of the worksheet. Run scripts/state/make-golden-3a.py again and review the differences.").toBe(golden.meta.sourceSha256);
    expect(sheet.edition).toBe(golden.meta.edition);
  });

  it("maps every recorded row number to a section of the form", () => {
    const rows = new Set(golden.workbooks.flatMap((w) => Object.keys(w.inputs.rows)));
    expect([...rows].filter((row) => !SECTION_OF_ROW.has(row))).toEqual([]);
    expect(rows.size).toBe(29);
  });
});

describe("WS-A22 the rate sheet's rates", () => {
  it("are the rule pack's rates, read from the workbook's rate cells (W-1)", () => {
    const r = golden.meta.rateCells;
    const [pcRcf, pc] = cents(r.I9!); const [apcRcf, apc] = cents(r.I10!); const [rnRcf, rn] = cents(r.I11!);
    expect(sheet.rates).toEqual({
      personalCare: pc, personalCareRcfAlf: pcRcf, apc, apcRcfAlf: apcRcf, nurseVisit: rn, nurseVisitRcfAlf: rnRcf,
      respiteBasic: cents(r.I3!)[0], respiteAdvanced: cents(r.I5!)[0], adultDayCare: cents(r.I12!)[0],
      homemakerChore: cents(r.I13!)[0], homeDeliveredMeals: cents(r.I14!)[0],
    });
  });
});

describe("WS-A16 chore and every other task row: units match DSDS's workbook", () => {
  it("every row of every recorded workbook (Personal Care, Homemaker, APC, respite, adult day care, chore)", () => {
    const differences = REPLAYED.flatMap(({ workbook, result }) => Object.keys(workbook.inputs.rows).flatMap((row, i) =>
      result.rows[i]!.totalUnits === workbook.units[row] ? [] : [`row ${row} ${JSON.stringify(workbook.inputs.rows[row])}: sheet ${workbook.units[row]}, engine ${result.rows[i]!.totalUnits}`]));
    expect(differences).toEqual([]);
  });
});

describe("WS-A23 Medically Related Household: subtotals N29, N30, N66 and N90", () => {
  it("every recorded workbook, with the box on and off", () => {
    const differences = REPLAYED.filter(({ workbook: { units }, result: { subtotals } }) =>
      units.N29 !== subtotals.medRelHouseholdUnits || units.N30 !== subtotals.personalCareUnits ||
      units.N66 !== subtotals.homemakerUnits || units.N90 !== subtotals.apcUnits);
    expect(differences.length).toBe(0);
    expect(new Set(golden.workbooks.map((w) => w.inputs.flags.L2))).toEqual(new Set([true, false]));
  });
});

describe("WS-A13 Home Delivered Meals: N106 from meals a day", () => {
  it("every recorded workbook", () => {
    expect(REPLAYED.filter(({ workbook, result }) => (result.hdm?.totalUnits ?? null) !== workbook.units.N106).length).toBe(0);
    expect(golden.workbooks.filter((w) => w.inputs.hdm).length).toBeGreaterThan(100);
  });
});

describe("WS-A18 line costs and the total cost O122", () => {
  it.each(COST_CELLS)("%s matches DSDS's workbook in every recorded workbook, in cents", (cell, line) => {
    expect(REPLAYED.filter(({ workbook, result }) => result.costs[line] !== workbook.costCents[cell]).map(({ workbook }) => workbook.inputs)).toEqual([]);
  });

  it("O122 is the sum of the line costs in every recorded workbook", () => {
    expect(REPLAYED.filter(({ workbook, result }) => result.totalCostCents !== workbook.costCents.O122).length).toBe(0);
  });
});

describe("WS-A24 nurse visits are priced per visit, with the RN rate", () => {
  it("O96 in every recorded workbook, RCF/ALF on and off", () => {
    const withVisits = REPLAYED.filter(({ workbook }) => (workbook.inputs.nurseVisits ?? 0) >= 1);
    expect(withVisits.length).toBeGreaterThan(100);
    expect(withVisits.filter(({ workbook, result }) => result.costs.nurseVisits !== workbook.costCents.O96).length).toBe(0);
  });
});

describe("WS-A11 nurse visits add no units", () => {
  it("the recorded subtotals don't move with the visits", () => {
    for (const { workbook, result } of REPLAYED.slice(0, 50)) {
      const without = calculate3a({ ...inputOf(workbook), nurse: null }, MO_2026_07);
      expect(without.subtotals).toEqual(result.subtotals);
      expect(without.respiteUnits).toBe(result.respiteUnits);
    }
  });
});

describe("WS-A12 Respite Basic and Advanced lines", () => {
  it("O100 and O103 match, and the engine adds the two for the 868-unit limit (AUTH-09)", () => {
    for (const { workbook, result } of REPLAYED) {
      expect(result.respiteUnits).toBe((workbook.units["100"] ?? 0) + (workbook.units["103"] ?? 0));
    }
  });
});

describe("the workbook's dead cells", () => {
  it("N115 and O115 are never produced: chore is entered on row 119", () => {
    expect(golden.workbooks.filter((w) => w.units.N115 !== null || w.costCents.O115 !== null)).toEqual([]);
    expect(COST_CELLS.map(([cell]) => cell)).not.toContain("O115");
  });
});

describe("golden case counts", () => {
  it("at least 10,811 task rows in 508 workbooks, and every one replayed", () => {
    expect(golden.meta.caseCounts.taskRows).toBeGreaterThanOrEqual(10_811);
    expect(REPLAYED.reduce((sum, { workbook }) => sum + Object.keys(workbook.inputs.rows).length, 0)).toBe(golden.meta.caseCounts.taskRows);
    expect(REPLAYED.length).toBe(golden.meta.caseCounts.workbooks);
  });
});
