import { beforeAll, describe, expect, it } from "vitest";
import { mergeFusionText, parseFusionText, textItemsToLines, type PdfTextItem } from "../src/index.js";
import { E_TASKS, PACK, fixtureText, pdfPages, tupleOf } from "./helpers.js";

const E = "E-care-plan-report-229.txt";

const MONTHS = [
  ["2026-04-01", "2026-04-30"], ["2026-05-01", "2026-05-31"], ["2026-06-01", "2026-06-30"],
  ["2026-07-01", "2026-07-31"], ["2026-08-01", "2026-08-31"], ["2026-09-01", "2026-09-30"],
  ["2026-10-01", "2026-10-31"], ["2026-11-01", "2026-11-30"], ["2026-12-01", "2026-12-31"],
  ["2027-01-01", "2027-01-31"],
].map(([start, end]) => ({ start: start!, end: end!, units: 229 }));

const GHE_NOTE = {
  level: "warn",
  code: "not-scheduled",
  label: "GHE",
  message: "GHE (General Health Evaluation) is a nurse visit, so it's listed by month, not in the week.",
};

describe("IMP-T20 fixture E: Fusion's care plan report", () => {
  const result = parseFusionText(fixtureText(E), PACK);
  const [service] = result.services;

  it("reads the participant and the plan dates, and nothing else about the person", () => {
    expect(result.participant).toEqual({ name: "SAMPLE PARTICIPANT E", dcn: "10000005" });
    expect(result.plan).toEqual({ start: "2026-04-01", end: "2027-01-31" });
    expect(result.totalCost).toBeNull();
    expect(result.paging).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/1950|Sample Street|Sampletown|555-0101/);
  });

  it("reads the agency personal care service, its provider and authorization", () => {
    expect(result.services).toHaveLength(1);
    expect(service).toMatchObject({
      label: "PC - Agency",
      serviceCode: "T1019",
      provider: "TEST HOME CARE LLC",
      phone: null,
      start: "2026-04-01",
      end: "2027-01-31",
      units: 229,
      cost: null,
      pa: "20260000000005",
      transport: null,
      unread: [],
    });
  });

  it("reads the authorized units for each month", () => {
    expect(service!.monthly).toEqual(MONTHS);
  });

  it("reads 13 tasks, dropping \"Med Rel HC Tasks:\" and using the rule pack's names", () => {
    expect(tupleOf(service!.tasks)).toEqual(E_TASKS);
    expect(service!.tasks[3]).toMatchObject({
      name: "Laundry",
      fusionName: "Med Rel HC Tasks: Laundry (Home/Off Site)",
      taskCode: "LAUNDRY",
    });
    expect(service!.tasks.every((task) => task.taskCode !== null)).toBe(true);
  });

  it("leaves the General Health Evaluations out, with one note", () => {
    expect(result.issues).toEqual([GHE_NOTE]);
  });
});

describe("IMP-T21 fusion-care-plan-report.pdf", () => {
  let pages: PdfTextItem[][];
  beforeAll(async () => {
    pages = await pdfPages("fusion-care-plan-report.pdf");
  });

  it("gives the text of fixture E", () => {
    // A Windows checkout may give the fixture CRLF line ends.
    expect(textItemsToLines(pages)).toBe(fixtureText(E).replace(/\r\n/g, "\n").trimEnd());
  });

  it("reads the same as fixture E (IMP-T20)", () => {
    const fromPdf = parseFusionText(textItemsToLines(pages), PACK);
    expect(fromPdf).toEqual(parseFusionText(fixtureText(E), PACK));
    expect(tupleOf(fromPdf.services[0]!.tasks)).toEqual(E_TASKS);
  });
});

describe("IMP-T22 a report whose months differ", () => {
  const text = fixtureText(E).replace("06/30/2026\tT1019\t229", "06/30/2026\tT1019\t200");
  const [service] = parseFusionText(text, PACK).services;

  it("keeps each month's own figure", () => {
    expect(service!.monthly![2]).toEqual({ start: "2026-06-01", end: "2026-06-30", units: 200 });
    expect(service!.monthly![3]).toEqual({ start: "2026-07-01", end: "2026-07-31", units: 229 });
  });

  it("gives the most common figure as the service's units", () => {
    expect(service!.units).toBe(229);
  });
});

describe("IMP-T23 the report as plain text with single spaces", () => {
  // As a PDF viewer copies it: no tabs, one space between cells.
  const result = parseFusionText(fixtureText(E).replace(/\t/g, " "), PACK);

  it("reads the same service, months and tasks", () => {
    const [service] = result.services;
    expect(service).toMatchObject({ label: "PC - Agency", serviceCode: "T1019", units: 229, pa: "20260000000005" });
    expect(service!.monthly).toEqual(MONTHS);
    expect(tupleOf(service!.tasks)).toEqual(E_TASKS);
    expect(result.issues).toEqual([GHE_NOTE]);
  });
});

describe("IMP-T24 report rows", () => {
  const report = (rows: string[]) =>
    parseFusionText(
      [
        "Participant Information: SAMPLE PARTICIPANT E",
        "Physical Address:\tDCN: 10000005",
        "Care Plan Information 04/01/2026 - 01/31/2027",
        "PC - Agency\tN/A\tN/A\t20260000000005",
        "Start Date\tEnd Date\tProcedure Code\tAuthorized Units",
        "04/01/2026\t04/30/2026\tT1019\t60",
        "Task\t#Min/Day\t#Units/Day\t#Days/Week\t#Units/Month\tComments",
        ...rows,
      ].join("\n"),
      PACK,
    );

  it("lists a row it can't read, with its text", () => {
    const result = report(["Bathing\t30\t3\tN/A", "Toileting\tN/A"]);
    expect(tupleOf(result.services[0]!.tasks)).toEqual([["Bathing", 30, 3]]);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "unread-row", raw: "Toileting\tN/A" }));
  });

  it("asks which service an unknown label is", () => {
    const result = parseFusionText(fixtureText(E).replace("PC - Agency", "XX - Other"), PACK);
    expect(result.services[0]).toMatchObject({ label: "XX - Other", serviceCode: null });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "unknown-service", label: "XX - Other" }));
  });

  it("reads a task table that runs onto the next page", () => {
    const result = report([
      "Bathing\t30\t3\tN/A",
      "Date Generated: 10/23/2026 | Page 3 of 5",
      "SAMPLE PARTICIPANT E - DCN:10000005",
      "Task\t#Min/Day\t#Units/Day\t#Days/Week\t#Units/Month\tComments",
      "Toileting\t10\t3\tN/A",
    ]);
    expect(tupleOf(result.services[0]!.tasks)).toEqual([["Bathing", 30, 3], ["Toileting", 10, 3]]);
    expect(result.issues).toEqual([]);
  });

  it("refuses a second paste of a report for a different participant", () => {
    const other = fixtureText(E).replace(/10000005/g, "10000009");
    const merged = mergeFusionText([fixtureText(E), other], PACK);
    expect(merged.issues[0]).toMatchObject({ code: "different-participant" });
  });
});

describe("a report whose service table heading wraps differently", () => {
  // As copied from a viewer: "Start" lands on the second heading line, so the first reads
  // "Service GHE GHE Prior". The next service's rows must not be read as tasks of the one above.
  const second = [
    "Service GHE GHE Prior",
    "Start Date End Date Provider",
    "Type Date 1 2 Authorization",
    "11/01 11/30 TEST HOME CARE LLC , (555) 555-",
    "PC - CDS N/A N/A 20260000000007",
    "/2026 /2026 0100",
    "Start Date End Date Procedure Code Authorized Units",
    "11/01/2026 11/30/2026 T1019U2 40",
    "Task #Min/Day #Units/Day #Days/Week #Units/Month Comments",
    "Bathing 45 3 N/A",
  ].join("\n");
  // The first service's tasks end where page 3 ends; the wrapped service table follows them.
  const first = fixtureText(E).replace(/\t/g, " ").replace(/\r\n/g, "\n").split("Date Generated: 10/23/2026 | Page 3 of 5")[0]!;
  const text = first.trimEnd() + "\n" + second;
  const result = parseFusionText(text, PACK);

  it("keeps the service table lines out of the tasks above", () => {
    expect(result.services.map((s) => s.label)).toEqual(["PC - Agency", "PC - CDS"]);
    expect(result.services[0]!.unread).toEqual([]);
    expect(tupleOf(result.services[0]!.tasks)).toEqual(E_TASKS);
    expect(result.issues.filter((issue) => issue.code !== "not-scheduled")).toEqual([]);
  });
});
