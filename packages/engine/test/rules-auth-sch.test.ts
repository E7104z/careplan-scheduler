import { describe, expect, it } from "vitest";
import {
  ruleAUTH03DerivedTaskUnits,
  ruleAUTH07DerivedVsFusion,
  ruleAUTH09Ceiling,
  ruleAUTH11ProjectIlwSwitch,
  ruleAUTH12PendingApproval,
  ruleSCH02TemplateDays,
  ruleSCH03TemplateMinutes,
  ruleSCH08CalendarCheck,
  ruleSCH12PartialMonth,
  ruleSCH14VisitDates,
  type AuthorizedTask,
  type MonthlyAuthorization,
  type ScheduleTemplate,
  type ServiceAuthorization,
  type Visit,
} from "../src/index.js";

function task(id: string, minPerDay: number, daysPerWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7): AuthorizedTask {
  return { id, serviceAuthId: "auth-1", taskCode: id.toUpperCase(), name: id, minPerDay, daysPerWeek };
}

function auth(fields: {
  id: string;
  program: ServiceAuthorization["program"];
  serviceCode: ServiceAuthorization["serviceCode"];
  start?: string;
  end?: string;
  state?: ServiceAuthorization["state"];
  suspensions?: { start: string; end: string }[];
}): ServiceAuthorization {
  return {
    id: fields.id,
    participantId: "P-TEST-01",
    program: fields.program,
    serviceCode: fields.serviceCode,
    start: fields.start ?? "2026-01-01",
    end: fields.end ?? "2026-12-31",
    state: fields.state ?? "active",
    suspensions: fields.suspensions ?? [],
    revision: 1,
    tasks: [],
  };
}

function monthly(serviceAuthId: string, month: string, units: number): MonthlyAuthorization {
  return { serviceAuthId, month, units, source: "fusion", revision: 1 };
}

function template(entries: ScheduleTemplate["entries"]): ScheduleTemplate {
  return {
    id: "tpl-1",
    participantId: "P-TEST-01",
    start: "2027-01-01",
    end: "2027-12-31",
    entries,
    rulePackVersion: "mo-2026-07",
  };
}

function visit(id: string, serviceCode: ServiceAuthorization["serviceCode"], date: string): Visit {
  return {
    id,
    participantId: "P-TEST-01",
    caregiverId: "C-1",
    serviceCode,
    start: `${date}T09:00`,
    end: `${date}T10:00`,
    taskIds: [],
  };
}

describe("authorization rules", () => {
  it("TC-10: ILW switch projection day 18, none when ILW missing", () => {
    const daily = Array(31).fill(28) as number[];
    const withIlw = ruleAUTH11ProjectIlwSwitch(daily, 500, 368);
    expect(withIlw).toHaveLength(1);
    expect(withIlw[0]!.severity).toBe("INFO");
    expect(withIlw[0]!.message).toContain("day 18");
    expect(withIlw[0]!.message).toContain("24");
    expect(withIlw[0]!.message).toContain("4");
    expect(ruleAUTH11ProjectIlwSwitch(daily, 500, undefined)).toEqual([]);
  });

  it("TC-17: AUTH-09 BLOCK when Respite Basic + Advanced exceed 868", () => {
    const basic = auth({ id: "a-basic", program: "RESPITE", serviceCode: "S5150" });
    const advanced = auth({ id: "a-adv", program: "RESPITE", serviceCode: "S5150TF" });
    const results = ruleAUTH09Ceiling([basic, advanced], [
      monthly("a-basic", "2026-10", 500),
      monthly("a-adv", "2026-10", 500),
    ]);
    expect(results.some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("AUTH-09 WARN: a month with no imported figure whose derived units are above the ceiling (Amendment B)", () => {
    const a = auth({ id: "a-1", program: "CDS", serviceCode: "T1019U2" });
    // October has Fusion's figure (checked as before); November is over 641; December is at it.
    const derived = { "a-1:2026-10": 700, "a-1:2026-11": 700, "a-1:2026-12": 641 };
    const results = ruleAUTH09Ceiling([a], [monthly("a-1", "2026-10", 600)], derived);
    expect(results).toEqual([
      {
        ruleId: "AUTH-09",
        severity: "WARN",
        message: "Derived 700 units exceed program ceiling 641",
        refs: { serviceAuthId: "a-1", month: "2026-11" },
      },
    ]);
  });

  it("AUTH-07: REVIEW when derived differs from imported Fusion", () => {
    const results = ruleAUTH07DerivedVsFusion(
      [monthly("a-1", "2026-09", 180)],
      { "a-1:2026-09": 181 },
    );
    expect(results.some((r) => r.severity === "REVIEW")).toBe(true);
  });

  it("AUTH-12: BLOCK for ILW units with state pending_approval", () => {
    const a = auth({ id: "a-1", program: "ILW", serviceCode: "T1019U6", state: "pending_approval" });
    const results = ruleAUTH12PendingApproval([a]);
    expect(results.some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("TC-37: AUTH-03 REVIEW when F-2b and F-2a differ", () => {
    const t = task("bathing", 9, 7);
    const results = ruleAUTH03DerivedTaskUnits([t], { bathing: 61 });
    expect(results.some((r) => r.severity === "REVIEW")).toBe(true);
  });
});

describe("schedule rules", () => {
  it("TC-16: SCH-08 BLOCK and SCH-03 WARN", () => {
    const t = task("bathing", 15, 4);
    const tpl = template([
      { taskId: "bathing", weekday: 1, minutes: 51 },
      { taskId: "bathing", weekday: 2, minutes: 3 },
      { taskId: "bathing", weekday: 3, minutes: 3 },
      { taskId: "bathing", weekday: 4, minutes: 3 },
    ]);

    const a = {
      ...auth({ id: "auth-1", program: "CDS", serviceCode: "T1019U2", start: "2027-01-01", end: "2027-12-31" }),
      tasks: [t],
    };
    const sch08 = ruleSCH08CalendarCheck([a], [], tpl, [], ["2027-03"]);
    expect(sch08.some((r) => r.severity === "BLOCK")).toBe(true);
    expect(sch08[0]!.message).toContain("297");
    expect(sch08[0]!.message).toContain("285");

    const sch03 = ruleSCH03TemplateMinutes(tpl, [t]);
    expect(sch03.some((r) => r.severity === "WARN")).toBe(true);
  });

  it("SCH-02: BLOCK above daysPerWeek, WARN below", () => {
    const t = task("bathing", 30, 3);

    const over = template([
      { taskId: "bathing", weekday: 1, minutes: 30 },
      { taskId: "bathing", weekday: 2, minutes: 30 },
      { taskId: "bathing", weekday: 3, minutes: 30 },
      { taskId: "bathing", weekday: 4, minutes: 30 },
    ]);
    expect(ruleSCH02TemplateDays(over, [t]).some((r) => r.severity === "BLOCK")).toBe(true);

    const under = template([
      { taskId: "bathing", weekday: 1, minutes: 30 },
      { taskId: "bathing", weekday: 2, minutes: 30 },
    ]);
    expect(ruleSCH02TemplateDays(under, [t]).some((r) => r.severity === "WARN")).toBe(true);
  });

  it("TC-21: SCH-12 REVIEW for partial month without imported figure", () => {
    const a = auth({
      id: "a-1",
      program: "ILW",
      serviceCode: "T1019U6",
      start: "2026-10-15",
      end: "2026-12-31",
    });
    const results = ruleSCH12PartialMonth([a], [monthly("a-1", "2026-11", 100)]);
    expect(results.some((r) => r.severity === "REVIEW" && r.refs.month === "2026-10")).toBe(true);
  });

  it("TC-22: SCH-14 BLOCK for visit after authorization end", () => {
    const a = auth({
      id: "a-1",
      program: "ILW",
      serviceCode: "T1019U6",
      start: "2026-10-01",
      end: "2026-10-20",
    });
    const results = ruleSCH14VisitDates([visit("v-1", "T1019U6", "2026-10-21")], [a]);
    expect(results.some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("TC-24: SCH-14 BLOCK for visit during suspension", () => {
    const a = auth({
      id: "a-1",
      program: "ILW",
      serviceCode: "T1019U6",
      start: "2026-10-01",
      end: "2026-10-31",
      suspensions: [{ start: "2026-10-05", end: "2026-10-12" }],
    });
    const results = ruleSCH14VisitDates([visit("v-1", "T1019U6", "2026-10-07")], [a]);
    expect(results.some((r) => r.severity === "BLOCK")).toBe(true);
  });
});
