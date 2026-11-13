import { beforeEach, describe, expect, it } from "vitest";
import { MO_2026_07, type Visit } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import {
  candidates, chooseReplacement, markUnavailable, overFortyHours, planBackup, setTaskPriority, uncoveredVisits, undoReplacement,
} from "../../src/features/quick-schedule/backup";
import { addCaregiver, assignCaregiver, planCaregivers, updateCaregiver } from "../../src/features/quick-schedule/caregivers";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { loadPlan, PLAN_KEY, savePlan } from "../../src/features/quick-schedule/persistence";
import { planCheckLines } from "../../src/features/quick-schedule/PlanChecks";
import { copyFor } from "../../src/features/quick-schedule/ruleCopy";
import { planExtrasValid } from "../../src/features/quick-schedule/storedExtras";
import type { CarePlan, PlanCaregiver } from "../../src/features/quick-schedule/types";
import { buildVisits, careWeekdays, planVisitResults, setStartTime } from "../../src/features/quick-schedule/visits";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// CP4-8 on fixture F, built Apr 15, 2026: PC - Agency (0), PC - CDS (1) and HC (2).
const PACK = MO_2026_07;
const AGENCY = 0;
const HC = 2;
const WEEK = { start: "2026-05-03", end: "2026-05-09" }; // Sunday to Saturday

function planF(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), PACK, new Date("2026-04-15T12:00:00-05:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture F should build");
  return outcome.plan;
}

const modelsOf = (plan: CarePlan) => plan.services.map((state) => buildQuickModel(state, PACK));

function timed(plan: CarePlan, service: number, time: string): CarePlan {
  return careWeekdays(plan.services[service]!, modelsOf(plan)[service]!).reduce((current, weekday) => {
    const change = setStartTime(current, service, weekday, time, PACK, modelsOf(current));
    expect(change.refusal).toBeUndefined();
    return change.plan;
  }, plan);
}

function withCaregiver(plan: CarePlan, patch: Partial<Omit<PlanCaregiver, "id">>): [CarePlan, string] {
  const added = addCaregiver(plan);
  const id = planCaregivers(added).at(-1)!.id;
  return [updateCaregiver(added, id, patch), id];
}

/**
 * Agency PC and HC at 9:00, with Caregiver A on Agency PC; B free and qualified; C with nothing
 * entered; D a spouse (who can't be an agency aide); E on HC, at the same time as Agency PC.
 */
function staffed() {
  let plan = timed(timed(planF(), AGENCY, "09:00"), HC, "09:00");
  const ids: Record<string, string> = {};
  const people: [string, Partial<Omit<PlanCaregiver, "id">>][] = [
    ["A", { relationship: "none", agencyEmployee: true }],
    ["B", { relationship: "none", agencyEmployee: true }],
    ["C", {}],
    ["D", { relationship: "spouse", agencyEmployee: true }],
    ["E", { relationship: "none", agencyEmployee: true }],
  ];
  for (const [key, patch] of people) {
    const [nextPlan, id] = withCaregiver(plan, patch);
    plan = nextPlan;
    ids[key] = id;
  }
  plan = assignCaregiver(assignCaregiver(plan, AGENCY, ids.A!, true), HC, ids.E!, true);
  return { plan, ids };
}

/** The first uncovered Agency PC visit on a day HC also has a visit (so Caregiver E is booked then). */
function sharedDay(plan: CarePlan) {
  const hcDays = new Set(
    buildVisits(plan, modelsOf(plan), PACK).filter((v) => v.id.startsWith(`${plan.services[HC]!.id}:`)).map((v) => v.start.slice(0, 10)),
  );
  return uncoveredVisits(plan, modelsOf(plan), PACK).find((entry) => hcDays.has(entry.date))!;
}

beforeEach(() => sessionStorage.clear());

describe("CP4-8: marking a caregiver away", () => {
  it("lists the visits left uncovered on those days only, and assigns no one", () => {
    const { plan, ids } = staffed();
    const away = markUnavailable(plan, ids.A!, WEEK.start, WEEK.end);
    expect(away.refusal).toBeUndefined();
    const uncovered = uncoveredVisits(away.plan, modelsOf(away.plan), PACK);
    expect(uncovered.length).toBeGreaterThan(0);
    expect(uncovered.every((entry) => entry.service === AGENCY && entry.date >= WEEK.start && entry.date <= WEEK.end)).toBe(true);
    // Nothing is chosen for the person: no substitute, and every visit still names Caregiver A.
    expect(planBackup(away.plan).substitutes).toEqual([]);
    expect(uncovered.every((entry) => entry.visit.caregiverId === ids.A)).toBe(true);
  });

  it("refuses dates that aren't dates or run backwards", () => {
    const { plan, ids } = staffed();
    expect(markUnavailable(plan, ids.A!, "May 3", WEEK.end).refusal).toBe("Not changed. Enter the first and last day away as dates.");
    expect(markUnavailable(plan, ids.A!, WEEK.end, WEEK.start).refusal).toBe("Not changed. The last day away must be on or after the first.");
  });
});

describe("CP4-8: who can cover", () => {
  it("offers only the caregiver who is qualified, free and under 40 hours, and says why the rest aren't", () => {
    const { plan, ids } = staffed();
    const away = markUnavailable(plan, ids.A!, WEEK.start, WEEK.end).plan;
    const entry = sharedDay(away);
    const found = Object.fromEntries(candidates(away, modelsOf(away), PACK, entry!).map((c) => [c.caregiverId, c.reason]));
    expect(found).toEqual({
      [ids.B!]: null,
      [ids.C!]: "Relationship or qualifications not entered",
      [ids.D!]: copyFor("CON-07", "BLOCK")!.title,
      [ids.E!]: "Booked at that time",
    });
  });

  it("someone away the same day isn't offered", () => {
    const { plan, ids } = staffed();
    let away = markUnavailable(plan, ids.A!, WEEK.start, WEEK.end).plan;
    away = markUnavailable(away, ids.B!, WEEK.start, WEEK.end).plan;
    const [entry] = uncoveredVisits(away, modelsOf(away), PACK);
    expect(candidates(away, modelsOf(away), PACK, entry!).find((c) => c.caregiverId === ids.B)!.reason).toBe("Away that day");
  });

  it("over 40 hours in any seven days that include the date", () => {
    const day = (date: string, from: string, to: string): Visit => ({
      id: date, participantId: "participant", caregiverId: "cg", serviceCode: "T1019", start: `${date}T${from}`, end: `${date}T${to}`, taskIds: [],
    });
    const forty = ["2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07"].map((date) => day(date, "08:00", "18:00"));
    expect(overFortyHours(forty, "cg", "2026-05-07")).toBe(false);
    expect(overFortyHours([...forty, day("2026-05-08", "08:00", "08:15")], "cg", "2026-05-08")).toBe(true);
    // Eight days later the first four have left every seven-day stretch that includes the date.
    expect(overFortyHours([...forty, day("2026-05-12", "08:00", "08:15")], "cg", "2026-05-12")).toBe(false);
  });
});

describe("CP4-8: the order follows the priority the person entered", () => {
  it("visits with a High task come first; within a visit, tasks go highest first", () => {
    const { plan, ids } = staffed();
    // Caregiver A on HC instead of E, so both services are uncovered that week.
    const onBoth = assignCaregiver(assignCaregiver(plan, HC, ids.E!, false), HC, ids.A!, true);
    let away = markUnavailable(onBoth, ids.A!, WEEK.start, WEEK.end).plan;
    const before = uncoveredVisits(away, modelsOf(away), PACK);
    expect(new Set(before.map((entry) => entry.service))).toEqual(new Set([AGENCY, HC]));
    // Nothing entered: by date and time.
    expect(before.map((entry) => entry.visit.start)).toEqual([...before.map((entry) => entry.visit.start)].sort());
    const hcTask = away.services[HC]!.tasks[0]!.id;
    const agencyLast = away.services[AGENCY]!.tasks.at(-1)!;
    away = setTaskPriority(setTaskPriority(away, hcTask, "HIGH"), agencyLast.id, "MEDIUM");
    const after = uncoveredVisits(away, modelsOf(away), PACK);
    const firstAgency = after.findIndex((entry) => entry.service === AGENCY);
    expect(after.slice(0, firstAgency).every((entry) => entry.service === HC)).toBe(true);
    expect(firstAgency).toBeGreaterThan(0);
    expect(after[firstAgency]!.tasks[0]).toEqual({ taskId: agencyLast.id, name: agencyLast.name, priority: "MEDIUM" });
    expect(after[firstAgency]!.tasks.slice(1).every((task) => task.priority === null)).toBe(true);
  });
});

describe("CP4-8: choosing a replacement", () => {
  it("records a substitute exception; the visit is covered and the authorization is untouched", () => {
    const { plan, ids } = staffed();
    const away = markUnavailable(plan, ids.A!, WEEK.start, WEEK.end).plan;
    const [entry] = uncoveredVisits(away, modelsOf(away), PACK);
    const chosen = chooseReplacement(away, modelsOf(away), PACK, entry!.visit.id, ids.B!);
    expect(chosen.refusal).toBeUndefined();
    const [sub] = planBackup(chosen.plan).substitutes;
    expect(sub).toMatchObject({ kind: "substitute", date: entry!.date, caregiverId: ids.B, serviceAuthId: away.services[AGENCY]!.id, taskId: "", minutesDelta: 0 });
    // The services, their authorizations and their minutes are the same objects as before.
    expect(chosen.plan.services).toBe(away.services);
    expect(buildVisits(chosen.plan, modelsOf(chosen.plan), PACK).find((v) => v.id === entry!.visit.id)!.caregiverId).toBe(ids.B);
    expect(uncoveredVisits(chosen.plan, modelsOf(chosen.plan), PACK).some((found) => found.visit.id === entry!.visit.id)).toBe(false);
    // Undo puts the visit back with Caregiver A, uncovered again.
    const undone = undoReplacement(chosen.plan, sub!.id);
    expect(uncoveredVisits(undone, modelsOf(undone), PACK).some((found) => found.visit.id === entry!.visit.id)).toBe(true);
  });

  it("a caregiver who isn't offered is refused with the reason, and nothing changes", () => {
    const { plan, ids } = staffed();
    const away = markUnavailable(plan, ids.A!, WEEK.start, WEEK.end).plan;
    const entry = sharedDay(away);
    const refused = chooseReplacement(away, modelsOf(away), PACK, entry!.visit.id, ids.E!);
    expect(refused.plan).toBe(away);
    expect(refused.refusal).toMatch(/^Not changed\. Booked at that time on /);
  });

  it("round-trips through storage with ids only, and a bad record is refused", () => {
    const { plan, ids } = staffed();
    const away = markUnavailable(plan, ids.A!, WEEK.start, WEEK.end).plan;
    const [entry] = uncoveredVisits(away, modelsOf(away), PACK);
    const chosen = setTaskPriority(chooseReplacement(away, modelsOf(away), PACK, entry!.visit.id, ids.B!).plan, entry!.tasks[0]!.taskId, "LOW");
    savePlan(chosen);
    expect(sessionStorage.getItem(PLAN_KEY)).not.toMatch(/SAMPLE PARTICIPANT|10000006/);
    expect(loadPlan()!.backup).toEqual(chosen.backup);
    expect(planExtrasValid({ backup: { ...chosen.backup, priorities: { x: "URGENT" } } })).toBe(false);
    expect(planExtrasValid({ backup: { ...chosen.backup, substitutes: [{ ...planBackup(chosen).substitutes[0], minutesDelta: 15 }] } })).toBe(false);
  });
});

describe("CP4-8: CAP-01 on the plan", () => {
  it("Agency PC and CDS together: one Needs review line naming both, never Must fix", () => {
    const plan = planF();
    const models = modelsOf(plan);
    const lines = planCheckLines(planVisitResults(plan, models, PACK), plan, models).filter((line) => line.ruleIds.includes("CAP-01"));
    expect(lines).toEqual([
      expect.objectContaining({ severity: "REVIEW", text: copyFor("CAP-01", "REVIEW")!.title, services: ["PC - Agency", "PC - CDS"] }),
    ]);
  });

  it("only one of them: no flag", () => {
    const full = planF();
    const plan: CarePlan = { ...full, services: full.services.filter((state) => state.serviceCode !== "T1019U2") };
    expect(planVisitResults(plan, modelsOf(plan), PACK).some((result) => result.ruleId === "CAP-01")).toBe(false);
  });
});
