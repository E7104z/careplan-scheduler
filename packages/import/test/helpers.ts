import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MO_2026_07 } from "@careplan/engine";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api.js";
import type { ImportedService, ImportedTask, ImportedVisit, PdfTextItem } from "../src/index.js";

export const PACK = MO_2026_07;

const FIXTURES = fileURLToPath(new URL("../../../docs/fixtures/fusion/", import.meta.url));

export function fixtureText(name: string): string {
  return readFileSync(`${FIXTURES}${name}`, "utf8");
}

/** A task as the tests state it: rule-pack name, minutes per day, days per week. */
export type TaskTuple = [name: string, minPerDay: number, daysPerWeek: number];

export function tupleOf(tasks: ImportedTask[]): TaskTuple[] {
  return tasks.map((task) => [task.name, task.minPerDay, task.daysPerWeek]);
}

/** A service without SOURCE-01 provenance: no service/task source and no task raw text. */
export type ContentService = Omit<ImportedService, "source" | "tasks"> & {
  tasks: Omit<ImportedTask, "source" | "raw">[];
};

/** Services minus SOURCE-01 provenance (source/raw), for comparing parsed content across pages. */
export function contentServices(services: ImportedService[]): ContentService[] {
  return services.map(({ source: _source, tasks, ...rest }) => ({
    ...rest,
    tasks: tasks.map(({ source: _taskSource, raw: _raw, ...task }) => task),
  }));
}

/** Visits minus SOURCE-01 provenance (source), for comparing parsed content across pages. */
export function contentVisits(visits: ImportedVisit[]): Omit<ImportedVisit, "source">[] {
  return visits.map(({ source: _source, ...rest }) => rest);
}

function toPdfItem(item: TextItem): PdfTextItem {
  const [, , , d = 0, x = 0, y = 0] = item.transform;
  return { str: item.str, x, y, width: item.width, height: Math.abs(d) };
}

/** Read a fixture PDF with pdf.js (no eval) into the text items of each page. */
export async function pdfPages(name: string): Promise<PdfTextItem[][]> {
  const data = new Uint8Array(readFileSync(`${FIXTURES}${name}`));
  const doc = await getDocument({ data, isEvalSupported: false, verbosity: 0 }).promise;
  try {
    const pages: PdfTextItem[][] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const content = await (await doc.getPage(pageNumber)).getTextContent();
      pages.push(content.items.flatMap((item) => ("str" in item ? [toPdfItem(item)] : [])));
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

// What the fixtures hold, written out by hand from the files in docs/fixtures/fusion/.

export const A_TASKS: TaskTuple[] = [
  ["Bathing", 45, 5], ["Change Linens", 10, 1], ["Clean Bath", 45, 1], ["Clean Floors", 30, 1],
  ["Clean Kitchen", 45, 1], ["Clean/Maintain Equipment", 10, 5], ["Essential Correspondence", 30, 5],
  ["Laundry (Home)", 90, 2], ["Make Bed", 5, 5], ["Meal Prep/Eating", 60, 5], ["Medications", 15, 5],
  ["Mobility/Transfer", 10, 5], ["Tidy and Dust", 15, 1], ["Trash", 5, 3], ["Wash Dishes", 20, 5],
];

export const B_TASKS: TaskTuple[] = [
  ["Assistance with Toileting", 10, 7], ["Bathing", 45, 7], ["Change Linens", 10, 7], ["Clean Bath", 20, 1],
  ["Clean Floors", 20, 1], ["Clean Kitchen", 20, 1], ["Dressing/Grooming", 15, 7],
  ["Essential Correspondence", 30, 1], ["Laundry (Off Site)", 140, 1], ["Meal Prep/Eating", 60, 7],
  ["Medications", 5, 7], ["Mobility/Transfer", 10, 7], ["Tidy and Dust", 10, 1], ["Trash", 5, 7],
  ["Wash Dishes", 15, 7],
];

export const C_TASKS: TaskTuple[] = [
  ["Bathing", 15, 7], ["Change Linens", 10, 2], ["Clean Bath", 15, 2], ["Clean Floors", 15, 2],
  ["Clean/Maintain Equipment", 15, 7], ["Essential Correspondence", 10, 3], ["Laundry (Home)", 60, 2],
  ["Make Bed", 5, 5], ["Meal Prep/Eating", 60, 7], ["Medications", 5, 7], ["Mobility/Transfer", 10, 7],
  ["Tidy and Dust", 10, 1], ["Trash", 5, 1], ["Wash Dishes", 30, 7],
];

// Fixture E, Fusion's care plan report: "Med Rel HC Tasks:" dropped and the report's short names
// read as the rule pack's (Laundry, Shopping/Errands, Self-Admin of Medications).
export const E_TASKS: TaskTuple[] = [
  ["Bathing", 45, 3], ["Dietary", 45, 3], ["Dressing/Grooming", 15, 3], ["Laundry", 60, 1],
  ["Make Bed/Change Linens", 10, 3], ["Shopping/Errands", 90, 1], ["Trash", 5, 3],
  ["Mobility/Transfer/Position", 15, 3], ["Toileting", 15, 3], ["Clean Bath", 20, 1], ["Clean Kitchen", 20, 1],
  ["Self-Admin of Medications", 5, 3], ["Clean Living Area", 30, 1],
];

export const FIXTURE_NAMES = [
  "A-run-together-5day-466.txt",
  "B-page1-of-2.txt",
  "B-page2-of-2.txt",
  "B-tabbed-7day-455.txt",
  "C-rows-only-older-plan-402.txt",
  "D-page1-only-incomplete.txt",
  "E-care-plan-report-229.txt",
];
