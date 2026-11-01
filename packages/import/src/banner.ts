import { MDY, ymd } from "./dates.js";

export interface Banner {
  name: string;
  dcn: string;
  start: string;
  end: string;
  totalCost: string | null;
  /** Where the banner starts in the text (SOURCE-01). */
  index: number;
}

// "NAME (DCN: 12345678) Care Plan: 08/01/2025 - 06/30/2026 Total Cost: $2468.56"
const BANNER_RE = new RegExp(
  "^[ \\t]*([^\\n(]{1,120}?)\\s*\\(DCN:\\s*(\\d{6,12})\\)\\s*Care Plan:\\s*" + MDY + "\\s*-\\s*" + MDY +
    "(?:\\s*Total Cost:\\s*\\$\\s*([\\d,]+\\.\\d{2}))?",
  "m",
);

/** IMP-02: the participant name, DCN and plan dates at the top of a care plan. */
export function readBanner(text: string): Banner | null {
  const m = BANNER_RE.exec(text);
  if (!m) return null;
  const [, name, dcn, m1, d1, y1, m2, d2, y2, cost] = m;
  return {
    name: name!.trim(),
    dcn: dcn!,
    start: ymd(m1!, d1!, y1!),
    end: ymd(m2!, d2!, y2!),
    totalCost: cost ? cost.replace(/,/g, "") : null,
    index: m.index,
  };
}
