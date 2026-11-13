import { describe, expect, it } from "vitest";
import {
  MO_2026_07,
  eventBalance,
  placeEvent,
  removeEvent,
  ruleById,
  ruleNUR02UnplacedVisits,
  type EventAuthorization,
  type PlanEvent,
  type PlanEventKind,
} from "../src/index.js";

// CP3-1: dated plan events. Made-up data only (P-TEST).
const PACK = MO_2026_07;

function months(first: string, count: number, quantity: number): { month: string; quantity: number }[] {
  const [year, month] = first.split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, index) => {
    const m = month - 1 + index;
    return { month: `${year + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`, quantity };
  });
}

const NURSE: EventAuthorization = {
  id: "auth-rn", scheduleClass: "APPOINTMENT", unit: "visit",
  start: "2026-11-01", end: "2027-04-30", months: months("2026-11", 6, 26),
};
const GHE: EventAuthorization = {
  id: "auth-ghe", scheduleClass: "APPOINTMENT", unit: "visit",
  start: "2026-11-01", end: "2026-11-30", months: [{ month: "2026-11", quantity: 1 }],
};
const ADC: EventAuthorization = {
  id: "auth-adc", scheduleClass: "APPOINTMENT", unit: "minute",
  start: "2026-11-01", end: "2026-12-31", months: months("2026-11", 2, 12000),
};
const MEALS: EventAuthorization = {
  id: "auth-hdm", scheduleClass: "APPOINTMENT", unit: "meal",
  start: "2026-11-01", end: "2026-12-31", months: months("2026-11", 2, 62),
};
const SFC: EventAuthorization = {
  id: "auth-sfc", scheduleClass: "APPOINTMENT", unit: "day",
  start: "2026-11-01", end: "2026-11-30", months: [{ month: "2026-11", quantity: 30 }],
};
const CASE_MGMT: EventAuthorization = {
  id: "auth-cm", scheduleClass: "CONTEXT", unit: "none",
  start: "2026-11-01", end: "2027-04-30", months: months("2026-11", 6, 1),
};

let seq = 0;
function event(kind: PlanEventKind, authorizationId: string, date: string, quantity = 1, more: Partial<PlanEvent> = {}): PlanEvent {
  seq += 1;
  return { id: `ev-${seq}`, authorizationId, kind, date, quantity, billable: kind !== "REMINDER", ...more };
}

/** Place every event in turn, expecting each to be accepted. */
function placed(authorization: EventAuthorization, events: PlanEvent[], start: readonly PlanEvent[] = []): readonly PlanEvent[] {
  return events.reduce<readonly PlanEvent[]>((list, next) => {
    const outcome = placeEvent({ pack: PACK, authorization, event: next, events: list });
    expect(outcome.accepted, `${next.kind} on ${next.date}: ${outcome.results.map((r) => r.message).join("; ")}`).toBe(true);
    return outcome.events;
  }, start);
}

function refuse(authorization: EventAuthorization, next: PlanEvent, events: readonly PlanEvent[]) {
  const outcome = placeEvent({ pack: PACK, authorization, event: next, events });
  expect(outcome.accepted).toBe(false);
  expect(outcome.events).toBe(events);
  return outcome.results;
}

describe("placeEvent: dates and quantities (EVT-01, EVT-02)", () => {
  it("accepts an event inside its authorization's month, and the list gains it", () => {
    const next = event("NURSE_VISIT", GHE.id, "2026-11-12");
    const outcome = placeEvent({ pack: PACK, authorization: GHE, event: next, events: [] });
    expect(outcome).toEqual({ accepted: true, results: [], events: [next] });
  });

  it("EVT-01: refuses a date outside the authorized period", () => {
    const results = refuse(GHE, event("NURSE_VISIT", GHE.id, "2026-12-01"), []);
    expect(results.map((r) => [r.ruleId, r.severity])).toEqual([["EVT-01", "BLOCK"]]);
    expect(results[0]!.message).toBe("2026-12-01 is outside the authorization, 2026-11-01 to 2026-11-30");
    expect(refuse(GHE, event("NURSE_VISIT", GHE.id, "2026-10-31"), [])[0]!.ruleId).toBe("EVT-01");
  });

  it("EVT-01: refuses a month with no authorized quantity, even inside the period", () => {
    const gap: EventAuthorization = { ...MEALS, months: [{ month: "2026-11", quantity: 62 }] };
    const results = refuse(gap, event("MEAL_DELIVERY", gap.id, "2026-12-05", 2), []);
    expect(results.map((r) => r.ruleId)).toEqual(["EVT-01"]);
    expect(results[0]!.message).toBe("Nothing is authorized for 2026-12");
  });

  it("EVT-02: refuses more than the month's authorized quantity; Fusion's count controls", () => {
    const one = placed(GHE, [event("NURSE_VISIT", GHE.id, "2026-11-12")]);
    const results = refuse(GHE, event("NURSE_VISIT", GHE.id, "2026-11-19"), one);
    expect(results.map((r) => [r.ruleId, r.severity])).toEqual([["EVT-02", "BLOCK"]]);
    expect(results[0]!.message).toBe("2 visits would be placed in 2026-11; 1 is authorized");
  });

  it("EVT-02: a quantity that isn't a whole number above zero is refused", () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(refuse(MEALS, event("MEAL_DELIVERY", MEALS.id, "2026-11-03", quantity), [])[0]!.ruleId).toBe("EVT-02");
    }
  });

  it("moving an event replaces it: the same id is never counted twice", () => {
    const first = event("NURSE_VISIT", GHE.id, "2026-11-12");
    const list = placed(GHE, [first]);
    const moved = placeEvent({ pack: PACK, authorization: GHE, event: { ...first, date: "2026-11-20" }, events: list });
    expect(moved.accepted).toBe(true);
    expect(moved.events.map((e) => e.date)).toEqual(["2026-11-20"]);
  });

  it("removeEvent takes one event out and leaves the list it was given alone", () => {
    const list = placed(MEALS, [event("MEAL_DELIVERY", MEALS.id, "2026-11-03", 2), event("MEAL_DELIVERY", MEALS.id, "2026-11-04", 2)]);
    const after = removeEvent(list, list[0]!.id);
    expect(after.map((e) => e.date)).toEqual(["2026-11-04"]);
    expect(list).toHaveLength(2);
  });
});

describe("placeEvent: caps come from the existing rules", () => {
  it("nurse visits: a second visit on one day is refused through CON-10", () => {
    const list = placed(NURSE, [event("NURSE_VISIT", NURSE.id, "2026-11-12")]);
    const results = refuse(NURSE, event("NURSE_VISIT", NURSE.id, "2026-11-12"), list);
    expect(results.map((r) => [r.ruleId, r.severity])).toEqual([["CON-10", "BLOCK"]]);
  });

  it("nurse visits: a general health evaluation at a regular visit is one visit that day", () => {
    const list = placed(NURSE, [event("NURSE_VISIT", NURSE.id, "2026-11-12")]);
    const evaluation = event("NURSE_VISIT", GHE.id, "2026-11-12", 1, { evaluation: true });
    expect(placeEvent({ pack: PACK, authorization: GHE, event: evaluation, events: list }).accepted).toBe(true);
    // Two evaluations on one day are still two visits.
    const two: EventAuthorization = { ...GHE, months: [{ month: "2026-11", quantity: 2 }] };
    const first = placed(two, [event("NURSE_VISIT", two.id, "2026-11-12", 1, { evaluation: true })]);
    expect(refuse(two, event("NURSE_VISIT", two.id, "2026-11-12", 1, { evaluation: true }), first)[0]!.ruleId).toBe("CON-10");
  });

  it("nurse visits: a 27th visit in six months is refused through CON-10", () => {
    const weekly = Array.from({ length: 26 }, (_, week) => {
      const day = new Date(Date.UTC(2026, 10, 2 + week * 7)).toISOString().slice(0, 10);
      return event("NURSE_VISIT", NURSE.id, day);
    });
    const list = placed(NURSE, weekly);
    expect(list).toHaveLength(26);
    const results = refuse(NURSE, event("NURSE_VISIT", NURSE.id, "2026-11-03"), list);
    expect(results.some((r) => r.ruleId === "CON-10" && /27 nurse visits within 6 months/.test(r.message))).toBe(true);
  });

  it("adult day care: 600 minutes a day is accepted, 615 (41 units) is refused through WS-R08", () => {
    expect(placed(ADC, [event("ADC_DAY", ADC.id, "2026-11-02", 600)])).toHaveLength(1);
    const results = refuse(ADC, event("ADC_DAY", ADC.id, "2026-11-02", 615), []);
    expect(results.map((r) => [r.ruleId, r.severity])).toEqual([["WS-R08", "BLOCK"]]);
    expect(refuse(ADC, event("ADC_DAY", ADC.id, "2026-11-02", 100), [])[0]!.ruleId).toBe("WS-R08");
  });

  it("adult day care: five days in a week are accepted and a sixth is refused", () => {
    const week = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"].map((date) => event("ADC_DAY", ADC.id, date, 480));
    const list = placed(ADC, week);
    expect(refuse(ADC, event("ADC_DAY", ADC.id, "2026-11-07", 480), list).map((r) => r.ruleId)).toEqual(["WS-R08"]);
    // The next week starts a new count.
    expect(placeEvent({ pack: PACK, authorization: ADC, event: event("ADC_DAY", ADC.id, "2026-11-09", 480), events: list }).accepted).toBe(true);
  });

  it("adult day care: transportation counts toward its own 120 minutes a day", () => {
    expect(placed(ADC, [event("ADC_DAY", ADC.id, "2026-11-02", 480, { transportMinutes: 120 })])).toHaveLength(1);
    const results = refuse(ADC, event("ADC_DAY", ADC.id, "2026-11-02", 480, { transportMinutes: 121 }), []);
    expect(results[0]!.message).toBe("Adult day care transportation is limited to 120 minutes a day.");
  });

  it("meals: two a day are accepted and a third is refused with the limit, at the rule's own severity", () => {
    const list = placed(MEALS, [event("MEAL_DELIVERY", MEALS.id, "2026-11-03", 2)]);
    const results = refuse(MEALS, event("MEAL_DELIVERY", MEALS.id, "2026-11-03", 1), list);
    expect(results.map((r) => [r.ruleId, r.severity])).toEqual([["WS-R09", "REVIEW"]]);
    expect(refuse(MEALS, event("MEAL_DELIVERY", MEALS.id, "2026-11-04", 3), list)[0]!.ruleId).toBe("WS-R09");
  });

  it("structured family caregiving: a day is one day, and a day is covered once", () => {
    const list = placed(SFC, [event("SFC_DAY", SFC.id, "2026-11-02")]);
    expect(refuse(SFC, event("SFC_DAY", SFC.id, "2026-11-02"), list).map((r) => r.ruleId)).toEqual(["EVT-02"]);
    expect(refuse(SFC, event("SFC_DAY", SFC.id, "2026-11-03", 96), list)[0]!.message).toBe(
      "A structured family caregiver day is one day, never 96",
    );
  });
});

describe("EVT-03: context authorizations and reminders", () => {
  it("a reminder on a context authorization is accepted and counts toward nothing", () => {
    const reminder = event("REMINDER", CASE_MGMT.id, "2026-11-10", 0);
    const list = placed(CASE_MGMT, [reminder]);
    expect(eventBalance(CASE_MGMT, list, "2026-11")).toEqual({ unit: "none", authorized: 1, placed: 0, left: 1 });
  });

  it("refuses any billable or shift-producing event on a context authorization", () => {
    for (const kind of ["NURSE_VISIT", "ADC_DAY", "MEAL_DELIVERY", "SFC_DAY"] as const) {
      const results = refuse(CASE_MGMT, event(kind, CASE_MGMT.id, "2026-11-10", kind === "ADC_DAY" ? 60 : 1), []);
      expect(results.map((r) => [r.ruleId, r.severity]), kind).toEqual([["EVT-03", "BLOCK"]]);
    }
  });

  it("a reminder is never billable and never has a quantity, on any authorization", () => {
    expect(refuse(CASE_MGMT, event("REMINDER", CASE_MGMT.id, "2026-11-10", 0, { billable: true }), [])[0]!.ruleId).toBe("EVT-03");
    expect(refuse(GHE, event("REMINDER", GHE.id, "2026-11-10", 1), [])[0]!.ruleId).toBe("EVT-03");
  });

  it("a reminder may sit outside the authorized month and never counts as a visit", () => {
    const visit = event("NURSE_VISIT", GHE.id, "2026-11-12");
    const upload = event("REMINDER", GHE.id, "2026-12-15", 0);
    const list = placed(GHE, [visit, upload]);
    expect(eventBalance(GHE, list, "2026-11")).toEqual({ unit: "visit", authorized: 1, placed: 1, left: 0 });
    expect(eventBalance(GHE, list, "2026-12")).toEqual({ unit: "visit", authorized: null, placed: 0, left: null });
    // A reminder on a day doesn't stop that day's nurse visit.
    const sameDay = placed(NURSE, [event("REMINDER", NURSE.id, "2026-11-20", 0), event("NURSE_VISIT", NURSE.id, "2026-11-20")]);
    expect(sameDay).toHaveLength(2);
  });
});

describe("eventBalance: in the service's own unit", () => {
  it("meals stay meals, days stay days, visits stay visits, day care stays minutes", () => {
    const meals = placed(MEALS, [event("MEAL_DELIVERY", MEALS.id, "2026-11-03", 2), event("MEAL_DELIVERY", MEALS.id, "2026-11-04", 2), event("MEAL_DELIVERY", MEALS.id, "2026-12-01", 1)]);
    expect(eventBalance(MEALS, meals, "2026-11")).toEqual({ unit: "meal", authorized: 62, placed: 4, left: 58 });
    const days = placed(SFC, [event("SFC_DAY", SFC.id, "2026-11-02"), event("SFC_DAY", SFC.id, "2026-11-03")]);
    expect(eventBalance(SFC, days, "2026-11")).toEqual({ unit: "day", authorized: 30, placed: 2, left: 28 });
    const care = placed(ADC, [event("ADC_DAY", ADC.id, "2026-11-02", 480)]);
    expect(eventBalance(ADC, care, "2026-11")).toEqual({ unit: "minute", authorized: 12000, placed: 480, left: 11520 });
  });

  it("counts only its own authorization's events", () => {
    const both = placed(GHE, [event("NURSE_VISIT", GHE.id, "2026-11-12")], placed(NURSE, [event("NURSE_VISIT", NURSE.id, "2026-11-05")]));
    expect(eventBalance(GHE, both, "2026-11").placed).toBe(1);
    expect(eventBalance(NURSE, both, "2026-11").placed).toBe(1);
  });
});

describe("the EVT rules are cataloged", () => {
  it.each(["EVT-01", "EVT-02", "EVT-03"])("%s is a BLOCK rule in the Schedule table", (id) => {
    expect(ruleById(id)).toMatchObject({ area: "Schedule", severities: ["BLOCK"] });
  });
});

describe("NUR-02: a passed visit month with no date placed (RN-04)", () => {
  it("warns for a past month with no date, and not once a date is placed", () => {
    expect(ruleNUR02UnplacedVisits([GHE], [], "2026-12")).toEqual([
      { ruleId: "NUR-02", severity: "WARN", message: "No date was placed for this month's visit.", refs: { serviceAuthId: "auth-ghe", month: "2026-11" } },
    ]);
    const list = placed(GHE, [event("NURSE_VISIT", GHE.id, "2026-11-12")]);
    expect(ruleNUR02UnplacedVisits([GHE], list, "2026-12")).toEqual([]);
  });

  it("says nothing for this month, a month to come, or a service that isn't counted in visits", () => {
    expect(ruleNUR02UnplacedVisits([GHE], [], "2026-11")).toEqual([]);
    expect(ruleNUR02UnplacedVisits([GHE], [], "2026-10")).toEqual([]);
    expect(ruleNUR02UnplacedVisits([MEALS, SFC, ADC, CASE_MGMT], [], "2027-06")).toEqual([]);
  });

  it("a reminder is not a visit: it doesn't settle the month", () => {
    const list = placed(GHE, [event("REMINDER", GHE.id, "2026-11-15", 0)]);
    expect(ruleNUR02UnplacedVisits([GHE], list, "2026-12")).toHaveLength(1);
  });
});
