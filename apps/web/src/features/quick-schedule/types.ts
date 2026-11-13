import type {
  AmendmentDirection,
  AuthorizedTask,
  CalendarException,
  DaysPerWeek,
  MonthlyAuthorization,
  PlanEvent,
  ScheduleTemplate,
  ScheduleValidationResult,
  ServiceAuthorization,
  ServiceCode,
  ServiceDef,
  Severity,
  TemplateEntry,
  Weekday,
} from "@careplan/engine";
import type { ImportIssue, SourceRef } from "@careplan/import";

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
  /** The task's Fusion row exactly as read (SOURCE-01); absent for a task added by hand. */
  raw?: string | null;
  /** Where that row was read in the PDF's text (SOURCE-01). */
  source?: SourceRef | null;
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

/**
 * A care plan change recorded on a service (Coverage Phase 3, Manual 4.20): a version from its
 * effective date on. It never edits the imported state; the schedule before that date is as it was.
 */
export interface PlanAmendment {
  id: string;
  direction: AmendmentDirection;
  /** YYYY-MM-DD as entered. A decrease dated mid-month takes effect the first of the next month. */
  date: string;
  /** The person said the care plan shows this date; until then the change is under review (AMEND-01). */
  confirmed: boolean;
  /** The tasks the change touches, by task id: minutes a day (0 = out of the week) and days a week. */
  tasks: Record<string, { minPerDay: number; daysPerWeek: DaysPerWeek }>;
  /** Fusion's units a month from the change on, when the care plan gives them. */
  units: number | null;
}

/** APP-SPEC 5.6. `identity` lives in memory only and is never persisted. */
export interface QuickState {
  source: "fusion" | "manual";
  identity: { name: string; dcn: string } | null;
  provider: string | null;
  pa: string | null;
  serviceLabel: string | null;
  serviceCode: ServiceCode;
  /** Where the authorization's service row was read (SOURCE-01); absent for a plan by hand. */
  sourceRef?: SourceRef | null;
  plan: Plan;
  headerUnits: number | null;
  tasks: QuickTask[];
  /** A UUID for this authorization (JOIN-03); every task id is unique under it. */
  id: string;
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
  /** Care plan changes recorded on this service; absent in plans saved before them. */
  amendments?: PlanAmendment[];
}

/** A visit authorization read from Fusion's care plan report, such as a General Health Evaluation. */
export interface PlanVisit {
  /** A UUID for this authorization (JOIN-03), which its dated events point at. Absent in plans saved before Coverage Phase 3. */
  id?: string;
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
 * IMP-19: an authorization kept with the plan but not scheduled: an Appendix 1 service Quick
 * Schedule doesn't place yet, a code outside Appendix 1, or a service the person chose to keep.
 */
export interface PlanOther {
  /** A UUID for this authorization (JOIN-03), which its dated events point at. Absent in plans saved before Coverage Phase 3. */
  id?: string;
  label: string | null;
  /** The procedure code as Fusion printed it; null when the person kept a service with none. */
  code: string | null;
  /** The Appendix 1 service, or null when it isn't one of the 21. */
  registryId: string | null;
  provider: string | null;
  pa: string | null;
  start: string | null;
  end: string | null;
  monthly: { start: string; end: string; units: number }[];
  /** Its rows, exactly as read. */
  rows: string[];
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
  /**
   * Authorizations kept but not scheduled (IMP-19). Absent in plans saved before Nov 2026 and in
   * plans by hand, which have none.
   */
  others?: PlanOther[];
  /**
   * Dated events the person placed (Coverage Phase 3): nurse visits, adult day care days, meal
   * deliveries, covered days and reminders. They carry no name and no DCN. Absent in plans saved
   * before them.
   */
  events?: PlanEvent[];
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
