import { projectAccrual, type AccrualProjection, type AccrualUnit } from "@careplan/engine";
import { monthName, niceDate } from "../../lib/format";
import { monthFigures } from "./model";
import type { QuickModel } from "./types";

/** APP-SPEC accrual section title, exactly as required. */
export const ACCRUAL_SECTION_TITLE = "Projected Accruals — Subject to Actual EVV Verification";

/** The one-line note on every agency accrual section. */
export const ACCRUAL_NOTE = "Accrued minutes are used in the month they are earned and do not carry over.";

/** The screen footnote: a projection, never an actual AMV. */
export const ACCRUAL_FOOTNOTE = "A projection from scheduled minutes. Actual accrual depends on delivered, verified EVV time.";

/** \"Nov 7\" from \"Nov 7, 2026\": the month is in the section's own heading. */
function shortDay(iso: string): string {
  return niceDate(iso).replace(/, \d+$/, "");
}

/**
 * ACC-01..ACC-06: one service's read-only projection for a month. The source of truth is the
 * engine's expanded map from `monthFigures`, which already holds month-end cuts and one-day changes.
 */
export function serviceAccrual(model: QuickModel, month: string): AccrualProjection {
  return projectAccrual(monthFigures(model, month).expanded);
}

/** One projection per service, in the plan's order. Accrual is never summed across services. */
export function planAccrual(models: QuickModel[], month: string): AccrualProjection[] {
  return models.map((model) => serviceAccrual(model, month));
}

/** \"November 2026: 143 projected accrued minutes = 9 potential AMV units, with 8 minutes remaining.\" */
export function accrualSentence(month: string, projection: AccrualProjection): string {
  const minutes = projection.accruedMinutes === 1 ? "minute" : "minutes";
  const units = projection.potentialAmvUnits === 1 ? "unit" : "units";
  const remaining = projection.remainingMinutes === 1 ? "minute" : "minutes";
  return `${monthName(month)}: ${projection.accruedMinutes} projected accrued ${minutes} = ${projection.potentialAmvUnits} potential AMV ${units}, with ${projection.remainingMinutes} ${remaining} remaining.`;
}

/** \"Unit 1 available Nov 7 — Nov 1 (10 min) + Nov 7 (5 min)\". */
export function accrualUnitText(unit: AccrualUnit): string {
  const parts = unit.contributions.map((contribution) => `${shortDay(contribution.date)} (${contribution.minutes} min)`).join(" + ");
  return `Unit ${unit.number} available ${shortDay(unit.availableOn)} — ${parts}`;
}

/** \"8 minutes remain: Nov 29 (5 min) + Nov 30 (3 min). These do not carry over to the next month.\", or \"\". */
export function accrualRemainingText(projection: AccrualProjection): string {
  if (projection.remainingMinutes === 0) return "";
  const parts = projection.remainingContributions
    .map((contribution) => `${shortDay(contribution.date)} (${contribution.minutes} min)`)
    .join(" + ");
  const noun = projection.remainingMinutes === 1 ? "minute remains" : "minutes remain";
  return `${projection.remainingMinutes} ${noun}: ${parts}. These do not carry over to the next month.`;
}
