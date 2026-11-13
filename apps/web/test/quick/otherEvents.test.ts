import { describe, expect, it } from "vitest";
import { MO_2026_07, findAppendix1, type PlanEventKind } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { balanceText, eventLine } from "../../src/features/quick-schedule/eventText";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { placingKind } from "../../src/features/quick-schedule/OtherPlacing";
import { otherReasonLine, planOthers } from "../../src/features/quick-schedule/others";
import { applyEvent, eventsOf, otherAuthorization, planEvents } from "../../src/features/quick-schedule/planEvents";
import type { CarePlan, PlanOther } from "../../src/features/quick-schedule/types";
import fixtureG from "@fixtures/fusion/G-care-plan-report-kept.txt?raw";

// CP3-4 and CP3-5 on fixture G (made up): CDS in the week, plus meals, adult day care, financial
// management, an RCF/ALF nurse visit and an unknown code, Nov 2026 to Apr 2027.
const PACK = MO_2026_07;

function planG(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureG), PACK, new Date("2026-10-31T12:00:00-05:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture G should build");
  return outcome.plan;
}

function otherByCode(plan: CarePlan, code: string): PlanOther {
  return planOthers(plan).find((other) => other.code === code)!;
}

/** A made-up kept authorization for a service fixture G doesn't have. */
function madeUp(code: string, units: number): PlanOther {
  return {
    id: `other-${code}`, label: null, code, registryId: findAppendix1(code)!.id, provider: null, pa: null,
    start: "2026-11-01", end: "2026-12-31",
    monthly: [
      { start: "2026-11-01", end: "2026-11-30", units },
      { start: "2026-12-01", end: "2026-12-31", units },
    ],
    rows: [],
  };
}

function place(plan: CarePlan, other: PlanOther, kind: PlanEventKind, date: string, quantity?: number, transportMinutes?: number) {
  return applyEvent(plan, { authorizationId: other.id!, kind, date, quantity, transportMinutes }, PACK);
}

function placeAll(plan: CarePlan, other: PlanOther, kind: PlanEventKind, dates: string[], quantity?: number): CarePlan {
  return dates.reduce((current, date) => {
    const change = place(current, other, kind, date, quantity);
    expect(change.refusal, date).toBeUndefined();
    return change.plan;
  }, plan);
}

describe("ADW-03: adult day care on dates", () => {
  it("Fusion's 400 units a month are 6,000 minutes of attendance, counted as minutes", () => {
    const authorization = otherAuthorization(otherByCode(planG(), "S5100HC"))!;
    expect(authorization.unit).toBe("minute");
    expect(authorization.months[0]).toEqual({ month: "2026-11", quantity: 6000 });
  });

  it("a day of 600 minutes is accepted; 615 minutes (41 units) is refused", () => {
    const plan = planG();
    const adc = otherByCode(plan, "S5100HC");
    expect(place(plan, adc, "ADC_DAY", "2026-11-02", 600).refusal).toBeUndefined();
    const refused = place(plan, adc, "ADC_DAY", "2026-11-02", 615);
    expect(refused.plan).toBe(plan);
    expect(refused.refusal).toBe("Not placed. Enter adult day care in 15-minute steps, at most 10 hours a day and 5 days a week.");
  });

  it("five days in a week are accepted and a sixth is refused", () => {
    const plan = planG();
    const adc = otherByCode(plan, "S5100HC");
    const week = placeAll(plan, adc, "ADC_DAY", ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"], 480);
    const sixth = place(week, adc, "ADC_DAY", "2026-11-07", 480);
    expect(sixth.plan).toBe(week);
    expect(sixth.refusal).toBe("Not placed. Enter adult day care at most 5 days a week.");
  });

  it("transportation is its own entry and its own 120 minutes a day", () => {
    const plan = planG();
    const adc = otherByCode(plan, "S5100HC");
    const ok = place(plan, adc, "ADC_DAY", "2026-11-02", 480, 120);
    expect(ok.refusal).toBeUndefined();
    expect(eventLine(eventsOf(ok.plan, adc.id!)[0]!)).toBe("Nov 2, 2026 · 8 h · 120 min transportation");
    expect(place(plan, adc, "ADC_DAY", "2026-11-02", 480, 121).refusal).toBe(
      "Not placed. Adult day care transportation is limited to 120 minutes a day.",
    );
  });

  it("its balance is time attended, and it never becomes caregiver time in the week", () => {
    const plan = planG();
    const adc = otherByCode(plan, "S5100HC");
    const placed = placeAll(plan, adc, "ADC_DAY", ["2026-11-02"], 480);
    expect(balanceText(otherAuthorization(adc)!, planEvents(placed), "2026-11")).toBe("100 h in November 2026, 8 h placed, 92 h left");
    // The week still holds only CDS: no service was added and no minute moved.
    expect(placed.services).toBe(plan.services);
    expect(placed.services.map((service) => service.serviceCode)).toEqual(["T1019U2"]);
  });
});

describe("ADW-04: home delivered meals on dates", () => {
  it("two meals a day are accepted, a third is refused, and meals stay meals", () => {
    const plan = planG();
    const meals = otherByCode(plan, "S5170");
    const two = place(plan, meals, "MEAL_DELIVERY", "2026-11-03", 2);
    expect(two.refusal).toBeUndefined();
    expect(place(two.plan, meals, "MEAL_DELIVERY", "2026-11-03", 1).refusal).toBe(
      "Not placed. Home delivered meals are limited to 2 a day. Enter 2 or fewer for Nov 3, 2026.",
    );
    expect(place(plan, meals, "MEAL_DELIVERY", "2026-11-04", 3).refusal).toMatch(/limited to 2 a day/);
    const event = eventsOf(two.plan, meals.id!)[0]!;
    expect(event).toMatchObject({ kind: "MEAL_DELIVERY", quantity: 2, billable: true });
    expect(eventLine(event)).toBe("Nov 3, 2026 · 2 meals");
  });

  it("the balance is in meals: 62 a month, 10 placed, 52 left", () => {
    const plan = planG();
    const meals = otherByCode(plan, "S5170");
    const placed = placeAll(plan, meals, "MEAL_DELIVERY", ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"], 2);
    expect(balanceText(otherAuthorization(meals)!, planEvents(placed), "2026-11")).toBe("62 meals in November 2026, 10 placed, 52 left");
    expect(otherReasonLine(placed, meals)).toBe("Arranged by date · 5 dates placed");
    expect(otherReasonLine(plan, meals)).toBe("Arranged by date");
  });

  it("more than the month's 62 meals is refused: Fusion's count controls", () => {
    const base = planG();
    const meals = { ...otherByCode(base, "S5170"), monthly: [{ start: "2026-11-01", end: "2026-11-30", units: 3 }] };
    const plan: CarePlan = { ...base, others: [meals] };
    const two = placeAll(plan, meals, "MEAL_DELIVERY", ["2026-11-02"], 2);
    expect(place(two, meals, "MEAL_DELIVERY", "2026-11-03", 2).refusal).toBe(
      "Not placed. The care plan authorizes 3 meals in November 2026, and this would go over. Remove a date first, or enter less.",
    );
  });
});

describe("SFC-01: structured family caregiver covered days", () => {
  const sfc = madeUp("S5126HB", 30);

  it("a covered day is a day: never units, never minutes, and covered once", () => {
    const plan: CarePlan = { ...planG(), others: [sfc] };
    expect(placingKind(findAppendix1("S5126HB")!)).toBe("days");
    const placed = placeAll(plan, sfc, "SFC_DAY", ["2026-11-02", "2026-11-03"]);
    expect(eventsOf(placed, sfc.id!).map((event) => [event.kind, event.quantity])).toEqual([["SFC_DAY", 1], ["SFC_DAY", 1]]);
    expect(balanceText(otherAuthorization(sfc)!, planEvents(placed), "2026-11")).toBe("2 covered days of 30 authorized in November 2026");
    expect(place(placed, sfc, "SFC_DAY", "2026-11-02").refusal).toBe("Not placed. Nov 2, 2026 is already a covered day.");
    expect(place(placed, sfc, "SFC_DAY", "2026-11-04", 96).refusal).toMatch(/^Not placed\./);
  });

  it("covered days add nothing to any service's units (INV-01 stays true on the calendar path)", () => {
    const plan: CarePlan = { ...planG(), others: [sfc] };
    const before = buildQuickModel(plan.services[0]!, PACK).monthlyAuthorizations;
    const placed = placeAll(plan, sfc, "SFC_DAY", ["2026-11-02"]);
    expect(buildQuickModel(placed.services[0]!, PACK).monthlyAuthorizations).toEqual(before);
    expect(otherAuthorization(sfc)!.unit).toBe("day");
  });
});

describe("CP3-5: context authorizations take reminders only", () => {
  it("each ILW context service says what it can hold", () => {
    expect(placingKind(findAppendix1("T2024U6")!)).toBe("reminders");
    expect(placingKind(findAppendix1("T2029U6")!)).toBe("reminders");
    expect(placingKind(findAppendix1("T2028U6")!)).toBe("reminders");
    expect(placingKind(findAppendix1("S5165U6")!)).toBe("reminders");
    // Financial management is authorization context only: nothing to place.
    expect(placingKind(findAppendix1("T2040U6")!)).toBe("none");
  });

  it("a reminder is accepted, is not billable, has no quantity and counts toward nothing", () => {
    const caseManagement = madeUp("T2024U6", 1);
    const plan: CarePlan = { ...planG(), others: [caseManagement] };
    const change = applyEvent(plan, { authorizationId: caseManagement.id!, kind: "REMINDER", date: "2026-11-10", note: "Call the case manager" }, PACK);
    expect(change.refusal).toBeUndefined();
    const reminder = eventsOf(change.plan, caseManagement.id!)[0]!;
    expect(reminder).toMatchObject({ kind: "REMINDER", billable: false, quantity: 0, note: "Call the case manager" });
    expect(eventLine(reminder)).toBe("Nov 10, 2026 · Reminder, not a visit · Call the case manager");
    expect(otherReasonLine(change.plan, caseManagement)).toBe("No caregiver time");
    expect(balanceText(otherAuthorization(caseManagement)!, planEvents(change.plan), "2026-11")).toBeNull();
    // It adds no minutes to any day of the week.
    expect(change.plan.services).toBe(plan.services);
  });

  it("any billable or shift-producing event on a context authorization is refused (EVT-03)", () => {
    const equipment = madeUp("T2029U6", 1);
    const plan: CarePlan = { ...planG(), others: [equipment] };
    for (const kind of ["NURSE_VISIT", "ADC_DAY", "MEAL_DELIVERY", "SFC_DAY"] as const) {
      const refused = place(plan, equipment, kind, "2026-11-10", kind === "ADC_DAY" ? 60 : 1);
      expect(refused.plan, kind).toBe(plan);
      expect(refused.refusal, kind).toBe("Not placed. This authorization has no caregiver time, so only a reminder can go on it.");
    }
  });

  it("fixture G's financial management has no control, and its unknown code can hold nothing", () => {
    const plan = planG();
    const unknown = otherByCode(plan, "H2015");
    expect(otherAuthorization(unknown)).toBeNull();
    expect(applyEvent(plan, { authorizationId: unknown.id!, kind: "REMINDER", date: "2026-11-10" }, PACK).refusal).toBe(
      "Not placed. That authorization isn't in this care plan.",
    );
  });
});

describe("a plan with no events reads as before", () => {
  it("fixture G has no events until the person places one", () => {
    const plan = planG();
    expect(planEvents(plan)).toEqual([]);
    expect(planOthers(plan).map((other) => otherReasonLine(plan, other))).toEqual([
      "Arranged by date", "Arranged by date", "No caregiver time", "Arranged by date", "Not recognized: kept for review",
    ]);
  });
});
