import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MO_2026_07, calculate3c, findTaskByName, serviceByCode, type Worksheet3cInput, type Worksheet3cResult } from "../src/index.js";

const STATE = fileURLToPath(new URL("../../../docs/fixtures/state/", import.meta.url));
const WORKBOOK = "4.00appendix4da-3cform.xlsx";

type Tab = "CDS" | "ILW";
interface GoldenTab {
  edition: string; ceilingValue: number; unitRateCents: number; labels: Record<string, string>;
  formulas: Record<string, string>; numberFormats: Record<string, string>;
  ilwExtras?: Record<string, { label: string; formula: string }>;
}
interface GoldenWorkbook {
  tab: Tab;
  inputs: { rows: Record<string, [number | null, number | null]>; transportMinutes: number | null; ilwExtras?: Record<string, number> };
  units: Record<string, number | null>;
  display: Record<string, [string, string]>;
  transportUnits: number; totalUnits: number; costCents: number;
  ilwExtrasCents?: Record<string, number | null>;
}
interface Golden {
  meta: { sourceSha256: string; tabs: Record<Tab, GoldenTab>; caseCounts: Record<Tab, { taskRows: number; transportCases: number }> };
  workbooks: GoldenWorkbook[];
}

const golden = JSON.parse(readFileSync(`${STATE}hcbs3c-golden.json`, "utf8")) as Golden;
const TABS: Tab[] = ["CDS", "ILW"];
const sheet = MO_2026_07.worksheet3c!;

/** Row number on the sheet → the rule pack's task code, through the label DSDS prints in column A. */
function taskCodes(tab: Tab): Map<string, string> {
  return new Map(Object.entries(golden.meta.tabs[tab].labels).map(([row, label]) => {
    const task = findTaskByName(MO_2026_07, label);
    if (!task) throw new Error(`No task for the ${tab} label ${label}`);
    return [row, task.taskCode];
  }));
}
const CODES = { CDS: taskCodes("CDS"), ILW: taskCodes("ILW") };

function replay(workbook: GoldenWorkbook): { input: Worksheet3cInput; rows: string[]; result: Worksheet3cResult } {
  const rows = Object.keys(workbook.inputs.rows);
  const extra = (row: string): number | null => workbook.inputs.ilwExtras?.[row] ?? null;
  const input: Worksheet3cInput = {
    tab: workbook.tab,
    rows: rows.map((row) => {
      const [minPerDay, daysPerWeek] = workbook.inputs.rows[row]!;
      return { taskCode: CODES[workbook.tab].get(row)!, minPerDay, daysPerWeek };
    }),
    transportMinutesPerMonth: workbook.inputs.transportMinutes,
    ...(workbook.tab === "ILW"
      ? { ilwExtras: { fmsUnits: extra("96"), caseManagementUnits: extra("97"), smsUnits: extra("98"), smeUnits: extra("99"), eaaUnits: extra("100") } }
      : {}),
  };
  return { input, rows, result: calculate3c(input, MO_2026_07) };
}
const REPLAYED = golden.workbooks.map((workbook) => ({ workbook, ...replay(workbook) }));

/** "=L93*5.23" → 523; "=IF(O97=\"\",\"\",458.09)" → 45809; "=O98*100" → 10000. */
function centsIn(formula: string): number {
  const match = /(\d+)(?:\.(\d{1,2}))?\)?$/.exec(formula);
  if (!match) throw new Error(`No amount in ${formula}`);
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

describe("HCBS-3c golden file", () => {
  it("was made from the workbook in docs/fixtures/state", () => {
    const sha = createHash("sha256").update(readFileSync(`${STATE}${WORKBOOK}`)).digest("hex");
    expect(sha, "The golden file was made from a different edition of the worksheet. Run scripts/state/make-golden.py again and review the differences.").toBe(golden.meta.sourceSha256);
  });

  it("gives the rule pack its editions, ceilings and rates (W-1)", () => {
    for (const tab of TABS) {
      const meta = golden.meta.tabs[tab];
      expect(sheet.tabs[tab]).toEqual({ edition: meta.edition, ceiling: meta.ceilingValue });
      expect(sheet.unitRateCents).toBe(centsIn(meta.formulas.O93!));
      expect(meta.unitRateCents).toBe(sheet.unitRateCents);
    }
    const extras = golden.meta.tabs.ILW.ilwExtras!;
    expect(sheet.ilwExtras).toEqual({
      fmsRateCents: centsIn(extras.Q96!.formula), caseManagementCents: centsIn(extras.Q97!.formula),
      smsCents: centsIn(extras.Q98!.formula), smeCents: centsIn(extras.Q99!.formula), eaaCents: centsIn(extras.Q100!.formula),
    });
    expect(sheet.tabs.CDS.ceiling).toBe(serviceByCode(MO_2026_07, "T1019U2")?.monthlyCeiling);
    expect(sheet.tabs.ILW.ceiling).toBe(serviceByCode(MO_2026_07, "T1019U6")?.monthlyCeiling);
  });

  it("shows Units/Day and Units/Wk with the sheet's \"0.0\" number format", () => {
    for (const tab of TABS) {
      expect(golden.meta.tabs[tab].numberFormats).toMatchObject({ M: "0.0", P: "0.0" });
    }
  });
});

describe("WS-C09 task units match DSDS's workbook", () => {
  it("every task row of every recorded workbook", () => {
    const differences = REPLAYED.flatMap(({ workbook, rows, result }) =>
      rows.flatMap((row, i) => (result.rows[i]!.totalUnits === workbook.units[row] ? [] : [`${workbook.tab} row ${row} ${JSON.stringify(workbook.inputs.rows[row])}: sheet ${workbook.units[row]}, engine ${result.rows[i]!.totalUnits}`])));
    expect(differences).toEqual([]);
  });
});

describe("WS-C06 and WS-C08 Units/Day and Units/Wk are shown as the sheet shows them", () => {
  it("every task row of every recorded workbook", () => {
    const differences = REPLAYED.flatMap(({ workbook, rows, result }) =>
      rows.flatMap((row, i) => {
        const shown = [result.rows[i]!.unitsPerDayDisplay, result.rows[i]!.unitsPerWeekDisplay];
        return JSON.stringify(shown) === JSON.stringify(workbook.display[row]) ? [] : [`${workbook.tab} row ${row}: sheet ${JSON.stringify(workbook.display[row])}, engine ${JSON.stringify(shown)}`];
      }));
    expect(differences).toEqual([]);
  });
});

describe("WS-C04 and WS-C05 every whole minute 1–1,440 and every 1–7 days are covered on both tabs", () => {
  it.each(TABS)("%s", (tab) => {
    const seen = new Set(REPLAYED.filter(({ workbook }) => workbook.tab === tab)
      .flatMap(({ workbook }) => Object.values(workbook.inputs.rows)).map(([min, days]) => `${min}×${days}`));
    const missing: string[] = [];
    for (let days = 1; days <= 7; days++) for (let min = 1; min <= 1440; min++) if (!seen.has(`${min}×${days}`)) missing.push(`${min}×${days}`);
    expect(missing).toEqual([]);
  });
});

describe("WS-C10 transportation units match DSDS's workbook", () => {
  it("every recorded workbook", () => {
    expect(REPLAYED.filter(({ workbook, result }) => result.transport.units !== workbook.transportUnits).map(({ workbook }) => workbook.inputs.transportMinutes)).toEqual([]);
  });
});

describe("WS-C11 Total Units/Mo matches DSDS's workbook", () => {
  it("every recorded workbook", () => {
    expect(REPLAYED.filter(({ workbook, result }) => result.totalUnits !== workbook.totalUnits).length).toBe(0);
  });
});

describe("WS-C12 cost matches DSDS's workbook", () => {
  it("every recorded workbook, in cents", () => {
    expect(REPLAYED.filter(({ workbook, result }) => result.costCents !== workbook.costCents).length).toBe(0);
  });
});

/** One ILW service line (Q96–Q100) in every ILW workbook, in cents. */
function extraLine(cell: string, field: keyof NonNullable<Worksheet3cResult["ilwExtras"]>): void {
  it(`every ILW workbook's ${cell}`, () => {
    const ilw = REPLAYED.filter(({ workbook }) => workbook.tab === "ILW");
    expect(ilw.length).toBeGreaterThan(0);
    expect(ilw.filter(({ workbook, result }) => result.ilwExtras?.[field] !== workbook.ilwExtrasCents?.[cell]).map(({ workbook }) => workbook.inputs.ilwExtras)).toEqual([]);
  });
}

describe("WS-I01 Financial Management Services matches DSDS's workbook", () => extraLine("Q96", "fmsCents"));
describe("WS-I02 Case Management matches DSDS's workbook", () => extraLine("Q97", "caseManagementCents"));
describe("WS-I03 Specialized Medical Supplies matches DSDS's workbook", () => extraLine("Q98", "smsCents"));
describe("WS-I04 Specialized Medical Equipment matches DSDS's workbook", () => extraLine("Q99", "smeCents"));
describe("WS-I05 Environmental Accessibility Adaptations matches DSDS's workbook", () => extraLine("Q100", "eaaCents"));

describe("WS-C13 ceiling flag at 641/642 and 868/869", () => {
  it.each(TABS)("%s: red only above the ceiling, at the workbook's own boundary", (tab) => {
    const ceiling = golden.meta.tabs[tab].ceilingValue;
    const totals = REPLAYED.filter(({ workbook }) => workbook.tab === tab).map(({ workbook, result }) => ({ total: workbook.totalUnits, over: result.overCeiling }));
    for (const total of [ceiling - 1, ceiling, ceiling + 1]) {
      expect(totals.find((t) => t.total === total), `a workbook totalling ${total}`).toBeDefined();
    }
    expect(totals.filter(({ total, over }) => over !== total > ceiling)).toEqual([]);
  });
});

describe("WS-C14 blank rows", () => {
  it("a row with no Days/Wk comes back blank from the sheet and counts nothing in the engine", () => {
    const blank = REPLAYED.flatMap(({ workbook, rows, result }) => rows.map((row, i) => ({ sheet: workbook.units[row], days: workbook.inputs.rows[row]![1], engine: result.rows[i]!.totalUnits }))).filter(({ days }) => days === null);
    expect(blank.length).toBeGreaterThan(0);
    expect(blank.filter(({ sheet, engine }) => sheet !== null || engine !== null)).toEqual([]);
  });
});

describe("golden case counts", () => {
  it.each(TABS)("%s: at least 10,080 task rows, and every one replayed", (tab) => {
    const counts = golden.meta.caseCounts[tab];
    const replayed = REPLAYED.filter(({ workbook }) => workbook.tab === tab);
    expect(counts.taskRows).toBeGreaterThanOrEqual(10_080);
    expect(replayed.reduce((sum, { rows }) => sum + rows.length, 0)).toBe(counts.taskRows);
    expect(replayed.filter(({ workbook }) => workbook.inputs.transportMinutes !== null).length).toBe(counts.transportCases);
  });
});
