import { describe, expect, it } from "vitest";
import { parseFusionText } from "../src/index.js";
import { A_TASKS, B_TASKS, PACK, fixtureText, tupleOf } from "./helpers.js";

const A = fixtureText("A-run-together-5day-466.txt");
const B = fixtureText("B-tabbed-7day-455.txt");

const codes = (text: string) => parseFusionText(text, PACK).issues.map((issue) => issue.code);

describe("IMP-T07 the same table in other clipboard shapes", () => {
  it("A with Windows line breaks and no-break spaces gives the same result as A", () => {
    const plain = parseFusionText(A, PACK);
    const noBreak = parseFusionText(A.replace(/\r?\n/g, "\r\n").replace(/ /g, " "), PACK);
    expect(noBreak).toEqual(plain);
    expect(tupleOf(noBreak.services[0]!.tasks)).toEqual(A_TASKS);
    expect(noBreak.services[0]!.transport).toEqual({ unitsPerMonth: 51, minutesPerMonth: 765 });
  });

  it("A with old Mac line breaks (\\r) gives the same result as A", () => {
    expect(parseFusionText(A.replace(/\r?\n/g, "\r"), PACK)).toEqual(parseFusionText(A, PACK));
  });

  it("A with figure spaces, narrow no-break spaces and Unicode dashes in the dates", () => {
    const messy = A.replace(/ - /g, " – ").replace(/(\d{4}) /g, "$1 ").replace(/PA: /, "PA: ");
    const result = parseFusionText(messy, PACK);
    expect(result.plan).toEqual({ start: "2025-08-01", end: "2026-06-30" });
    expect(result.services[0]!.pa).toBe("20250000000001");
    expect(tupleOf(result.services[0]!.tasks)).toEqual(A_TASKS);
    expect(result.issues).toEqual([]);
  });

  it("B with tabs turned into 2 spaces gives the same tasks and transportation as B", () => {
    const result = parseFusionText(B.replace(/\t/g, "  "), PACK);
    expect(tupleOf(result.services[0]!.tasks)).toEqual(B_TASKS);
    expect(result.services[0]!.transport).toEqual({ unitsPerMonth: 23, minutesPerMonth: 345 });
    expect(result.issues).toEqual([]);
  });

  it("B with tabs turned into ' | ' gives the same tasks and transportation as B", () => {
    const result = parseFusionText(B.replace(/\t/g, " | "), PACK);
    expect(tupleOf(result.services[0]!.tasks)).toEqual(B_TASKS);
    expect(result.services[0]!.transport).toEqual({ unitsPerMonth: 23, minutesPerMonth: 345 });
    expect(result.issues).toEqual([]);
  });
});

describe("IMP-T08 single spaces between cells", () => {
  const text = [
    "455 units Bathing 45 7",
    "455 units Medications 5 7",
    "455 units Essential Transportation 23 345",
  ].join("\n");
  const result = parseFusionText(text, PACK);

  it("reads 2 tasks and the transportation minutes", () => {
    expect(tupleOf(result.services[0]!.tasks)).toEqual([["Bathing", 45, 7], ["Medications", 5, 7]]);
    expect(result.services[0]!.transport).toEqual({ unitsPerMonth: 23, minutesPerMonth: 345 });
  });

  it("asks only for the plan dates, which rows alone don't give (IMP-13)", () => {
    expect(result.plan).toBeNull();
    expect(result.issues).toEqual([
      { level: "input", code: "no-plan-dates", message: "The plan dates weren't included. Enter them from Fusion." },
    ]);
  });
});

describe("IMP-T09 a row we can't read does not stop the others", () => {
  const result = parseFusionText("300 units Bathing458 300 units Trash53", PACK);

  it("reads Trash as 5 minutes, 3 days a week", () => {
    expect(tupleOf(result.services[0]!.tasks)).toEqual([["Trash", 5, 3]]);
  });

  it("lists the Bathing row as unread (days per week 8), with its raw text", () => {
    expect(result.services[0]!.unread).toEqual([{ raw: "Bathing458", reason: "task-numbers" }]);
    expect(result.issues).toContainEqual({
      level: "error", code: "unread-row", raw: "Bathing458", message: "We couldn't read this row: Bathing458",
    });
  });
});

describe("IMP-T10 a task that isn't in the rule pack", () => {
  const result = parseFusionText("300 units\tPet Care\t15\t7", PACK);

  it("keeps the Fusion name with no task code and still schedules it", () => {
    expect(result.services[0]!.tasks).toMatchObject([
      { name: "Pet Care", fusionName: "Pet Care", taskCode: null, minPerDay: 15, daysPerWeek: 7 },
    ]);
  });

  it("warns, naming the task", () => {
    expect(result.issues).toContainEqual({
      level: "warn", code: "unknown-task", name: "Pet Care",
      message: "\"Pet Care\" isn't in our Missouri task list. We'll still schedule it.",
    });
  });
});

describe("IMP-T11 minutes that aren't a 5-minute step", () => {
  it("warns, and still reads the row", () => {
    const result = parseFusionText("300 units\tBathing\t17\t5", PACK);
    expect(tupleOf(result.services[0]!.tasks)).toEqual([["Bathing", 17, 5]]);
    expect(result.issues).toContainEqual({
      level: "warn", code: "odd-minutes", name: "Bathing",
      message: "Bathing has 17 minutes a day, which isn't a 5-minute step. Check it against Fusion.",
    });
  });
});

describe("IMP-T12 text with no care plan rows", () => {
  const cases: Record<string, string> = {
    "an empty paste": "",
    "only line breaks": "\n\n\r\n",
    "ordinary text": "Hello, this is not a care plan.",
    "a banner and no rows": "SAMPLE PARTICIPANT E (DCN: 10000005) Care Plan: 01/01/2026 - 12/31/2026",
    "a group row and no rows":
      "PC - CDS | TEST HOME CARE LLC | 5555550100 | 01/01/2026 - 12/31/2026 | 455 units | PA: 20250000000005",
  };

  for (const [what, text] of Object.entries(cases)) {
    it(`finds no rows in ${what}`, () => {
      const result = parseFusionText(text, PACK);
      expect(result.issues).toEqual([
        { level: "error", code: "no-rows", message: "We couldn't find care plan tasks in this text." },
      ]);
      expect(result.services.flatMap((service) => service.tasks)).toEqual([]);
    });
  }
});

describe("IMP-T13 a service label we haven't seen", () => {
  const text = [
    "XX - ABC | TEST HOME CARE LLC | 5555550100 | 01/01/2026 - 12/31/2026 | 100 units | PA: 20250000000006",
    "100 units\tBathing\t30\t7",
  ].join("\n");
  const result = parseFusionText(text, PACK);

  it("leaves the service code empty and asks which service it is", () => {
    expect(result.services[0]).toMatchObject({ label: "XX - ABC", serviceCode: null, units: 100 });
    expect(result.issues).toEqual([
      {
        level: "input", code: "unknown-service", label: "XX - ABC",
        message: "We don't know which service \"XX - ABC\" is yet.",
      },
    ]);
  });

  it("still takes the plan dates from the group row when there is no banner (IMP-13)", () => {
    expect(result.plan).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});

describe("IMP-03 / IMP-13 plan dates and paging", () => {
  it("asks for the plan dates when neither the banner nor a group row has them", () => {
    expect(codes("300 units\tBathing\t30\t7")).toEqual(["no-plan-dates"]);
  });

  it("rejects plan dates that aren't a real date, or that end before they start", () => {
    const banner = (dates: string) => `SAMPLE PARTICIPANT E (DCN: 10000005) Care Plan: ${dates}\n300 units\tBathing\t30\t7`;
    expect(codes(banner("02/30/2026 - 12/31/2026"))).toEqual(["bad-dates"]);
    expect(codes(banner("13/01/2026 - 12/31/2026"))).toEqual(["bad-dates"]);
    expect(codes(banner("12/31/2026 - 01/01/2026"))).toEqual(["bad-dates"]);
    expect(codes(banner("02/29/2028 - 12/31/2028"))).toEqual([]);
  });

  it("takes the largest 'of n entries' as the plan's row count", () => {
    const text = "300 units\tBathing\t30\t7\nShowing 1 to 1 of 3 entries\nShowing 1 to 1 of 5 entries";
    expect(parseFusionText(text, PACK).issues).toContainEqual(
      expect.objectContaining({ code: "incomplete", have: 1, total: 5 }),
    );
  });
});

describe("IMP-02 banner", () => {
  const read = (banner: string) => parseFusionText(`${banner}\n300 units\tBathing\t30\t7`, PACK);

  it("reads a banner with no total cost", () => {
    const result = read("SAMPLE PARTICIPANT F (DCN: 123456) Care Plan: 1/5/2026 - 12/31/2026");
    expect(result.participant).toEqual({ name: "SAMPLE PARTICIPANT F", dcn: "123456" });
    expect(result.plan).toEqual({ start: "2026-01-05", end: "2026-12-31" });
    expect(result.totalCost).toBeNull();
  });

  it("reads a total cost with a thousands comma", () => {
    expect(read("X Y (DCN: 123456789012) Care Plan: 01/01/2026 - 12/31/2026 Total Cost: $1,234.56").totalCost).toBe("1234.56");
  });

  it("does not take a DCN of fewer than 6 digits as a banner", () => {
    const result = read("X Y (DCN: 12345) Care Plan: 01/01/2026 - 12/31/2026");
    expect(result.participant).toBeNull();
    expect(result.plan).toBeNull();
  });
});

describe("IMP-04 / IMP-05 group rows and the end of the table", () => {
  it("reads a group row with no phone, cost or PA number", () => {
    const text = "PC - CDS | HOME CARE | 01/01/2026 - 12/31/2026 | 300 units\n300 units\tBathing\t30\t7";
    expect(parseFusionText(text, PACK).services[0]).toMatchObject({
      label: "PC - CDS", provider: "HOME CARE", phone: null, cost: null, pa: null, units: 300,
    });
  });

  it("reads units of 1 to 4 digits, in the group row and in the rows", () => {
    for (const units of [7, 85, 868, 1234]) {
      const text = `PC - CDS | HOME CARE | 01/01/2026 - 12/31/2026 | ${units} units\n${units} units\tBathing\t30\t7`;
      const service = parseFusionText(text, PACK).services[0]!;
      // The label proves the group row itself was read, not just the rows.
      expect(service).toMatchObject({ label: "PC - CDS", provider: "HOME CARE", units });
      expect(tupleOf(service.tasks)).toEqual([["Bathing", 30, 7]]);
    }
  });

  it("gives each service its own rows when a paste holds two group rows", () => {
    const text = [
      "PC - CDS | HOME CARE | 01/01/2026 - 12/31/2026 | 300 units | PA: 1",
      "300 units\tBathing\t30\t7",
      "XX - ABC | HOME CARE | 01/01/2026 - 12/31/2026 | 200 units | PA: 2",
      "200 units\tTrash\t5\t7",
    ].join("\n");
    const { services } = parseFusionText(text, PACK);
    expect(services.map((service) => [service.label, service.units, tupleOf(service.tasks)])).toEqual([
      ["PC - CDS", 300, [["Bathing", 30, 7]]],
      ["XX - ABC", 200, [["Trash", 5, 7]]],
    ]);
  });

  it("reads a group row whose cells are separated by tabs or 2+ spaces (Fusion screen PDF)", () => {
    for (const sep of ["\t", "  "]) {
      const text = [
        `PC - CDS${sep}TEST HOME CARE LLC${sep}5555550100${sep}04/01/2026 - 01/31/2027${sep}95 units${sep}$1,234.56${sep}PA: 20260000000000`,
        `95 units${sep}Change Linens${sep}10${sep}2`,
      ].join("\n");
      const result = parseFusionText(text, PACK);
      expect(result.services[0]).toMatchObject({
        label: "PC - CDS",
        provider: "TEST HOME CARE LLC",
        phone: "5555550100",
        start: "2026-04-01",
        end: "2027-01-31",
        units: 95,
        cost: "1234.56",
        pa: "20260000000000",
      });
      expect(tupleOf(result.services[0]!.tasks)).toEqual([["Change Linens", 10, 2]]);
      expect(result.services[0]!.unread).toEqual([]);
      expect(result.issues).toEqual([]);
    }
  });

  it("cuts the last row at the text that follows the table", () => {
    const tails = ["Showing 1 to 1 of 1 entries", "Previous", "Next", "Search:", "Export ...", "Total Units Task Type"];
    // In the single-space and run-together shapes, tail text left on the row makes it unreadable.
    for (const tail of tails) {
      for (const row of ["Bathing 30 7", "Bathing307"]) {
        const service = parseFusionText(`300 units ${row}\n${tail}\n1\n2`, PACK).services[0]!;
        expect(service.unread, `${row} then "${tail}"`).toEqual([]);
        expect(tupleOf(service.tasks), `${row} then "${tail}"`).toEqual([["Bathing", 30, 7]]);
      }
    }
  });
});

describe("IMP-07 / IMP-08 numbers in a row", () => {
  it("rejects minutes of 0 or more than 1440, and days outside 1 to 7", () => {
    const reasons = ["Bathing\t0\t7", "Bathing\t1441\t7", "Bathing\t30\t0", "Bathing\t30\t8", "Bathing\t30"].map(
      (row) => parseFusionText(`300 units\t${row}`, PACK).services[0]!.unread.map((u) => u.reason),
    );
    expect(reasons).toEqual([["task-numbers"], ["task-numbers"], ["task-numbers"], ["task-numbers"], ["task-numbers"]]);
  });

  it("accepts the limits: 1 minute, 1440 minutes, 1 day, 7 days", () => {
    const tasks = parseFusionText("300 units\tBathing\t1\t1\n300 units\tTrash\t1440\t7", PACK).services[0]!.tasks;
    expect(tupleOf(tasks)).toEqual([["Bathing", 1, 1], ["Trash", 1440, 7]]);
  });

  it("finds the transportation pair in either order of the cells", () => {
    const read = (row: string) => parseFusionText(`300 units\t${row}`, PACK).services[0]!.transport;
    expect(read("Essential Transportation\t23\t345")).toEqual({ unitsPerMonth: 23, minutesPerMonth: 345 });
    expect(read("Essential Transportation\t345\t23")).toEqual({ unitsPerMonth: 23, minutesPerMonth: 345 });
    expect(read("Essential Transportation23345")).toEqual({ unitsPerMonth: 23, minutesPerMonth: 345 });
  });

  it("lists transportation whose numbers don't fit as unread", () => {
    const service = parseFusionText("300 units\tEssential Transportation\t24\t345", PACK).services[0]!;
    expect(service.transport).toBeNull();
    expect(service.unread).toEqual([
      { raw: "Essential Transportation\t24\t345", reason: "transport-numbers" },
    ]);
  });

  it("treats an unknown name containing 'transport' as transportation", () => {
    const service = parseFusionText("300 units\tMedical Transport\t2\t30", PACK).services[0]!;
    expect(service.transport).toEqual({ unitsPerMonth: 2, minutesPerMonth: 30 });
  });

  it("lists a row whose name has digits in its cells as unreadable", () => {
    const service = parseFusionText("300 units\tBath2ing\t30\t7", PACK).services[0]!;
    expect(service.unread).toEqual([{ raw: "Bath2ing\t30\t7", reason: "unreadable" }]);
  });
});

describe("the reader never throws", () => {
  const odd = ["", " ", "units", "466 units", "|||", "PC - CDS |", "(DCN: 1)", "\t\t\t", "9999999 units9", "Showing 0 to 0 of 0 entries"];
  for (const text of odd) {
    it(`reads ${JSON.stringify(text)} without throwing`, () => {
      const result = parseFusionText(text, PACK);
      expect(Array.isArray(result.issues)).toBe(true);
    });
  }
});
