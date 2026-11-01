export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;            // 0 = Sunday
export type Severity = "BLOCK" | "WARN" | "INFO" | "REVIEW";
export type ProgramCode =
  | "CDS" | "ILW" | "AGENCY_PC" | "APC" | "NURSE" | "HOMEMAKER" | "CHORE" | "RESPITE";
export type ServiceCode =
  | "T1019U2" | "T1019U6" | "T1019" | "T1019TF" | "T1001"
  | "S5130" | "S5120" | "S5150" | "S5150TF";
export type AuthState =
  | "active" | "future" | "partial" | "suspended" | "expired" | "pending_approval";
export type WaiverCode = "ILW" | "ADW" | "ADCW" | "SFCW";

export interface AuthorizedTask {
  id: string;                     // stable, scoped to its authorization (SCH-13)
  serviceAuthId: string;
  taskCode: string;               // from the rule-pack task library
  name: string;                   // display only, never a key
  minPerDay: number;              // integer minutes per occurrence
  daysPerWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export interface ServiceAuthorization {
  id: string;
  participantId: string;
  program: ProgramCode;
  serviceCode: ServiceCode;
  start: string;                  // YYYY-MM-DD
  end: string;                    // YYYY-MM-DD
  state: AuthState;
  suspensions: { start: string; end: string }[];
  receivedDate?: string;          // CON-13
  revision: number;
  tasks: AuthorizedTask[];
  transportMinutesPerMonth?: number;
  migratedFromWebTool?: boolean;  // AUTH-06
}

export interface MonthlyAuthorization {
  serviceAuthId: string;
  month: string;                  // YYYY-MM
  units: number;
  source: "fusion" | "derived";
  method?: "hcbs3c-roundup" | "workbook-trunc099" | "short-month";
  revision: number;
}

export interface TemplateEntry { taskId: string; weekday: Weekday; minutes: number; }
export interface ScheduleTemplate {
  id: string;
  participantId: string;
  start: string; end: string;
  entries: TemplateEntry[];
  rulePackVersion: string;
}
/** A dated one-time/intermittent occurrence (e.g. ADW Chore S5120), never a weekly template. */
export interface DatedOccurrence {
  id: string;
  serviceAuthId: string;
  date: string;   // YYYY-MM-DD
  minutes: number;
}
/** A respite coverage block: a start/end span of care (Policy 3.50), never 15-minute task units. */
export interface CoverageBlock {
  id: string;
  serviceAuthId: string;
  start: string;  // local ISO "YYYY-MM-DDTHH:mm", America/Chicago
  end: string;
}
/** A dated adult day care attendance event (ADW-03): attendance minutes plus its transport part. */
export interface AdcAttendance {
  id: string;
  serviceAuthId: string;
  date: string;              // YYYY-MM-DD
  minutes: number;           // attendance minutes, whole, in 15-minute steps
  transportMinutes: number;  // the transport part, whole minutes
}
/** A dated home delivered meals delivery (ADW-04): a whole number of meals, never minutes. */
export interface HdmDelivery {
  id: string;
  serviceAuthId: string;
  date: string;              // YYYY-MM-DD
  meals: number;             // whole meals
}
export interface CalendarException {
  id: string; participantId: string; date: string;
  taskId: string; minutesDelta: number;   // + adds, - removes on that date
  reason: string; author: string; createdAt: string;
  kind?: "change" | "fit";                // Amendment A: "fit" = automatic trim from SCH-17; absent = "change"
}
export interface Visit {
  id: string; participantId: string; caregiverId: string;
  serviceCode: ServiceCode;
  start: string; end: string;     // local ISO "YYYY-MM-DDTHH:mm", America/Chicago
  taskIds: string[];
}
export interface Caregiver {
  id: string;
  relationships: Record<string, "spouse" | "legal_guardian" | "parent" | "sibling"
    | "child" | "stepchild" | "grandparent" | "grandchild" | "other_family" | "none">;
  agencyEmployee?: boolean;
  nurseLicense?: boolean;
  fcsrRegistered?: boolean;
}
export interface WaiverEnrollment { participantId: string; waiver: WaiverCode; start: string; end: string; }
export interface ValidationResult {
  ruleId: string; severity: Severity; message: string;
  refs: {
    taskId?: string; visitId?: string; date?: string; month?: string; serviceAuthId?: string;
    participantId?: string;
    taskCode?: string;            // worksheet rules (Amendment C): the row's task
    line?: string;                // worksheet rules: a 3a line with no task (adult day care, meals…)
  };
}
