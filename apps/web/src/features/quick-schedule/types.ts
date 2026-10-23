import type {
  AuthorizedTask,
  CalendarException,
  DaysPerWeek,
  MonthlyAuthorization,
  ScheduleTemplate,
  ServiceAuthorization,
  ServiceCode,
  ServiceDef,
  Severity,
  TemplateEntry,
  ValidationResult,
  Weekday,
} from "@careplan/engine";
import type { ImportIssue } from "@careplan/import";

export interface Plan {
  start: string;
  end: string;
}

export interface QuickTask {
  id: string;
  taskCode: string | null;
  name: string;
  /** null = left out of the schedule until a valid number is entered (QS-05). */
  minPerDay: number | null;
  daysPerWeek: DaysPerWeek;
  pinned: Weekday[] | null;
  locked: boolean;
}

export interface FusionTransport {
  minutesPerMonth: number;
  day: Weekday;
}

export interface ManualTransport {
  minPerTrip: number;
  tripsPerWeek: DaysPerWeek;
  day: Weekday;
}

export type QuickTransport = FusionTransport | ManualTransport;

/** APP-SPEC 5.6. `identity` lives in memory only and is never persisted. */
export interface QuickState {
  source: "fusion" | "manual";
  identity: { name: string; dcn: string } | null;
  provider: string | null;
  pa: string | null;
  serviceLabel: string | null;
  serviceCode: ServiceCode;
  plan: Plan;
  headerUnits: number | null;
  tasks: QuickTask[];
  nextId: number;
  activeDays: boolean[]; // length 7, index 0 = Sunday
  transport: QuickTransport;
  edits: Record<string, number>; // `${taskId}:${weekday}` -> minutes
  fusion: Record<string, number>; // month -> units (QS-11, by hand only)
  viewMonth: string;
  isExample: boolean;
  notes: ImportIssue[];
  rowsRead: number;
}

export interface QuickAllowance {
  minutesPerMonth: number;
  units: number;
  unallocatedMinutes: number;
  weeklyMinutes: number;
}

export interface QuickChecksum {
  fusion: number;
  byMonthLength: Record<string, number>;
  matches: boolean;
}

export interface QuickModel {
  svc: ServiceDef;
  tasks: AuthorizedTask[];
  entries: TemplateEntry[];
  auth: ServiceAuthorization;
  template: ScheduleTemplate;
  trims: CalendarException[];
  allowance: QuickAllowance | null;
  months: string[];
  monthlyAuthorizations: MonthlyAuthorization[];
  results: ValidationResult[];
  checksum: QuickChecksum | null;
}

export interface MonthFigures {
  expanded: Record<string, Record<string, number>>;
  authorizedUnits: number;
  source: "fusion" | "calculated";
  calculatedUnits: number;
  transportUnits: number;
  taskBudgetMinutes: number;
  scheduledTaskMinutes: number;
  over: boolean;
  trims: CalendarException[];
  trimmedMinutes: number;
}

export interface CheckGroup {
  ruleId: string;
  severity: Severity;
  taskId?: string;
  months: string[];
  messages: string[];
  rulePackVersion: string;
}
