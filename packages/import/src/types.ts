import type { ServiceCode } from "@careplan/engine";

/**
 * SOURCE-01: where a value was read. `page` is the 1-based paste (or PDF page) and `line` the
 * 1-based line within that page's text. Provenance only; never a key or an identity.
 */
export interface SourceRef {
  page: number;
  line: number;
}

export interface ImportedTask {
  name: string;            // rule-pack name when matched, else the Fusion name
  fusionName: string;      // exactly as read
  taskCode: string | null; // null when not in the rule pack
  minPerDay: number;
  daysPerWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** The row exactly as read (SOURCE-01 raw view). */
  raw: string;
  /** Where the row was read (SOURCE-01). */
  source: SourceRef;
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
  /** Where the service was read (SOURCE-01). */
  source: SourceRef;
}

/** A visit authorization from the care plan report (IMP-18), such as a General Health Evaluation. */
export interface ImportedVisit {
  label: string | null;          // "GHE"
  serviceCode: ServiceCode;      // a visit in the rule pack, such as T1001
  name: string | null;           // its task rows' names: "Eval APC Plan, Train APC"
  /** Every task row, with its visits a month (#Units/Month), or null when the row has no number. */
  tasks: { name: string; unitsPerMonth: number | null }[];
  provider: string | null;
  start: string; end: string;    // YYYY-MM-DD: the period it is authorized for
  units: number;                 // visits authorized in that period
  pa: string | null;
  /** Where the visit was read (SOURCE-01). */
  source: SourceRef;
}

/**
 * IMP-19: an authorization the schedule doesn't place, kept with the plan so nothing in it is
 * lost: one of DHSS's Appendix 1 services Quick Schedule doesn't schedule yet (meals, adult day
 * care, an RCF/ALF service, an ILW support...), or a code outside Appendix 1.
 */
export interface ImportedOther {
  label: string | null;
  /** The procedure code exactly as Fusion printed it. */
  code: string | null;
  /** The Appendix 1 service, or null for a code outside its 21 services. */
  registryId: string | null;
  provider: string | null;
  pa: string | null;
  start: string | null; end: string | null;   // YYYY-MM-DD
  monthly: { start: string; end: string; units: number }[];
  /** Its task rows, exactly as read. */
  rows: string[];
  /** Where the authorization was read (SOURCE-01). */
  source: SourceRef;
}

export type ImportIssueCode =
  | "no-rows" | "nothing-to-schedule" | "kept" | "incomplete" | "unknown-service" | "no-plan-dates" | "bad-dates"
  | "different-participant" | "unread-row" | "unknown-task" | "odd-minutes" | "duplicate-task"
  | "not-scheduled"
  // A nurse visit authorization whose tasks add up to more or fewer visits a month than Fusion authorized.
  | "visit-units"
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
  /** Authorizations kept but not scheduled (IMP-19). */
  others: ImportedOther[];
  issues: ImportIssue[];
  /** Where the participant, plan and total cost were read (SOURCE-01); null when absent. */
  sources: {
    participant: SourceRef | null;
    plan: SourceRef | null;
    totalCost: SourceRef | null;
  };
}

/** A pdf.js text item reduced to what IMP-14 needs. y grows upward, as in PDF space. */
export interface PdfTextItem { str: string; x: number; y: number; width: number; height: number; }
