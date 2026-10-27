// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MO_2026_07, calculate3c, findTaskByName } from "@careplan/engine";
import { CONFORMANCE } from "../src/pages/conformanceSamples";

const STATE = join(import.meta.dirname, "../../../docs/fixtures/state");
const read = (file: string): Buffer => readFileSync(join(STATE, file));

interface GoldenC {
  meta: { sourceSha256: string; soffice: string; generated: string; tabs: Record<"CDS" | "ILW", { edition: string; ceilingValue: number }>; caseCounts: Record<string, unknown> & { workbooks: number }; minutesRange: number[]; daysRange: number[] };
  workbooks: { tab: string; inputs: { rows: Record<string, [number | null, number | null]>; transportMinutes: number | null }; units: Record<string, number | null>; totalUnits: number }[];
}
interface GoldenA { meta: { sourceSha256: string; edition: string; soffice: string; caseCounts: { taskRows: number; workbooks: number } } }

const c = JSON.parse(read("hcbs3c-golden.json").toString("utf8")) as GoldenC;
const a = JSON.parse(read("hcbs3a-golden.json").toString("utf8")) as GoldenA;
const sha = (file: string): string => createHash("sha256").update(read(file)).digest("hex");

describe("WS-X07 the conformance page's figures come from the golden files", () => {
  it("says 0 differences", () => {
    expect(CONFORMANCE.differences).toBe(0);
  });

  it("has the golden files' counts, editions, hashes and LibreOffice versions (run make-conformance-samples.mjs if this fails)", () => {
    expect(CONFORMANCE.generated).toBe(c.meta.generated);
    expect(CONFORMANCE.libreOffice).toBe(c.meta.soffice);
    expect(CONFORMANCE.hcbs3c).toEqual({
      file: "4.00appendix4da-3cform.xlsx", sha256: sha("4.00appendix4da-3cform.xlsx"), sourceSha256: c.meta.sourceSha256,
      editions: { CDS: c.meta.tabs.CDS.edition, ILW: c.meta.tabs.ILW.edition },
      ceilings: { CDS: c.meta.tabs.CDS.ceilingValue, ILW: c.meta.tabs.ILW.ceilingValue },
      workbooks: c.meta.caseCounts.workbooks, tabs: { CDS: c.meta.caseCounts.CDS, ILW: c.meta.caseCounts.ILW },
      minutes: c.meta.minutesRange, days: c.meta.daysRange,
    });
    expect(CONFORMANCE.hcbs3c.sha256).toBe(CONFORMANCE.hcbs3c.sourceSha256);
    expect(CONFORMANCE.hcbs3a).toEqual({
      file: "4.00appendix3da3aform.xlsx", sha256: sha("4.00appendix3da3aform.xlsx"), sourceSha256: a.meta.sourceSha256,
      edition: a.meta.edition, workbooks: a.meta.caseCounts.workbooks, taskRows: a.meta.caseCounts.taskRows, libreOffice: a.meta.soffice,
    });
  });

  it("has 12 sample rows, including the ones the prompt names and the 641/642 boundary", () => {
    const tasks = CONFORMANCE.samples.filter((s) => s.kind === "task").map((s) => `${s.minPerDay}×${s.daysPerWeek}`);
    expect(CONFORMANCE.samples).toHaveLength(12);
    expect(tasks).toEqual(expect.arrayContaining(["309×5", "61×7", "45×3", "1×1", "1440×7"]));
    expect(CONFORMANCE.samples.filter((s) => s.kind === "total").map((s) => s.recorded)).toEqual([641, 642]);
  });

  it("records what DSDS's workbook gave for each sample, and the engine gives the same now", () => {
    const bathing = findTaskByName(MO_2026_07, "Bathing")!.taskCode;
    for (const sample of CONFORMANCE.samples) {
      const workbook = c.workbooks.find((w) => w.tab === sample.tab && (sample.kind === "task"
        ? Object.values(w.inputs.rows).some(([min, days]) => min === sample.minPerDay && days === sample.daysPerWeek)
        : w.totalUnits === sample.recorded && w.inputs.transportMinutes === sample.transportMinutes))!;
      const row = Object.keys(workbook.inputs.rows).find((key) => workbook.inputs.rows[key]![0] === sample.minPerDay && workbook.inputs.rows[key]![1] === sample.daysPerWeek)!;
      expect(sample.recorded).toBe(sample.kind === "task" ? workbook.units[row] : workbook.totalUnits);
      const result = calculate3c({ tab: sample.tab, rows: [{ taskCode: bathing, minPerDay: sample.minPerDay, daysPerWeek: sample.daysPerWeek }], transportMinutesPerMonth: sample.transportMinutes }, MO_2026_07);
      expect(sample.kind === "task" ? result.rows[0]!.totalUnits : result.totalUnits).toBe(sample.recorded);
    }
  });
});
