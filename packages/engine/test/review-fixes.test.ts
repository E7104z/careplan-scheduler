import { describe, expect, it } from "vitest";
import {
  MO_2026_07,
  derivedServiceMonthUnits,
  factorFor,
  hcbs3cTaskUnits,
  hcbs3cTaskUnitsFromWeekly,
  ruleAUTH03DerivedTaskUnits,
  ruleAUTH06MigratedPlan,
  ruleCON02DifferentServiceOverlap,
  ruleCON03RespiteOverlap,
  ruleCON06AttendantRelationship,
  ruleCON07AgencyAide,
  ruleCON17QualificationData,
  ruleSCH08CalendarCheck,
  ruleSCH14VisitDates,
  validateSchedule,
  type AuthorizedTask,
  type Caregiver,
  type MonthlyAuthorization,
  type ScheduleTemplate,
  type ServiceAuthorization,
  type TemplateEntry,
  type ValidateScheduleInput,
  type ValidationResult,
  type Visit,
  type Weekday,
} from "../src/index.js";

type Dpw = AuthorizedTask["daysPerWeek"];

function task(id: string, serviceAuthId: string, minPerDay: number, daysPerWeek: Dpw): AuthorizedTask {
  return { id, serviceAuthId, taskCode: id.toUpperCase(), name: id, minPerDay, daysPerWeek };
}

/** Authorization for P-1 covering November 2026 unless overridden. */
function auth(
  fields: Pick<ServiceAuthorization, "id" | "program" | "serviceCode"> & Partial<ServiceAuthorization>,
): ServiceAuthorization {
  return {
    participantId: "P-1",
    start: "2026-11-01",
    end: "2026-11-30",
    state: "active",
    suspensions: [],
    revision: 1,
    tasks: [],
    ...fields,
  };
}

function fusion(serviceAuthId: string, month: string, units: number): MonthlyAuthorization {
  return { serviceAuthId, month, units, source: "fusion", revision: 1 };
}

/** `minutes` of `taskId` on all seven weekdays. */
function everyDay(taskId: string, minutes: number): TemplateEntry[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ taskId, weekday: weekday as Weekday, minutes }));
}

function template(entries: TemplateEntry[], start = "2026-11-01", end = "2026-11-30"): ScheduleTemplate {
  return { id: "tpl-1", participantId: "P-1", start, end, entries, rulePackVersion: "mo-2026-07" };
}

function visit(id: string, fields: Pick<Visit, "serviceCode" | "start" | "end"> & Partial<Visit>): Visit {
  return { id, participantId: "P-1", caregiverId: "C-1", taskIds: [], ...fields };
}

/** One visit a day, Sunday 2026-11-01 to Saturday 2026-11-07, `from`–`to` local time. */
function weekOfVisits(
  participantId: string,
  serviceCode: Visit["serviceCode"],
  from: string,
  to: string,
): Visit[] {
  return [1, 2, 3, 4, 5, 6, 7].map((day) => {
    const date = `2026-11-0${day}`;
    return visit(`${participantId}-${serviceCode}-${day}`, {
      participantId,
      serviceCode,
      start: `${date}T${from}`,
      end: `${date}T${to}`,
    });
  });
}

function validate(fields: Partial<ValidateScheduleInput>): ValidationResult[] {
  return validateSchedule({
    pack: MO_2026_07,
    authorizations: [],
    monthlyAuthorizations: [],
    template: template([]),
    exceptions: [],
    visits: [],
    caregivers: [],
    enrollments: [],
    months: ["2026-11"],
    tenantWorkweekStart: 0,
    ...fields,
  });
}

function byRule(results: ValidationResult[], ruleId: string): ValidationResult[] {
  return results.filter((r) => r.ruleId === ruleId);
}

describe("FIX-1 SCH-08 checks the imported Fusion authorization", () => {
  const pc = auth({
    id: "A-PC", program: "AGENCY_PC", serviceCode: "T1019",
    tasks: [task("pc-dietary", "A-PC", 30, 7)],
  });
  const dietary = template(everyDay("pc-dietary", 30)); // 900 min in November 2026

  it("900 min against Fusion 40 units (600 min) → one WARN naming Fusion", () => {
    const results = ruleSCH08CalendarCheck([pc], [fusion("A-PC", "2026-11", 40)], dietary, [], ["2026-11"]);
    expect(results).toHaveLength(1);
    expect(results[0]!.severity).toBe("WARN");
    expect(results[0]!.message).toBe("Scheduled 900 min exceeds Fusion authorization 600 min in 2026-11");
  });

  it("900 min against Fusion 60 units (900 min) → no SCH-08 result", () => {
    expect(ruleSCH08CalendarCheck([pc], [fusion("A-PC", "2026-11", 60)], dietary, [], ["2026-11"])).toEqual([]);
  });

  it("CDS with 450 transport min: budget (90 − 30) × 15 = 900 → no SCH-08 result", () => {
    const cds = auth({
      id: "A-CDS", program: "CDS", serviceCode: "T1019U2", transportMinutesPerMonth: 450,
      tasks: [task("cds-bathing", "A-CDS", 30, 7)],
    });
    const bathing = template(everyDay("cds-bathing", 30));
    expect(ruleSCH08CalendarCheck([cds], [fusion("A-CDS", "2026-11", 90)], bathing, [], ["2026-11"])).toEqual([]);
  });

  it("validateSchedule warns 900 min against Fusion 40 units", () => {
    const results = byRule(
      validate({ authorizations: [pc], monthlyAuthorizations: [fusion("A-PC", "2026-11", 40)], template: dietary }),
      "SCH-08",
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.severity).toBe("WARN");
    expect(results[0]!.message).toContain("Fusion");
  });
});

describe("FIX-2 eligibility rules check only caregivers assigned to the service", () => {
  const cds = auth({ id: "A-CDS", program: "CDS", serviceCode: "T1019U2" });
  const pc = auth({ id: "A-PC", program: "AGENCY_PC", serviceCode: "T1019" });
  const visits = [
    visit("v-1", { caregiverId: "C-1", serviceCode: "T1019U2", start: "2026-11-02T08:00", end: "2026-11-02T08:30" }),
    visit("v-2", { caregiverId: "C-2", serviceCode: "T1019", start: "2026-11-02T12:00", end: "2026-11-02T12:30" }),
  ];
  const child: Caregiver = { id: "C-1", relationships: { "P-1": "child" }, agencyEmployee: false };
  const aide: Caregiver = { id: "C-2", relationships: { "P-1": "none" }, agencyEmployee: true };

  it("child as CDS attendant plus unrelated agency aide → no CON-06, CON-07 or CON-17", () => {
    expect(ruleCON06AttendantRelationship([cds, pc], [child, aide], visits)).toEqual([]);
    expect(ruleCON07AgencyAide([cds, pc], [child, aide], visits)).toEqual([]);
    expect(ruleCON17QualificationData([cds, pc], [child, aide], visits)).toEqual([]);
  });

  it("agency aide who is a grandchild → exactly one CON-07 BLOCK on A-PC", () => {
    const grandchild: Caregiver = { ...aide, relationships: { "P-1": "grandchild" } };
    const results = ruleCON07AgencyAide([cds, pc], [child, grandchild], visits);
    expect(results).toHaveLength(1);
    expect(results[0]!.severity).toBe("BLOCK");
    expect(results[0]!.refs.serviceAuthId).toBe("A-PC");
  });
});

describe("FIX-3 derived monthly units include transport", () => {
  const cds = auth({
    id: "A-CDS", program: "CDS", serviceCode: "T1019U2", transportMinutesPerMonth: 450,
    tasks: [task("cds-bathing", "A-CDS", 30, 7)],
  });

  it("derivedServiceMonthUnits = 60 task + 30 transport = 90 in November 2026", () => {
    expect(derivedServiceMonthUnits(cds, 2026, 11)).toBe(90);
  });

  it("Fusion 90 → no AUTH-07; Fusion 92 → one AUTH-07 REVIEW", () => {
    const agree = validate({ authorizations: [cds], monthlyAuthorizations: [fusion("A-CDS", "2026-11", 90)] });
    expect(byRule(agree, "AUTH-07")).toEqual([]);
    const differ = byRule(
      validate({ authorizations: [cds], monthlyAuthorizations: [fusion("A-CDS", "2026-11", 92)] }),
      "AUTH-07",
    );
    expect(differ).toHaveLength(1);
    expect(differ[0]!.severity).toBe("REVIEW");
  });
});

describe("FIX-4 49-hour checks run per participant and per limit group", () => {
  it("P-1 and P-2 at 28 h of ILW each → one REVIEW each (E-02), no BLOCK", () => {
    const visits = [
      ...weekOfVisits("P-1", "T1019U6", "08:00", "12:00"),
      ...weekOfVisits("P-2", "T1019U6", "08:00", "12:00"),
    ];
    const results = byRule(validate({ visits }), "CON-09");
    expect(results.map((r) => [r.severity, r.refs.participantId])).toEqual([
      ["REVIEW", "P-1"],
      ["REVIEW", "P-2"],
    ]);
    expect(results[0]!.message).toContain("28 h");
  });

  it("P-1 at 52.5 h of ILW in one Sunday-Saturday week → one REVIEW for P-1 with both figures", () => {
    const results = byRule(validate({ visits: weekOfVisits("P-1", "T1019U6", "08:00", "15:30") }), "CON-09");
    expect(results).toHaveLength(1);
    expect(results[0]!.severity).toBe("REVIEW");
    expect(results[0]!.refs.participantId).toBe("P-1");
    expect(results[0]!.message).toBe(
      "P-1 ILW: Highest Sunday-Saturday week 52 h 30 min (week of 2026-11-01); highest 7-day stretch 52 h 30 min (2026-11-01 to 2026-11-07)",
    );
  });

  it("P-1 Respite Basic 28 h + Advanced 28 h combine → one REVIEW naming RESPITE at 56 h", () => {
    const visits = [
      ...weekOfVisits("P-1", "S5150", "08:00", "12:00"),
      ...weekOfVisits("P-1", "S5150TF", "13:00", "17:00"),
    ];
    const results = byRule(validate({ visits }), "CON-09");
    expect(results).toHaveLength(1);
    expect(results[0]!.severity).toBe("REVIEW");
    expect(results[0]!.message).toContain("P-1 RESPITE: ");
    expect(results[0]!.message).toContain("56 h");
  });
});

describe("FIX-5 HCBS-3c rounding uses integer math", () => {
  it("hcbs3cTaskUnits(31, 3) = 31", () => {
    expect(hcbs3cTaskUnits(31, 3).units).toBe(31);
  });

  it("every m in 1..600 and dpw in 1..7 rounds up to the smallest covering unit", () => {
    const failures: string[] = [];
    for (let m = 1; m <= 600; m++) {
      for (let d = 1; d <= 7; d++) {
        const dpw = d as Dpw;
        const u = hcbs3cTaskUnits(m, dpw).units;
        const needed = m * factorFor(dpw);
        if (!(u * 15 >= needed && (u - 1) * 15 < needed)) failures.push(`m=${m} dpw=${dpw} u=${u}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("non-integer minutes throw RangeError", () => {
    expect(() => hcbs3cTaskUnits(61 / 7, 7)).toThrow(RangeError);
    expect(() => hcbs3cTaskUnitsFromWeekly(60.5, 7)).toThrow(RangeError);
  });
});

describe("FIX-6 smaller corrections", () => {
  it("6a AUTH-03: TC-01 tasks → no result; 61 weekly minutes 7×/wk → one REVIEW", () => {
    const tc01 = [
      task("bathing", "A-CDS", 30, 3),
      task("toileting", "A-CDS", 15, 7),
      task("meals", "A-CDS", 45, 7),
      task("laundry", "A-CDS", 30, 2),
      task("kitchen", "A-CDS", 10, 2),
    ];
    expect(ruleAUTH03DerivedTaskUnits(tc01)).toEqual([]);
    const results = ruleAUTH03DerivedTaskUnits([task("odd", "A-CDS", 9, 7)], { odd: 61 });
    expect(results).toHaveLength(1);
    expect(results[0]!.severity).toBe("REVIEW");
  });

  it("6b AUTH-06: WARN only for the authorization flagged migratedFromWebTool", () => {
    const migrated = auth({ id: "A-MIG", program: "CDS", serviceCode: "T1019U2", migratedFromWebTool: true });
    const other = auth({ id: "A-PC", program: "AGENCY_PC", serviceCode: "T1019" });
    const results = ruleAUTH06MigratedPlan([migrated, other]);
    expect(results).toHaveLength(1);
    expect(results[0]!.severity).toBe("WARN");
    expect(results[0]!.refs.serviceAuthId).toBe("A-MIG");
  });

  const rev1 = auth({
    id: "A-ILW", program: "ILW", serviceCode: "T1019U6", revision: 1,
    start: "2026-10-01", end: "2026-10-31",
  });
  const rev2 = auth({
    id: "A-ILW", program: "ILW", serviceCode: "T1019U6", revision: 2,
    start: "2026-11-01", end: "2026-11-30", suspensions: [{ start: "2026-11-05", end: "2026-11-06" }],
  });
  const ilwVisit = (date: string) => visit(`v-${date}`, { serviceCode: "T1019U6", start: `${date}T09:00`, end: `${date}T10:00` });

  it("6c SCH-14: visits on 10-15 (rev 1) and 11-10 (rev 2) → no result", () => {
    expect(ruleSCH14VisitDates([ilwVisit("2026-10-15"), ilwVisit("2026-11-10")], [rev1, rev2])).toEqual([]);
  });

  it("6c SCH-14: visit on 11-05 during the rev 2 suspension → one BLOCK", () => {
    const results = ruleSCH14VisitDates([ilwVisit("2026-11-05")], [rev1, rev2]);
    expect(results).toHaveLength(1);
    expect(results[0]!.severity).toBe("BLOCK");
  });

  it("6c SCH-14: visit on 12-01 after both versions → one BLOCK \"No authorization covers\"", () => {
    const results = ruleSCH14VisitDates([ilwVisit("2026-12-01")], [rev1, rev2]);
    expect(results).toHaveLength(1);
    expect(results[0]!.severity).toBe("BLOCK");
    expect(results[0]!.message).toContain("No authorization covers 2026-12-01");
  });

  it("6d AUTH-11: an AGENCY_PC task leaves the TC-10 switch on day 18 (24 SP + 4 ILW)", () => {
    // TC-10: 420 min/day of State Plan tasks, 31-day month, imported State Plan 500 and ILW 368.
    const december = { start: "2026-12-01", end: "2026-12-31" };
    const cds = auth({
      id: "A-CDS", program: "CDS", serviceCode: "T1019U2", ...december,
      tasks: [task("cds-care", "A-CDS", 420, 7)],
    });
    const ilw = auth({ id: "A-ILW", program: "ILW", serviceCode: "T1019U6", ...december });
    const pc = auth({
      id: "A-PC", program: "AGENCY_PC", serviceCode: "T1019", ...december,
      tasks: [task("pc-dietary", "A-PC", 60, 7)],
    });
    const results = byRule(
      validate({
        authorizations: [cds, ilw, pc],
        monthlyAuthorizations: [fusion("A-CDS", "2026-12", 500), fusion("A-ILW", "2026-12", 368)],
        template: template([...everyDay("cds-care", 420), ...everyDay("pc-dietary", 60)], december.start, december.end),
        months: ["2026-12"],
      }),
      "AUTH-11",
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.message).toContain("day 18 = 24 State Plan + 4 ILW");
  });

  it("6e CON-02 leaves respite overlaps to CON-03 (TC-07 reported once)", () => {
    const respite = visit("v-1", { serviceCode: "S5150", start: "2026-10-05T13:00", end: "2026-10-05T17:00" });
    const cds = visit("v-2", { serviceCode: "T1019U2", start: "2026-10-05T14:00", end: "2026-10-05T15:00" });
    expect(ruleCON02DifferentServiceOverlap([respite, cds], MO_2026_07)).toEqual([]);
    const con03 = ruleCON03RespiteOverlap([respite, cds]);
    expect(con03).toHaveLength(1);
    expect(con03[0]!.severity).toBe("BLOCK");
  });
});
