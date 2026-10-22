import type { ServiceCode } from "@careplan/engine";

export interface ImportedTask {
  name: string;            // rule-pack name when matched, else the Fusion name
  fusionName: string;      // exactly as read
  taskCode: string | null; // null when not in the rule pack
  minPerDay: number;
  daysPerWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export interface ImportedService {
  label: string | null;          // "PC - CDS"; null when the paste had no group row
  serviceCode: ServiceCode | null;
  provider: string | null; phone: string | null;
  start: string | null; end: string | null;   // YYYY-MM-DD
  units: number;                 // Fusion's monthly units
  cost: string | null; pa: string | null;
  tasks: ImportedTask[];
  transport: { unitsPerMonth: number; minutesPerMonth: number } | null;
  unread: { raw: string; reason: "unreadable" | "task-numbers" | "transport-numbers" }[];
}

export type ImportIssueCode =
  | "no-rows" | "incomplete" | "unknown-service" | "no-plan-dates" | "bad-dates"
  | "different-participant" | "unread-row" | "unknown-task" | "odd-minutes" | "duplicate-task";

export interface ImportIssue {
  level: "error" | "input" | "warn"; code: ImportIssueCode; message: string;
  have?: number; total?: number; label?: string; name?: string; raw?: string;
}

/** One "Showing <from> to <to> of <total> entries" line (IMP-03). */
export interface PagingEntry { from: number; to: number; total: number; }

export interface ImportResult {
  participant: { name: string; dcn: string } | null;
  plan: { start: string; end: string } | null;
  totalCost: string | null;
  paging: PagingEntry[];
  services: ImportedService[];
  issues: ImportIssue[];
}

/** A pdf.js text item reduced to what IMP-14 needs. y grows upward, as in PDF space. */
export interface PdfTextItem { str: string; x: number; y: number; width: number; height: number; }
