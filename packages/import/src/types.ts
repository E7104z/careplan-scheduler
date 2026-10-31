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
  /** The care plan report's authorized units for each month (IMP-17); null from the care plan screen. */
  monthly: { start: string; end: string; units: number }[] | null;
}

/** A visit authorization from the care plan report (IMP-18), such as a General Health Evaluation. */
export interface ImportedVisit {
  label: string | null;          // "GHE"
  serviceCode: ServiceCode;      // a visit in the rule pack, such as T1001
  name: string | null;           // the task row: "General Health Evaluation"
  provider: string | null;
  start: string; end: string;    // YYYY-MM-DD: the period it is authorized for
  units: number;                 // visits authorized in that period
  pa: string | null;
}

export type ImportIssueCode =
  | "no-rows" | "incomplete" | "unknown-service" | "no-plan-dates" | "bad-dates"
  | "different-participant" | "unread-row" | "unknown-task" | "odd-minutes" | "duplicate-task"
  | "not-scheduled"
  // Set by the app, which knows today's date (the reader has no clock): the plan ended before this month.
  | "plan-ended";

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
  /** Visits authorized in the report (IMP-18); the care plan screen has none. */
  visits: ImportedVisit[];
  issues: ImportIssue[];
}

/** A pdf.js text item reduced to what IMP-14 needs. y grows upward, as in PDF space. */
export interface PdfTextItem { str: string; x: number; y: number; width: number; height: number; }
