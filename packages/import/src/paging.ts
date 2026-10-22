import type { PagingEntry } from "./types.js";

// "Showing 1 to 10 of 14 entries" (Fusion shows 10 rows per page).
const PAGING_RE = /Showing\s+(\d+)\s+to\s+(\d+)\s+of\s+(\d+)\s+entries/gi;

/** IMP-03: every paging line in the text. */
export function readPaging(text: string): PagingEntry[] {
  return [...text.matchAll(PAGING_RE)].map((m) => ({
    from: Number(m[1]),
    to: Number(m[2]),
    total: Number(m[3]),
  }));
}

/** IMP-03: the plan's row count is the largest `n`; null when no paging line was pasted. */
export function pagingTotal(paging: PagingEntry[]): number | null {
  return paging.length ? Math.max(...paging.map((p) => p.total)) : null;
}
