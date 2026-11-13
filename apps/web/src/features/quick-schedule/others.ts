import { APPENDIX_1, type Appendix1Service } from "@careplan/engine";
import { shortMonth } from "../../lib/format";
import type { CarePlan, PlanOther } from "./types";

/** The Appendix 1 service a kept authorization is, if it's one of the 21. */
export function otherService(other: PlanOther): Appendix1Service | undefined {
  return other.registryId ? APPENDIX_1.find((service) => service.id === other.registryId) : undefined;
}

/** "HDM", else the code, else the service's name. */
export function otherName(other: PlanOther): string {
  return other.label ?? other.code ?? otherService(other)?.name ?? "Service";
}

/** "Home Delivered Meals · S5170", or "Not an Appendix 1 service · H2015". */
export function otherDetail(other: PlanOther): string {
  const service = otherService(other);
  const what = service ? service.name : other.code ? "Not an Appendix 1 service" : "Kept without a schedule";
  return other.code ? `${what} · ${other.code}` : what;
}

/** Why it isn't in the week, in the words the read summary uses (IMP-19). */
export function otherReason(other: PlanOther): string {
  const service = otherService(other);
  if (!service) return other.code ? "Not recognized: kept for review" : "Kept without a schedule";
  if (service.scheduleClass === "CONTEXT") return "No caregiver time";
  if (service.scheduleClass === "APPOINTMENT") return "Arranged by date";
  return "Not scheduled by Quick Schedule yet";
}

const UNIT_WORDS: Record<Appendix1Service["unit"], [one: string, many: string]> = {
  "15min": ["unit", "units"],
  visit: ["visit", "visits"],
  meal: ["meal", "meals"],
  month: ["unit", "units"],
  actual_cost: ["unit", "units"],
  day: ["covered day", "covered days"],
};

/** "62 meals a month, Nov 2026 to Apr 2027", or each month when they differ: "1 visit in Dec 2026". */
export function otherAmount(other: PlanOther): string {
  const [one, many] = UNIT_WORDS[otherService(other)?.unit ?? "15min"];
  const amount = (units: number) => `${units} ${units === 1 ? one : many}`;
  const months = other.monthly;
  if (months.length === 0) return "No monthly figures in the care plan";
  if (months.length === 1) return `${amount(months[0]!.units)} in ${shortMonth(months[0]!.start.slice(0, 7))}`;
  const first = months[0]!.units;
  if (months.every((month) => month.units === first)) {
    return `${amount(first)} a month, ${shortMonth(months[0]!.start.slice(0, 7))} to ${shortMonth(months.at(-1)!.start.slice(0, 7))}`;
  }
  return months.map((month) => `${amount(month.units)} in ${shortMonth(month.start.slice(0, 7))}`).join("; ");
}

/** How many billable dates are placed against a kept authorization (reminders are notes, not dates of service). */
export function placedDates(plan: CarePlan, other: PlanOther): number {
  if (other.id === undefined) return 0;
  return (plan.events ?? []).filter((event) => event.authorizationId === other.id && event.billable).length;
}

/** "Arranged by date", with the count once dates are placed: "Arranged by date · 3 dates placed". */
export function otherReasonLine(plan: CarePlan, other: PlanOther): string {
  const reason = otherReason(other);
  const placed = placedDates(plan, other);
  return placed > 0 ? `${reason} · ${placed} ${placed === 1 ? "date" : "dates"} placed` : reason;
}

/** The kept authorizations of a plan; plans saved before IMP-19 have none. */
export function planOthers(plan: CarePlan): PlanOther[] {
  return plan.others ?? [];
}

/** One line per kept authorization, for the printout: "HDM (Home Delivered Meals · S5170): 62 meals a month… Arranged by date." */
export function otherLines(plan: CarePlan): string[] {
  return planOthers(plan).map(
    (other) => `${otherName(other)} (${otherDetail(other)}): ${otherAmount(other)}. ${otherReason(other)}.`,
  );
}
