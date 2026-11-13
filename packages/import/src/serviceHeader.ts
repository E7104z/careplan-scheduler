import { MDY, ymd } from "./dates.js";
import type { SourceRef } from "./types.js";
import { lineAt } from "./provenance.js";

export interface ServiceHeader {
  /** Where the header starts in the text, and where it ends (rows begin after `textEnd`). */
  index: number;
  textEnd: number;
  label: string;
  provider: string;
  phone: string | null;
  start: string;
  end: string;
  units: number;
  cost: string | null;
  pa: string | null;
  /** Where the header was read (SOURCE-01). */
  source: SourceRef;
}

// "PC - CDS | PROVIDER | 5555550100 | 12/01/2025 - 10/31/2026 | 455 units | $2,436.53 | PA: 2025..."
const HEADER_RE = new RegExp(
  "([A-Z]{2,6}\\s*-\\s*[A-Z][A-Za-z]*(?:[ ][A-Z][A-Za-z]*)*)\\s*\\|\\s*([^|\\n]*?)\\s*\\|\\s*(?:(\\d{10})\\s*\\|\\s*)?" +
    MDY + "\\s*-\\s*" + MDY +
    "\\s*\\|\\s*(\\d{1,4})\\s*units\\s*(?:\\|\\s*\\$\\s*([\\d,]+\\.\\d{2})\\s*)?(?:\\|\\s*PA:\\s*(\\d+))?",
  "g",
);

/** IMP-04: every service group row in the text, in order. */
export function readHeaders(text: string, page = 1): ServiceHeader[] {
  return [...text.matchAll(HEADER_RE)].map((m) => {
    const [whole, label, provider, phone, m1, d1, y1, m2, d2, y2, units, cost, pa] = m;
    return {
      index: m.index,
      textEnd: m.index + whole.length,
      label: label!.replace(/\s*-\s*/, " - ").trim(),
      provider: provider!.trim(),
      phone: phone ?? null,
      start: ymd(m1!, d1!, y1!),
      end: ymd(m2!, d2!, y2!),
      units: Number(units),
      cost: cost ? cost.replace(/,/g, "") : null,
      pa: pa ?? null,
      source: { page, line: lineAt(text, m.index) },
    };
  });
}
