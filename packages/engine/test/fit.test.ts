import { describe, expect, it } from "vitest";
import {
  MO_2026_07,
  composeWeek,
  expandMonth,
  findTaskByName,
  fitToAuthorization,
  ruleSCH11RepeatedExceptions,
  validateSchedule,
  type AuthorizedTask,
  type CalendarException,
  type MonthlyAuthorization,
  type ScheduleTemplate,
  type ServiceAuthorization,
} from "../src/index.js";

const AUTH_ID = "SA-TEST-01";
const PARTICIPANT = "P-TEST-01";

// IMPORT-SPEC fixture B (B-tabbed-7day-455.txt), built by hand: name, taskCode, minPerDay, daysPerWeek.
const FIXTURE_B: [string, string, number, AuthorizedTask["daysPerWeek"]][] = [
  ["Assistance with Toileting", "ASSISTANCE_WITH_TOILETING", 10, 7],
  ["Bathing", "BATHING", 45, 7],
  ["Change Linens", "CHANGE_LINENS", 10, 7],
  ["Clean Bath", "CLEAN_BATH", 20, 1],
  ["Clean Floors", "CLEAN_FLOORS", 20, 1],
  ["Clean Kitchen", "CLEAN_KITCHEN", 20, 1],
  ["Dressing/Grooming", "DRESSING_GROOMING", 15, 7],
  ["Essential Correspondence", "ESSENTIAL_CORRESPONDENCE", 30, 1],
  ["Laundry (Off Site)", "LAUNDRY_OFF_SITE", 140, 1],
  ["Meal Prep/Eating", "MEAL_PREP_EATING", 60, 7],
  ["Medications", "MEDICATIONS", 5, 7],
  ["Mobility/Transfer", "MOBILITY_TRANSFER", 10, 7],
  ["Tidy and Dust", "TIDY_AND_DUST", 10, 1],
  ["Trash", "TRASH", 5, 7],
  ["Wash Dishes", "WASH_DISHES", 15, 7],
];

const TASKS: AuthorizedTask[] = FIXTURE_B.map(([name, taskCode, minPerDay, daysPerWeek], i) => ({
  id: `t${i + 1}`,
  serviceAuthId: AUTH_ID,
  taskCode,
  name,
  minPerDay,
  daysPerWeek,
}));

const AUTH: ServiceAuthorization = {
  id: AUTH_ID,
  participantId: PARTICIPANT,
  program: "CDS",
  serviceCode: "T1019U2",
  start: "2025-12-01",
  end: "2026-10-31",
  state: "active",
  suspensions: [],
  revision: 1,
  tasks: TASKS,
  transportMinutesPerMonth: 345,
};

const MONTHS = [
  "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
  "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
];

function fusion(month: string, units: number, serviceAuthId = AUTH_ID): MonthlyAuthorization {
  return { serviceAuthId, month, units, source: "fusion", revision: 1 };
}

const FUSION_455 = MONTHS.map((month) => fusion(month, 455));

const TEMPLATE: ScheduleTemplate = {
  id: "tpl-test-01",
  participantId: PARTICIPANT,
  start: AUTH.start,
  end: AUTH.end,
  entries: composeWeek({
    tasks: TASKS,
    activeDays: [true, true, true, true, true, true, true],
    overrides: {},
    weeklyTransportMinutes: 60,
    transportDay: 0,
  }).entries,
  rulePackVersion: MO_2026_07.id,
};

function trim(date: string, taskId: string, minutesDelta: number): CalendarException {
  return {
    id: `fit-${date}-${taskId}`,
    participantId: PARTICIPANT,
    date,
    taskId,
    minutesDelta,
    reason: "Units for the month run out",
    author: "CarePlan Scheduler",
    createdAt: "",
    kind: "fit",
  };
}

// t10 = Meal Prep/Eating, t2 = Bathing.
const TC38_TRIMS: CalendarException[] = [
  trim("2025-12-31", "t10", -60),
  trim("2025-12-31", "t2", -35),
  trim("2026-03-31", "t10", -60),
  trim("2026-03-31", "t2", -15),
  trim("2026-08-31", "t10", -55),
];

function validate(exceptions: CalendarException[]) {
  return validateSchedule({
    pack: MO_2026_07,
    authorizations: [AUTH],
    monthlyAuthorizations: FUSION_455,
    template: TEMPLATE,
    exceptions,
    visits: [],
    caregivers: [],
    enrollments: [],
    months: MONTHS,
    tenantWorkweekStart: 0,
  });
}

describe("SCH-17 fitToAuthorization", () => {
  it("TC-38: trims fixture B to Fusion 455 on the last days of Dec, Mar and Aug", () => {
    expect(fitToAuthorization(TEMPLATE, AUTH, FUSION_455, MONTHS)).toEqual(TC38_TRIMS);
  });

  it("TC-38: validateSchedule with the trims has no BLOCK (without them SCH-08 blocks those months)", () => {
    const blocks = (exceptions: CalendarException[]) =>
      validate(exceptions).filter((result) => result.severity === "BLOCK");
    expect(blocks(fitToAuthorization(TEMPLATE, AUTH, FUSION_455, MONTHS))).toEqual([]);
    expect(blocks([]).map((result) => [result.ruleId, result.refs.month])).toEqual([
      ["SCH-08", "2025-12"],
      ["SCH-08", "2026-03"],
      ["SCH-08", "2026-08"],
    ]);
  });

  it("never trims a month without a Fusion figure for this authorization", () => {
    const monthly = [
      ...FUSION_455.filter((ma) => ma.month !== "2025-12"),
      { serviceAuthId: AUTH_ID, month: "2025-12", units: 455, source: "derived", revision: 1 } satisfies MonthlyAuthorization,
      fusion("2025-12", 455, "SA-TEST-OTHER"),
    ];
    expect(fitToAuthorization(TEMPLATE, AUTH, monthly, MONTHS)).toEqual(TC38_TRIMS.slice(2));
  });

  it("never makes a minute count negative, even when the budget is zero", () => {
    // 20 Fusion units minus 23 transport units: the budget floors at 0, so all of December goes.
    const trims = fitToAuthorization(TEMPLATE, AUTH, [fusion("2025-12", 20)], MONTHS);
    const planned = expandMonth(TEMPLATE, [], 2025, 12, AUTH.start, AUTH.end);
    const plannedTotal = Object.values(planned)
      .flatMap((day) => Object.values(day))
      .reduce((sum, minutes) => sum + minutes, 0);

    expect(new Set(trims.map((ex) => ex.id)).size).toBe(trims.length);
    for (const ex of trims) {
      expect(ex.minutesDelta).toBeLessThan(0);
      expect(-ex.minutesDelta).toBeLessThanOrEqual(planned[ex.date]?.[ex.taskId] ?? 0);
    }
    expect(trims.reduce((sum, ex) => sum - ex.minutesDelta, 0)).toBe(plannedTotal);
    const fitted = expandMonth(TEMPLATE, trims, 2025, 12, AUTH.start, AUTH.end);
    expect(Object.values(fitted).flatMap((day) => Object.values(day)).every((minutes) => minutes === 0)).toBe(true);
  });
});

describe("SCH-11 ignores kind \"fit\" (Amendment A)", () => {
  const trims = [...TC38_TRIMS, trim("2026-01-31", "t10", -15)];

  it("TC-39: fit trims in consecutive months give no SCH-11 result", () => {
    expect(ruleSCH11RepeatedExceptions(trims)).toEqual([]);
  });

  it("TC-39: the same trims as kind \"change\" give one SCH-11 WARN", () => {
    const expected = [
      {
        ruleId: "SCH-11",
        severity: "WARN",
        message: "Exception repeated in consecutive months; consider a care plan change request",
        refs: { taskId: "t10" },
      },
    ];
    const changes = trims.map((ex): CalendarException => ({ ...ex, kind: "change" }));
    expect(ruleSCH11RepeatedExceptions(changes)).toEqual(expected);
    // An exception without a kind is a person's change.
    const unmarked = changes.map(({ kind: _kind, ...ex }): CalendarException => ex);
    expect(ruleSCH11RepeatedExceptions(unmarked)).toEqual(expected);
  });
});

describe("rule pack aliases", () => {
  it("TC-40: \"Essential Correspond\" resolves to ESSENTIAL_CORRESPONDENCE", () => {
    expect(findTaskByName(MO_2026_07, "Essential Correspond")?.taskCode).toBe("ESSENTIAL_CORRESPONDENCE");
  });
});
