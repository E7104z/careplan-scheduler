import type { DaysPerWeek } from "../math/factors.js";
import type { RulePack } from "../rulepacks/types.js";

/** An exact value num / den, as the worksheet's division gives it before Excel rounds it for display. */
export interface Fraction {
  num: number;
  den: number;
}

/** One worksheet task row (HCBS-3c columns L–Q; HCBS-3a columns G–N). */
export interface WorksheetRowMath {
  /** Min/Day ÷ 15, or null when Days/Wk is blank (the sheet shows nothing). */
  unitsPerDay: Fraction | null;
  /** Min/Day × Days/Wk ÷ 15 (0 when either is blank, as the sheet computes it). */
  unitsPerWeek: Fraction;
  unitsPerDayDisplay: string;
  unitsPerWeekDisplay: string;
  maxDaysPerMonth: number | null;
  /** ROUNDUP(Units/Day × Max Days/Mo), or null when Days/Wk is blank. */
  totalUnits: number | null;
  formulaText: string;
}

export const MINUTES_ISSUE = "Enter whole minutes from 0 to 1,440.";
export const DAYS_ISSUE = "Choose 1 to 7 days.";

const MAX_MINUTES_PER_DAY = 24 * 60;

export function isWholeMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_MINUTES_PER_DAY;
}

export function isDaysPerWeek(value: number): value is DaysPerWeek {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}

/** Excel's "0.0" number format: one decimal, halves rounded away from zero, no thousands separator. */
export function oneDecimal(value: Fraction): string {
  const tenths = Math.floor((value.num * 20 + value.den) / (2 * value.den));
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

/** Whole numbers with a thousands separator, as the worksheet's "General" cells print them in en-US. */
export function wholeNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** Cents as dollars with a thousands separator, as the worksheet's currency cells print them: "$1,234.56". */
export function dollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${wholeNumber(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * The worksheet's task-row arithmetic with integer math (`.clinerules` 11). Both forms use it:
 * units = ROUNDUP(minPerDay / 15 × maxDays) computed as floor((minPerDay × maxDays + 14) / 15).
 * Inputs must already be valid (whole minutes 0–1,440; days 1–7 or null). `unit` names what is
 * counted per day: "min" on task rows, "units" on the 3a's Home Delivered Meals row.
 */
export function rowMath(
  perDay: number | null,
  daysPerWeek: DaysPerWeek | null,
  pack: RulePack,
  unit: "min" | "units" = "min",
): WorksheetRowMath {
  const divisor = unit === "min" ? 15 : 1;
  const amount = perDay ?? 0;
  const unitsPerWeek = { num: amount * (daysPerWeek ?? 0), den: divisor };
  if (daysPerWeek === null) {
    return {
      unitsPerDay: null, unitsPerWeek, unitsPerDayDisplay: "", unitsPerWeekDisplay: oneDecimal(unitsPerWeek),
      maxDaysPerMonth: null, totalUnits: null, formulaText: "No days a week entered, so this row counts nothing.",
    };
  }
  const maxDays = pack.daysPerMonthFactor[daysPerWeek];
  const product = amount * maxDays;
  const totalUnits = Math.floor((product + divisor - 1) / divisor);
  return {
    unitsPerDay: { num: amount, den: divisor },
    unitsPerWeek,
    unitsPerDayDisplay: oneDecimal({ num: amount, den: divisor }),
    unitsPerWeekDisplay: oneDecimal(unitsPerWeek),
    maxDaysPerMonth: maxDays,
    totalUnits,
    formulaText: formulaText(amount, maxDays, divisor, totalUnits, unit),
  };
}

function formulaText(amount: number, maxDays: number, divisor: number, totalUnits: number, unit: "min" | "units"): string {
  const left = unit === "min" ? `${wholeNumber(amount)} min ÷ 15 × ${maxDays} days` : `${wholeNumber(amount)} units a day × ${maxDays} days`;
  const product = amount * maxDays;
  if (product % divisor === 0) return `${left} = ${wholeNumber(totalUnits)} ${totalUnits === 1 ? "unit" : "units"}`;
  return `${left} = ${oneDecimal({ num: product, den: divisor })}, rounded up to ${wholeNumber(totalUnits)} ${totalUnits === 1 ? "unit" : "units"}`;
}
