import type {
  AuthorizedTask,
  CalendarException,
  DaysPerWeek,
  MonthlyAuthorization,
  ScheduleTemplate,
  ScheduleValidationResult,
  ServiceAuthorization,
  ServiceCode,
  ServiceDef,
  Severity,
  TemplateEntry,
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
  /** null = we choose the days; [] = the person unselected every day (off the week for now). */
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
  fusion: Record<string, number>; // month -> units (QS-11 by hand, or Fusion's care plan report, IMP-17)
  /**
   * YYYY-MM: the month the schedule was built. A schedule is for care still to come, so it covers
   * the plan from this month (or from the plan's first month, if that is later).
   */
  fromMonth: string;
  viewMonth: string;
  /** YYYY-MM-DD the person went over this schedule with the participant (INFO 09-25-02); null if not. */
  reviewed: string | null;
  isExample: boolean;
  notes: ImportIssue[];
  rowsRead: number;
}

/** A visit authorization read from Fusion's care plan report, such as a General Health Evaluation. */
export interface PlanVisit {
  /** Fusion's label: "GHE". */
  label: string | null;
  serviceCode: ServiceCode;
  /** "General Health Evaluation". */
  name: string;
  provider: string | null;
  /** YYYY-MM-DD: the period the visit is authorized for (one month, on Fusion's report). */
  start: string;
  end: string;
  units: number;
  pa: string | null;
}

/**
 * APP-SPEC 5.8: the participant's whole care plan. Each authorization keeps its own QuickState,
 * so its units, rules and checks stay its own; the week is shown as one. `identity` lives in the
 * services' states (memory only, never persisted).
 */
export interface CarePlan {
  /** One per time-based authorization, in Fusion's order. Never empty. */
  services: QuickState[];
  /** Visits authorized by month (not part of the week). */
  visits: PlanVisit[];
  /** Notes about the plan as a whole: visits left out of the week, a partial copy, a service that ended. */
  notes: ImportIssue[];
  /** "plan": the whole care plan; a number: that service, to see in detail and change. */
  view: "plan" | number;
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
  /** The composed week before the person's cell changes (APP-SPEC 5.3 step 3). */
  pattern: TemplateEntry[];
  entries: TemplateEntry[];
  auth: ServiceAuthorization;
  template: ScheduleTemplate;
  trims: CalendarException[];
  allowance: QuickAllowance | null;
  months: string[];
  monthlyAuthorizations: MonthlyAuthorization[];
  /** The monthly figures are the care plan screen's one figure, prorated to each month (IMP-10). */
  prorated: boolean;
  results: ScheduleValidationResult[];
  checksum: QuickChecksum | null;
}

export interface MonthFigures {
  expanded: Record<string, Record<string, number>>;
  authorizedUnits: number;
  source: "fusion" | "calculated";
  /** Fusion's figure for a month of this many days, from the care plan screen's one figure (IMP-10). */
  proratedDays: number | null;
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
