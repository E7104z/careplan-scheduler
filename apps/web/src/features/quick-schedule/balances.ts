import { eventBalance } from "@careplan/engine";
import { formatUnits, monthName } from "../../lib/format";
import { serviceName } from "./carePlan.js";
import { quantityText } from "./eventText.js";
import { combinedRespiteFigure, monthBalance, monthFigures } from "./model.js";
import { otherName } from "./others.js";
import { eventAuthorizations, planEvents } from "./planEvents.js";
import type { CarePlan, QuickModel } from "./types.js";

/** One authorization's month, in its own unit. */
export interface BalanceRow {
  authorizationId: string;
  name: string;
  authorized: string;
  /** Scheduled (services in the week) or placed (dated events). */
  used: string;
  left: string;
}

/**
 * APP-SPEC 5.8 "Authorization balances": for each authorization in the month, what is authorized,
 * what is scheduled or placed, and what is left, each in its own unit. A service in the week is
 * in 15-minute units from the engine's month figures; a dated service is in visits, meals,
 * covered days or time attended. An authorization with no figure for the month isn't listed.
 */
export function balanceRows(plan: CarePlan, models: QuickModel[], month: string): BalanceRow[] {
  const rows: BalanceRow[] = [];
  plan.services.forEach((state, index) => {
    const model = models[index]!;
    if (!model.months.includes(month)) return;
    const figures = monthFigures(model, month);
    const { scheduledMinutes, leftMinutes } = monthBalance(figures);
    rows.push({
      authorizationId: state.id,
      name: serviceName(state, model),
      authorized: `${figures.authorizedUnits} ${figures.authorizedUnits === 1 ? "unit" : "units"}`,
      used: `${formatUnits(scheduledMinutes)} scheduled`,
      left: leftMinutes < 0 ? `${formatUnits(-leftMinutes)} over` : `${formatUnits(leftMinutes)} left`,
    });
  });
  const names = new Map<string | undefined, string>([
    ...plan.visits.map((visit) => [visit.id, visit.label ?? visit.name] as const),
    ...(plan.others ?? []).map((other) => [other.id, otherName(other)] as const),
  ]);
  for (const authorization of eventAuthorizations(plan)) {
    const balance = eventBalance(authorization, planEvents(plan), month);
    if (balance.authorized === null || balance.left === null || balance.unit === "none") continue;
    rows.push({
      authorizationId: authorization.id,
      name: names.get(authorization.id) ?? "Service",
      authorized: quantityText(balance.unit, balance.authorized),
      used: `${quantityText(balance.unit, balance.placed)} placed`,
      left: `${quantityText(balance.unit, balance.left)} left`,
    });
  }
  return rows;
}

/** "Next nurse visit to place: General Health Evaluation, May 2026", or null when none is waiting. */
export function nextVisitNeeded(plan: CarePlan, currentMonth: string): string | null {
  const events = planEvents(plan);
  const waiting = plan.visits
    .filter((visit) => visit.id !== undefined && visit.end.slice(0, 7) >= currentMonth)
    .filter((visit) => events.filter((event) => event.authorizationId === visit.id && event.kind === "NURSE_VISIT").length < visit.units)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))[0];
  return waiting ? `Next nurse visit to place: ${waiting.name}, ${monthName(waiting.start.slice(0, 7))}` : null;
}

/** "Basic and Advanced Respite together: 640 of 868 units in November 2026" (AUTH-09's own figure), or null. */
export function respiteLine(models: QuickModel[], month: string): string | null {
  const combined = combinedRespiteFigure(models, month);
  return combined ? `Basic and Advanced Respite together: ${combined.units} of ${combined.ceiling} units in ${monthName(month)}` : null;
}

/** The plan's months, first to last: every service's scheduled months and every month with an event. */
export function calendarMonths(plan: CarePlan, models: QuickModel[]): string[] {
  const months = new Set<string>(models.flatMap((model) => model.months));
  for (const event of planEvents(plan)) months.add(event.date.slice(0, 7));
  return [...months].sort();
}
