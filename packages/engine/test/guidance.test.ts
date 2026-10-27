import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AVERAGE_PARTICIPANT_NOTE, GUIDANCE, MO_2026_07, guidanceByLabel, guidanceForTask, type GuidanceRow, type ProgramCode, type WorksheetForm,
} from "../src/index.js";

const STATE = fileURLToPath(new URL("../../../docs/fixtures/state/", import.meta.url));

interface JsonRow {
  row: number; label: string; time: string; freq: string | null;
  minLow: number | null; minHigh: number | null; perWeekLow: number | null; perWeekHigh: number | null;
}
interface Guidance {
  "3c": Record<"CDS" | "ILW", { edition: string; tasks: JsonRow[] }>;
  "3a": { edition: string; sections: { name: string; rows: JsonRow[] }[] };
}
const json = JSON.parse(readFileSync(`${STATE}worksheet-guidance.json`, "utf8")) as Guidance;

/** The fields of a GUIDANCE row as worksheet-guidance.json writes them. */
function asJson(row: GuidanceRow): JsonRow & { section?: string } {
  return {
    ...(row.section === undefined ? {} : { section: row.section }),
    row: row.row, label: row.label, time: row.time, freq: row.freq, minLow: row.minLow, minHigh: row.minHigh,
    perWeekLow: row.frequency?.perWeekLow ?? null, perWeekHigh: row.frequency?.perWeekHigh ?? null,
  };
}
const strip = ({ row, label, time, freq, minLow, minHigh, perWeekLow, perWeekHigh }: JsonRow): JsonRow =>
  ({ row, label, time, freq, minLow, minHigh, perWeekLow, perWeekHigh });

/** Every task whose name or alias is the label, ignoring case and spacing. */
function tasksNamed(label: string): string[] {
  const norm = (text: string): string => text.replace(/\s+/g, " ").trim().toLowerCase();
  return MO_2026_07.tasks.filter((task) => [task.name, ...task.aliases].some((name) => norm(name) === norm(label))).map((task) => task.taskCode);
}

describe("WS-C02 and WS-C03 suggested time and frequency for every task", () => {
  it("GUIDANCE equals worksheet-guidance.json field for field, in DSDS's order (W-1)", () => {
    expect(GUIDANCE["3c-cds"].map(asJson)).toEqual(json["3c"].CDS.tasks.map(strip));
    expect(GUIDANCE["3c-ilw"].map(asJson)).toEqual(json["3c"].ILW.tasks.map(strip));
    expect(GUIDANCE["3a"].map(asJson)).toEqual(json["3a"].sections.flatMap((section) => section.rows.map((row) => ({ section: section.name, ...strip(row) }))));
  });

  it("every 3c task row has a suggested time and frequency", () => {
    for (const form of ["3c-cds", "3c-ilw"] as const) {
      expect(GUIDANCE[form].filter((row) => !row.time || !row.freq)).toEqual([]);
    }
  });

  it("looks rows up by label (spacing and case ignored) and by task", () => {
    expect(guidanceByLabel("3a", "laundry  (home/off site)")?.time).toBe("30-150 MIN");
    expect(guidanceForTask("3c-cds", "BATHING")?.time).toBe("30-45 MIN");
    expect(guidanceForTask("3c-cds", "DIETARY")).toBeUndefined();
  });
});

describe("WS-C01 the 3c's tasks, with DSDS's names, in DSDS's order", () => {
  it("every label maps to exactly one task, the one GUIDANCE names", () => {
    for (const form of ["3c-cds", "3c-ilw", "3a"] as const) {
      for (const row of GUIDANCE[form]) {
        if (row.taskCode === null) continue;
        expect(tasksNamed(row.label), `${form} ${row.label}`).toEqual([row.taskCode]);
      }
    }
  });

  it.each([["3c-cds", "CDS"], ["3c-ilw", "ILW"]] as [WorksheetForm, ProgramCode][])("%s lists every %s task in the pack in the pack's order, and nothing else", (form, program) => {
    const pack = MO_2026_07.tasks.filter((task) => task.programs.includes(program)).map((task) => task.taskCode);
    expect(GUIDANCE[form].map((row) => row.taskCode)).toEqual(pack);
  });
});

describe("the 3a's task sections", () => {
  const section = (name: string): GuidanceRow[] => GUIDANCE["3a"].filter((row) => row.section === name);
  const program = (code: string | null): ProgramCode[] => MO_2026_07.tasks.find((task) => task.taskCode === code)?.programs ?? [];

  it("WS-A02 Personal Care: six agency personal care tasks, then the Med Rel HC Tasks box", () => {
    const rows = section("PERSONAL CARE");
    expect(rows.map((row) => row.label)).toEqual(["BATHING", "DIETARY", "DRESSING/ GROOMING", "MOBILITY/ TRANSFER/ POSITION", "SELF ADMIN OF MEDICATIONS", "TOILETING", "MED REL HC TASKS"]);
    expect(rows.slice(0, 6).filter((row) => !program(row.taskCode).includes("AGENCY_PC"))).toEqual([]);
    expect(rows[6]).toMatchObject({ taskCode: null, time: "USE HC SECTION FOR TASKS/TIMES", minLow: null });
    expect(GUIDANCE["3a"].filter((row) => row.taskCode === null)).toHaveLength(1);
  });

  it("WS-A04 Homemaker: 11 homemaker tasks with suggested ranges", () => {
    const rows = section("HOMEMAKER");
    expect(rows).toHaveLength(11);
    expect(rows.filter((row) => !program(row.taskCode).includes("HOMEMAKER") || row.minLow === null)).toEqual([]);
  });

  it("WS-A05 Advanced Personal Care: 7 APC tasks with suggested ranges", () => {
    const rows = section("ADVANCED PERSONAL CARE");
    expect(rows).toHaveLength(7);
    expect(rows.filter((row) => !program(row.taskCode).includes("APC") || row.minLow === null)).toEqual([]);
  });
});

describe("WS-H08 edition stamp per tab", () => {
  it("the rule pack's 3c editions are the ones DSDS's tabs print", () => {
    expect(MO_2026_07.worksheet3c?.tabs.CDS.edition).toBe(json["3c"].CDS.edition);
    expect(MO_2026_07.worksheet3c?.tabs.ILW.edition).toBe(json["3c"].ILW.edition);
  });
});

describe("WS-M01 suggested times are for an average or typical participant", () => {
  it("says so in the words both manual pages use", () => {
    expect(AVERAGE_PARTICIPANT_NOTE).toBe("DSDS's suggested times and frequencies are for an average or typical participant.");
    for (const page of ["manual-hcbs3c-cds-worksheet.txt", "manual-hcbs3a-in-home-services-worksheet.txt"]) {
      expect(readFileSync(`${STATE}pages/${page}`, "utf8")).toContain("care needs of an average or typical participant");
    }
  });
});
