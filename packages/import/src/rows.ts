import type { RulePack } from "@careplan/engine";
import { matchTask } from "./taskMatch.js";
import type { ImportedService, ImportedTask, SourceRef } from "./types.js";
import { newlinesIn } from "./provenance.js";

export type UnreadReason = ImportedService["unread"][number]["reason"];

export type ReadRow =
  | { kind: "task"; task: ImportedTask }
  | { kind: "transport"; raw: string; unitsPerMonth: number; minutesPerMonth: number }
  | { kind: "unread"; raw: string; reason: UnreadReason };

// Text that follows the table on screen and must not be read as part of the last row.
const TAIL_RE = /(Showing\s+\d+\s+to\s+\d+|\bPrevious\b|\bNext\b|Search:|Export\s*\.\.\.|Total Units\s*Task Type)/i;

/** IMP-05: cut a row's text at the first part of the page that follows the table. */
export function cutTail(chunk: string): string {
  const m = TAIL_RE.exec(chunk);
  return m ? chunk.slice(0, m.index) : chunk;
}

function isDaysPerWeek(n: number): n is ImportedTask["daysPerWeek"] {
  return Number.isInteger(n) && n >= 1 && n <= 7;
}

/** A row split into its name and numbers: `nums` for separated cells, `digits` for one run. */
interface RowParts { name: string; nums: number[]; digits: string | null; }

/** IMP-06: split a row with tabs, pipes or 2+ spaces into cells, or read a single-space/run-together row. */
function splitRow(raw: string): RowParts | null {
  if (raw.includes("\t") || raw.includes("|") || / {2,}/.test(raw)) {
    const cells = raw.split(/\t| *\| *| {2,}/).map((cell) => cell.trim());
    const name = cells[0];
    if (!name || /\d/.test(name)) return null;
    const nums = cells.slice(1).filter((cell) => /^\d+$/.test(cell)).map(Number);
    return { name, nums, digits: null };
  }
  const m = /^(.*?[^\d\s])\s*([\d\s]*)$/.exec(raw);
  if (!m) return null;
  const name = m[1]!.trim();
  const rest = m[2]!.trim();
  // Single spaces between numbers are separate cells; no spaces at all is a run-together copy.
  if (/\s/.test(rest)) return { name, nums: rest.split(/\s+/).map(Number), digits: null };
  return { name, nums: [], digits: rest || null };
}

/** IMP-08: the (units, minutes) pair where floor(minutes / 15) = units, or null. */
function transportNumbers(parts: RowParts): { units: number; minutes: number } | null {
  const pairs: [number, number][] = [];
  if (parts.digits) {
    // Run-together: try every split point.
    for (let k = 1; k < parts.digits.length; k++) {
      pairs.push([Number(parts.digits.slice(0, k)), Number(parts.digits.slice(k))]);
    }
  } else {
    for (const [a, units] of parts.nums.entries()) {
      for (const [b, minutes] of parts.nums.entries()) if (a !== b) pairs.push([units, minutes]);
    }
  }
  const found = pairs.find(([units, minutes]) => minutes > 0 && Math.floor(minutes / 15) === units);
  return found ? { units: found[0], minutes: found[1] } : null;
}

/** IMP-07: minutes per day and days per week, or null when they are missing or out of range. */
function taskNumbers(parts: RowParts): { minPerDay: number; daysPerWeek: ImportedTask["daysPerWeek"] } | null {
  let minPerDay: number;
  let days: number;
  if (parts.digits) {
    // Run-together: the last digit is days per week, the digits before it are minutes per day.
    if (parts.digits.length < 2) return null;
    days = Number(parts.digits.slice(-1));
    minPerDay = Number(parts.digits.slice(0, -1));
  } else {
    const [first, second] = parts.nums;
    if (first === undefined || second === undefined) return null;
    minPerDay = first;
    days = second;
  }
  if (!isDaysPerWeek(days) || !(minPerDay >= 1 && minPerDay <= 1440)) return null;
  return { minPerDay, daysPerWeek: days };
}

/** IMP-05 to IMP-08: one row of the table, in any of the clipboard shapes. Null for an empty chunk. */
export function readRow(chunk: string, pack: RulePack, source: SourceRef): ReadRow | null {
  const raw = cutTail(chunk).replace(/^[\s|]+|[\s|]+$/g, "");
  if (!raw) return null;
  const parts = splitRow(raw);
  if (!parts) return { kind: "unread", raw, reason: "unreadable" };

  const def = matchTask(pack, parts.name);
  const isTransport = def ? def.isTransport === true : /transport/i.test(parts.name);
  if (isTransport) {
    const found = transportNumbers(parts);
    if (!found) return { kind: "unread", raw, reason: "transport-numbers" };
    return { kind: "transport", raw, unitsPerMonth: found.units, minutesPerMonth: found.minutes };
  }

  const numbers = taskNumbers(parts);
  if (!numbers) return { kind: "unread", raw, reason: "task-numbers" };
  return {
    kind: "task",
    task: {
      name: def ? def.name : parts.name,
      fusionName: parts.name,
      taskCode: def ? def.taskCode : null,
      ...numbers,
      raw,
      source,
    },
  };
}

/**
 * IMP-05: split a service's text on `<units>\s*units`, using that service's own units so that
 * run-together text splits exactly (the match can only start where "units" follows), and read
 * each piece after the first as a row. `firstLine` is the 1-based line the region starts on.
 */
export function readRows(region: string, units: number, pack: RulePack, page: number, firstLine: number): ReadRow[] {
  const marker = new RegExp(`${units}\\s*units`, "gi");
  const matches = [...region.matchAll(marker)];
  return matches.flatMap((match, i) => {
    const start = match.index + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index : region.length;
    const line = firstLine + newlinesIn(region.slice(0, match.index));
    const row = readRow(region.slice(start, end), pack, { page, line });
    return row ? [row] : [];
  });
}

/** IMP-05: with no group row, the units are the most frequent `<n> units` in the text. */
export function mostCommonUnits(text: string): number | null {
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/(\d{1,4})\s*units/gi)) {
    counts.set(m[1]!, (counts.get(m[1]!) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [units, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) best = units;
  }
  return best === null ? null : Number(best);
}
