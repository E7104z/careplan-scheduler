# CarePlan Scheduler — Engine Specification (Phase 1, amended for Phase 2)

Condensed from "CarePlan Scheduler — Missouri Scheduling Rules Specification" v0.3
(Claude Docs, Oct 20, 2026). Rule IDs, formulas and expected values here are identical to
that document. Phase 1 = the rules engine package only (`packages/engine`).

**Amendment A (Oct 21, 2026, Phase 2 Prompt 1):** `CalendarException.kind`, rule SCH-17
(fit a month to its authorization), SCH-11 ignores `kind: "fit"`, the "Essential Correspond"
alias, `RULE_CATALOG`, and fixtures TC-38 to TC-40. Nothing else in this file changed.

**Amendment B (Oct 25, 2026, Phase 2 review of Fusion's care plan report):** the entry point
`validatePlan` (section 5); agency personal care (AGENCY_PC) gains the seven household tasks
Fusion lists under PC - Agency (section 3); and AUTH-09 also checks a month with no imported
figure on its derived units, as WARN (a plan built by hand had no ceiling check at all); and
`validatePlan` checks CON-09's Sunday–Saturday weeks on the expanded template (no visits needed).
No formula or expected value changed.

**Amendment D (Nov 13, 2026, Coverage Phase 2 prompt CP2-7):** the effective-dated
authorization model: `AmendmentDirection`, `AuthorizationVersion`, `AuthorizationChain` and
`VersionedOccurrence` (section 2), the functions `chainOf`, `addVersion`, `versionOn` and
`expandChainMonth` (`src/amendments/versions.ts`), and rule AMEND-01. A plan with no amendment is a
chain of one version and behaves exactly as before. The Manual 4.20 effective-date behaviors
are not applied here; they are Coverage Phase 3 (CP3-6). No formula or expected value changed.

---

## 1. Principles (apply to every module)

| ID | Principle |
|---|---|
| P-01 | Three layers stay separate: Authorization (read only), Schedule (this engine), Delivery/Billing (out of scope). |
| P-02 | An imported Fusion authorization is never recalculated or overwritten. Computed values carry `source: "derived"` and a `method`. |
| P-03 | Each service is validated under its own rule pack; one participant can have several services. |
| P-04 | Schedules are built from tasks. Monthly units are never spread evenly across days. |
| P-05 | A rule with status OPEN or PARTIAL produces `REVIEW`, never a silent pass. |
| P-06 | Rule packs are effective-dated; a schedule stores the rule-pack version it was validated under. |

Severities: `BLOCK` (cannot publish), `WARN`, `INFO`, `REVIEW` (unverified; never counted as compliant).

---

## 2. Types (`src/types.ts`)

```ts
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
  refs: { taskId?: string; visitId?: string; date?: string; month?: string; serviceAuthId?: string };
}
```

Amendment D adds the effective-dated model (AMEND-01):

```ts
/** How a care plan amendment changes the authorization (Manual 4.20). Stored, never inferred. */
export type AmendmentDirection = "increase" | "decrease" | "reduction-immediate";
/**
 * One effective-dated version of an authorization and its weekly pattern (AMEND-01). The first
 * version of a chain is the authorization as imported (`amendmentId` and `direction` null).
 */
export interface AuthorizationVersion {
  amendmentId: string | null;
  direction: AmendmentDirection | null;
  effectiveFrom: string;          // YYYY-MM-DD, the first date this version is in effect
  effectiveTo?: string;           // the last date; absent = until the next version or the authorization's end
  recordedOn?: string;            // the date the amendment was made
  requestedDate?: string;         // the date as entered, when the Manual 4.20 behavior moved it
  dateConfirmed?: boolean;        // the effective date is on the care plan; absent = not confirmed
  authorization: ServiceAuthorization;
  template: ScheduleTemplate;
}
/** An authorization's versions, oldest first. A plan with no amendment has one. */
export interface AuthorizationChain { serviceAuthId: string; versions: AuthorizationVersion[]; }
/** A scheduled occurrence and the version in effect on its date (null = the original). */
export interface VersionedOccurrence {
  date: string; taskId: string; minutes: number;
  amendmentId: string | null; serviceAuthId: string;
}
```

`chainOf(authorization, template)` makes the one-version chain. `addVersion(chain, version)`
returns a new chain and refuses a version that reuses an amendment id, takes effect on or before
the version before it, or falls outside the authorization's dates. `versionOn(chain, date)` is
the latest version that has taken effect (null outside the authorization, and null after a
version's `effectiveTo` until the next one starts). `expandChainMonth(chain, exceptions, year,
month)` expands each version over its own dates only and tags every occurrence with its
`amendmentId`, so a later amendment never changes an occurrence before its effective date.

Coverage Phase 3 (CP3-6, Nov 13, 2026) wires the Manual 4.20 behaviors onto the model
(`src/amendments/apply.ts`). `amendmentEffectiveDate(direction, date)`: an increase and a
participant-requested reduction take effect on their date; a decrease on the first day of a
month, so one dated mid-month takes effect on the first of the next month and one dated the 1st
takes effect that day. `applyAmendment(chain, request)` resolves the date, keeps the date as
entered in `requestedDate` when it moved, and adds the version with `addVersion`. AMEND-01 stays
REVIEW for an amendment until its effective date is confirmed from the care plan
(`dateConfirmed`); the engine never picks or confirms a date for the person.

---

## 3. Rule pack `mo-2026-07` (`src/rulepacks/mo-2026-07.ts`)

Effective 2026-07-01. Sources: 3.00 Appendix 1 (rev. Jul 2026), Policy 3.50 (rev. Jul 2026),
HCBS 06-26-01.

| Service | Code | Program | Unit | Monthly ceiling | Other limits |
|---|---|---|---|---|---|
| CDS Personal Care Assistance (State Plan) | T1019U2 | CDS | 15 min | 641 | — |
| ILW Personal Care Assistance | T1019U6 | ILW | 15 min | 868 | 49 h/week; BFP approval required |
| Basic Personal Care – Agency | T1019 | AGENCY_PC | 15 min | 412 | — |
| Advanced Personal Care | T1019TF | APC | 15 min | none | — |
| Authorized Nurse Visits | T1001 | NURSE | 1 visit | — | 1/day; 26 per 6-month period |
| Homemaker (ADW) | S5130 | HOMEMAKER | 15 min | none | — |
| Chore (ADW) | S5120 | CHORE | 15 min | none | frequency as days/month |
| Respite – Basic / Advanced (ADW) | S5150 / S5150TF | RESPITE | 15 min | 868 combined | 49 h/week combined |

Days-per-month factor (AUTH-02): `{1:5, 2:10, 3:15, 4:19, 5:23, 6:27, 7:31}`.

Task library: every task has a `taskCode` and `aliases` (all spellings below map to one code).

CDS / ILW (DHSS 14b dropdown, HCBS-3c names as aliases):
Assistive Transfer Device (alias "Asst. Transfer Device"); Assistance with Toileting (aliases
"Asstance with Toileting", "Asst. with Toileting"); Bathing; Bowel/Bladder Routine; Catheter
Hygiene; Change Linens; Clean Bath; Clean Floors; Clean Kitchen; Clean/Maintain Equipment;
Dressing/Grooming; Essential Correspondence (alias "Essential Correspond", Fusion's truncation); Laundry (Home); Laundry (Off Site); Make Bed;
Meal Prep/Eating; Medications; Mobility/Transfer; Ostomy Hygiene; Passive ROM; Tidy and Dust;
Trash; Treatments; Turning/Positioning; Wash Dishes; Essential Transportation (transport).

Agency model (DHSS 14a dropdown):
Basic PC — Bathing; Dietary; Dressing/Grooming; Mobility/Transfer/Position; Self-Admin of
Medications (alias "Self Admin of Meds"); Toileting; and, under the MED REL HC TASKS control
row, the 11 household rows (3a B33–B63): Clean Bath; Clean Kitchen; Clean Living Area; Essential
Correspondence (alias "Essential Correspond"); Iron/Mend; Laundry (alias "Laundry (Home/Off
Site)"); Make Bed/Change Linens; Meals/Dishes; Shopping/Errands (alias
"Shop/Errands/Correspond"); Trash; Wash Windows/Blinds. Each is also a Homemaker task, and each
counts under agency PC when medically related, else under Homemaker — never both (3a N29/N66).
Homemaker — the same 11 household rows. The aliases are the names in Fusion's care plan report
for agency personal care (IMPORT-SPEC 1.3). APC — Aseptic Dressings; Assistive Transfer Device;
Bowel Program; Catheter Hygiene; Non-Injectable Meds; Ostomy Hygiene; Passive ROM. Respite —
Basic Respite; Advanced Respite.

Service-pair overlap matrix (CON-02): `CDS+NURSE: allowed`; `RESPITE+any other: prohibited`;
same code twice: prohibited (CON-01); every other pair: `unknown` (→ REVIEW).

---

## 4. Formulas (`src/math/`)

| ID | Function | Formula | Notes |
|---|---|---|---|
| F-1 | `factorFor(daysPerWeek)` | table above | — |
| F-2a | `hcbs3cTaskUnits(minPerDay, dpw)` | `ceil(minPerDay / 15 * factor)` | HCBS-3c cell Q11 |
| F-2b | `workbookTaskUnits(weeklyMinutes, timesPerWeek)` | `trunc(weeklyMinutes / timesPerWeek / 15 * factor + 0.99)` | DHSS 14a/14b cell M7 |
| F-3 | `monthTaskUnits(weeklyMinutes, timesPerWeek, daysInMonth)` | if timesPerWeek = 7: `trunc(weeklyMinutes/7/15*daysInMonth + 0.99)`; else F-2b | 14a/14b cell D37; short months affect 7-day tasks only |
| F-4 | `transport(minPerTrip, tripsPerWeek)` | `min = minPerTrip * factor`; `units = floor(min/15)`; `unallocated = min - units*15` | Policy 3.25; HCBS-3c L88 |
| F-5 | `dayUnits(minutes)` | `units = floor(min/15)`, `remainder = min mod 15` | display only |
| F-6 | `usageMeasures(template, months[])` | weekly baseline `floor(weekMin/15) * 52`; calendar minutes; monthly whole units `Σ floor(monthMin/15)` + remainders | never merged into one number |
| F-7 | `calendarCheck` | `Σ scheduled minutes of task in month ≤ 15 × monthTaskUnits` | always runs |
| F-8 | `projectIlwSwitch(dailyUnits[], statePlanUnits)` | first date where the running total would exceed the imported State Plan units; split that day | only when both imported authorizations exist |
| F-9 | `weeklyHours` | Sunday–Saturday totals (labeled convention) + every rolling 7-day window | never reset at month/year boundary |

Floating-point guard: compute `weeklyMinutes * factor` as integers and divide once;
for `trunc(x + 0.99)` use `Math.trunc((num + 0.99 * den) / den)` on integer numerator
`num = weeklyMinutes * factor` and denominator `den = timesPerWeek * 15`.

---

## 5. Rules (`src/rules/`)

Entry points (`src/validate.ts`): `validateSchedule(input)` runs every rule below, stamps each
result with the rule-pack version (AUTH-13) and orders them BLOCK, REVIEW, WARN, INFO.
`validatePlan(input)` (Amendment B) takes the same input without `visits`, `caregivers`,
`enrollments` and `tenantWorkweekStart`, and runs the rules that read the plan: AUTH-03 to
AUTH-12 and SCH-02, SCH-03, SCH-08, SCH-11, SCH-12, NUR-01 (with the optional
`authorizedStarts`: each authorization's own first date, when the schedule starts later), plus CON-09 on the expanded template: each
ILW or Respite authorization's task minutes on each date (template plus exceptions), checked as
visits would be, keeping only the Sunday–Saturday week results (REVIEW; a repeating week makes
every rolling 7-day window equal its week or less), with `refs.month` the week's first month.
For a plan with no visits its other results are `validateSchedule`'s without the visit rules
(SCH-14 and every CON rule), in the same order.
It is for a plan that is not scheduled as visits (Quick Schedule): run on no visits, CON-13
would ask for a referral date it has no first visit to check. Only visit time (SCH-15) needs
luxon, so a page that calls `validatePlan` and not `validateSchedule` doesn't load it.

### Authorization (`auth.ts`)

| ID | Rule | Severity | Status | Source |
|---|---|---|---|---|
| AUTH-03 | Derived task units use F-2b; also compute F-2a; if they differ, emit REVIEW (edge case P-1). | INFO / REVIEW | PARTIAL | HCBS-3c (10/26) cell Q11; DHSS 4.00 Appendix 14a/14b cell M7 |
| AUTH-05 | Derived month units use F-3 for task services (CDS, ILW, AGENCY_PC, APC, HOMEMAKER, and RCF_PC, RCF_APC, whose RCF/ALF care plans INFO 05-25-03 says Fusion prorates). Other services are not prorated. | INFO | PARTIAL | INFO 05-25-03 (May 9, 2025); Fusion FAQ (Jun 4, 2025); DHSS 14a/14b cell D37 |
| AUTH-06 | Imported plan flagged `migratedFromWebTool` → WARN "per-month figures are derived". | WARN | VERIFIED | INFO 05-25-03 (May 9, 2025) |
| AUTH-07 | If a derived month figure ≠ the imported Fusion figure → REVIEW; Fusion value kept. | REVIEW | APPROVED | Product decision approved Oct 20, 2026 (P-02) |
| AUTH-08 | Transport: keep authorized minutes, whole units, scheduled minutes, unallocated minutes. | INFO | VERIFIED | Policy 3.25 (01/26); HCBS-3c cell L88 |
| AUTH-09 | Imported authorization above the program ceiling → REVIEW. Respite Basic + Advanced in a month > 868 → BLOCK. A month with no imported figure whose derived units (AUTH-05) are above the ceiling → WARN (Amendment B). | BLOCK / REVIEW / WARN | VERIFIED | 3.00 Appendix 1 (rev. Jul 2026); Policy 3.50 (rev. Jul 2026); HCBS 06-26-01 |
| AUTH-11 | ILW switch projection only when both imported authorizations exist; label "projection". | INFO | PARTIAL | Policy 3.55 (01/26) |
| AUTH-12 | ILW units scheduled while `state = pending_approval` → BLOCK. Never create a State Plan authorization for an ILW participant. | BLOCK | VERIFIED | Policy 3.55 (01/26); 3.00 Appendix 1 (rev. Jul 2026) |
| AUTH-13 | Validation results carry the rule-pack version. | INFO | APPROVED | Product decision approved Oct 20, 2026 (P-06) |

### Schedule (`sch.ts`)

| ID | Rule | Severity | Status | Source |
|---|---|---|---|---|
| SCH-02 | Template: weekdays scheduled for a task > `daysPerWeek` → BLOCK; < `daysPerWeek` → WARN. | BLOCK / WARN | VERIFIED basis | INFO 09-25-02 (Sep 23, 2025); DHSS 14a/14b cell D7; 13 CSR 70-91.010(3)(H)2 |
| SCH-03 | Any template occurrence with minutes > `minPerDay` → WARN. | WARN | APPROVED | Product decision approved Oct 20, 2026; DHSS 14a/14b weekly grid |
| SCH-08 | Expand template + exceptions onto every date of each month in the authorization; per task, scheduled minutes > 15 × month units → BLOCK. | BLOCK | VERIFIED | DHSS 14a/14b "Example Month" sheet; 13 CSR 70-91.010(1)(B)2 |
| SCH-11 | Same task's exception repeated in 2 consecutive months → WARN "consider a care plan change request" (product heuristic). Exceptions with `kind: "fit"` are not counted (Amendment A). | WARN | APPROVED | INFO 09-25-02 (Sep 23, 2025); CDS policy clarification Q9; two-month trigger is a product heuristic |
| SCH-12 | Dates outside start/end are not scheduled; partial months with no imported figure → REVIEW. | REVIEW | APPROVED | Product decision approved Oct 20, 2026 |
| SCH-14 | Visits on suspended or expired dates → BLOCK; future-effective → INFO "draft only". | BLOCK / INFO | APPROVED | Product decision approved Oct 20, 2026; Policy 3.55 (pending BFP approval) |
| SCH-15 | Visit minutes = real elapsed minutes in America/Chicago, split by calendar date. | — | APPROVED | Product decision approved Oct 20, 2026 |
| SCH-17 | Fit to the month's authorization: for each month with an imported Fusion figure, if the template's minutes exceed `(Fusion units − transport units) × 15`, remove the excess starting from the last scheduled date and working backward; on each date take daily (7-day) tasks first, then longer occurrences first, then task id; output `CalendarException`s with `kind: "fit"`, `reason: "Units for the month run out"`. Months without a Fusion figure are never trimmed (derived units fit by construction). Emits no results. | — | APPROVED | Product decision approved Oct 21, 2026 (schedules never exceed SCH-08) |
| AMEND-01 | A care plan amendment whose effective date is not confirmed from the care plan → REVIEW "amendment effective date needs confirmation, Manual 4.20", one for each such amendment, on its effective date. A decrease takes effect on the first day of a month (one dated mid-month, on the first of the next month); an increase on its date, which may be mid-month; a participant-requested reduction on its date. Occurrences are recalculated from the effective date forward only and keep the version in effect on their date, so history is never rewritten. | REVIEW | PARTIAL | HCBS Manual 4.20 (care plan amendments: decreases effective the first of a later month, increases may take effect mid-month, participant-requested reductions immediate) |
| EVT-01 | A billable dated event (nurse visit, adult day care day, meal delivery, structured family caregiver day) outside its authorization's dates, or in a month Fusion did not authorize → BLOCK; the placement is refused. A reminder is not checked. | BLOCK | APPROVED | The authorization's own dates and months as Fusion prints them; product decision Nov 13, 2026 |
| EVT-02 | Billable dated events in a month above the quantity Fusion authorized for that month, counted in the service's own unit (visits, meals, days, adult day care minutes) → BLOCK; Fusion's count controls. A quantity is a whole number above zero; a structured family caregiver day is one day, covered once. | BLOCK | APPROVED | Fusion's authorized quantity for the month; 3.00 Appendix 1 (rev. Jul 2026) units and limits |
| EVT-03 | A shift or billable event on an authorization of class CONTEXT (ILW case management, financial management, equipment, supplies, adaptations) → BLOCK; only a reminder may be placed on it. A reminder is never billable and has no quantity. | BLOCK | APPROVED | 3.00 Appendix 1 (rev. Jul 2026); Missouri coverage audit section 10, decision 2, and PR #10 (Oct 31, 2026) |
| NUR-01 | An Advanced Personal Care authorization (T1019TF, identified by its code) whose first month is in the schedule → REVIEW "A new Advanced Personal Care authorization is expected to have two nurse visits in its first month unless an ongoing nurse visit covers it. Check the care plan." Never BLOCK or PASS, and nothing in later months. No visit is created or linked: the app offers a date only for a nurse visit Fusion authorized. | REVIEW | PARTIAL | HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care, as reviewed Oct 31, 2026; DHSS has not confirmed the first-month visit count |
| NUR-02 | An authorized nurse visit month that has passed with no date placed → WARN "No date was placed for this month's visit." It says nothing about whether the visit happened: the app schedules, it does not record delivery. | WARN | APPROVED | Missouri coverage audit RN-04 (missed general health evaluation follow-up); the follow-up wording is a product decision, Nov 13, 2026 |

### Conflicts and eligibility (`con.ts`)

| ID | Rule | Severity | Status | Source |
|---|---|---|---|---|
| CON-01 | Same service code, same participant, overlapping visits: CDS/ILW → BLOCK; agency codes → WARN. A scheduled service with no clock times → REVIEW "No clock times yet, so overlaps can't be checked"; it never passes on missing data. | BLOCK / WARN / REVIEW | PARTIAL | CDS policy clarification Q5 |
| CON-02 | Different services overlapping: matrix `allowed` → none; `prohibited` → BLOCK; `unknown` → REVIEW. With two or more services, one with no clock times → REVIEW "No clock times yet, so overlaps can't be checked". | per matrix | PARTIAL | CDS policy clarification Q5; Policy 3.50 (rev. Jul 2026) |
| CON-03 | Respite overlapping any other service → BLOCK. With respite and another service in the plan, a service with no clock times → REVIEW "No clock times yet, so overlaps can't be checked". | BLOCK / REVIEW | VERIFIED | Policy 3.50 (rev. Jul 2026) |
| CON-04 | Same caregiver, overlapping visits for different participants → BLOCK. | BLOCK | APPROVED | Product decision approved Oct 20, 2026 |
| CON-05 | Caregiver > 40 h in the tenant's workweek → WARN. | WARN | APPROVED | FLSA; product decision approved Oct 20, 2026 |
| CON-06 | CDS attendant is spouse or legal guardian → BLOCK; for ILW → REVIEW. | BLOCK / REVIEW | VERIFIED (CDS) | Policy 3.25 (01/26) |
| CON-07 | AGENCY_PC, APC, HOMEMAKER, RESPITE aide is parent, sibling, child, stepchild, spouse, grandparent or grandchild → BLOCK; not an agency employee → BLOCK. CHORE → REVIEW. RCF_PC, RCF_APC → REVIEW (Policy 3.20 doesn't restate 3.05's aide restrictions; DSDS question 14). | BLOCK / REVIEW | VERIFIED | Policy 3.05 (04/25); Policy 3.10 (03/25); Policy 3.20 (rev. Mar 2026); Policy 3.45 (Nov 2021); Policy 3.50 (rev. Jul 2026) |
| CON-09 | ILW and Respite: any Sunday–Saturday week > 49 h → REVIEW; any rolling 7-day window > 49 h → WARN. | REVIEW / WARN | PARTIAL | HCBS 06-26-01; Policy 3.50 (rev. Jul 2026); Sunday-Saturday week is a product convention |
| CON-10 | Nurse visits: > 1 per date → BLOCK; > 26 in a six-month period → BLOCK. | BLOCK | VERIFIED | Policy 3.15 (04/26) as updated by HCBS 08-26-01; 3.00 Appendix 1 (rev. Jul 2026) |
| CON-13 | AGENCY_PC first visit > 10 calendar days after `receivedDate` → WARN; missing `receivedDate` → REVIEW. | WARN / REVIEW | VERIFIED | 13 CSR 70-91.010(1)(B)1; CDS policy clarification Q2 |
| CON-16 | Two waiver enrollments with overlapping date ranges → BLOCK; sequential is fine; ILW/RESPITE/HOMEMAKER/CHORE scheduled with no enrollment record → REVIEW. | BLOCK / REVIEW | VERIFIED | Policy 3.05 (04/25) |
| CON-17 | Missing qualification data needed by CON-06/07, nurse licence for NURSE, FCSR for ILW → REVIEW. | REVIEW | PARTIAL | Policies 3.05, 3.10, 3.15, 3.25; Policy 3.55 (FCSR registration) |

---

## 6. Composer (`src/compose/composeWeek.ts`)

Port of Scheduler Lite `carePlan.person.ts` (`composePCSSnapshot`), changed to use task IDs.

Input: `tasks: AuthorizedTask[]`, `activeDays: boolean[7]`, `overrides: Record<taskId, Weekday[]>`,
`weeklyTransportMinutes`, `transportDay: Weekday`.
Behavior (keep exactly):
1. Only active days receive tasks.
2. 7-day tasks go on every active day unless an override lists days.
3. Other tasks: if an override exists, use exactly those days (still active days only).
   Otherwise place heaviest tasks first, each on its `daysPerWeek` lightest active days by
   current load; ties go Monday-first order `[1,2,3,4,5,6,0]`.
4. The transport day starts with `weeklyTransportMinutes` of load so tasks steer away from it.
5. A task never appears twice on the same day.
Output: `TemplateEntry[]` plus `dayTotals: number[7]`.

---

## 7. Acceptance fixtures (expected values are exact)

| TC | Input | Expected |
|---|---|---|
| TC-01 | Bathing 30 min Mon/Wed/Fri; Toileting 15 daily; Meals/Dishes 45 daily; Laundry 30 Tue/Thu; Clean Kitchen 10 Sun/Sat; Sep 2025–Aug 2026 | day minutes Sun..Sat `[70,90,90,90,90,90,70]`; week 590 = 39 units + 5; month units: 31-day 181, 30-day 177, Feb 2026 169, Feb 2028 173; 12-month total 2,144; weekly baseline 2,028; calendar minutes 30,770; monthly whole units 2,047 with 65 remainder minutes; Sep 2025 usage 169 units + 5 |
| TC-02 | one task 30 min daily | 56 / 58 / 60 / 62 in 28 / 29 / 30 / 31-day months |
| TC-03 | Transfer Device 30 min daily; Toileting 15 daily; Bathing 30 min 5×/wk | 130 / 133 / 136 / 139 in 28 / 29 / 30 / 31 days |
| TC-04 | 309 min/day, 5×/wk | F-2a 474; written-example method 483 (not implemented; documented) |
| TC-05 | 10 min 1×/wk; 10 min 2×/wk | 4; 7 |
| TC-06 | transport 90×1; 60×2; 60×3 | 450/600/900 min = 30/40/60 units, 0 unallocated |
| TC-07 | Respite 13:00–17:00 and CDS 14:00–15:00, same participant/day | BLOCK CON-03 |
| TC-08 | (a) two CDS visits overlap; (b) CDS + NURSE overlap; (c) AGENCY_PC + HOMEMAKER overlap | (a) BLOCK CON-01; (b) none; (c) REVIEW CON-02 |
| TC-09 | composer: active Sun/Tue/Thu/Sat; override Bathing → Sun/Tue/Thu | entries only on 0,2,4,6; Bathing on 0,2,4 |
| TC-10 | 420 min/day daily, 31-day month, imported State Plan 500, ILW 368; then ILW missing | switch day 18 (24 SP + 4 ILW); days 19–31 ILW; without ILW: no projection |
| TC-11 | ILW 420 min/day Sun 2029-01-28 – Sat 2029-02-03 | week total 49 h, no REVIEW; window not reset on Feb 1 |
| TC-12 | all months 2026–2036 | max occurrences of k weekdays = 5,10,15,19,23,27,31 |
| TC-13 | AGENCY_PC aide is grandchild | BLOCK CON-07 |
| TC-14 | CDS attendant: child → ok; spouse → BLOCK CON-06 |
| TC-15 | two NURSE visits same date; 27th visit in 6 months | BLOCK; BLOCK |
| TC-16 | 15 min/day 4×/wk; template Mon 51, Tue 3, Wed 3, Thu 3; March 2027 | 297 > 285 → BLOCK SCH-08; WARN SCH-03 |
| TC-17 | Respite Basic 500 + Advanced 500 in one month | BLOCK AUTH-09 |
| TC-18 | ILW 2026-10-01..2027-03-31 and ADW 2026-10-15..2027-03-31 | BLOCK CON-16 |
| TC-20 | transport 50×1; 70×2 | 250 min = 16 units + 10; 700 = 46 + 10 |
| TC-21 | authorization start 2026-10-15, no imported Oct figure | no visits before Oct 15; REVIEW SCH-12 |
| TC-22 | authorization end 2026-10-20; visit 2026-10-21 | BLOCK SCH-14 |
| TC-24 | suspension 2026-10-05..2026-10-12; visit 2026-10-07 | BLOCK SCH-14 |
| TC-25 | ILW 450 min/day Sun 2026-12-27 – Sat 2027-01-02 | 52.5 h → REVIEW CON-09 |
| TC-26 | wk1 Sun–Wed 285 min, Thu–Sat 600; wk2 Sun–Wed 600, Thu–Sat 180 | each Sun–Sat week 49 h; Thu–Wed window 70 h → WARN CON-09 |
| TC-27 | visit 2026-10-31T22:00 → 2026-11-01T06:00 | 540 min: 120 on Oct 31, 420 on Nov 1 |
| TC-28 | visit 2027-03-13T22:00 → 2027-03-14T06:00 | 420 min: 120 on Mar 13, 300 on Mar 14 |
| TC-29 | ADW ends 2026-10-10, ILW starts 2026-10-11; then ADW ends 2026-10-12 | first ok; second BLOCK CON-16 |
| TC-30 | ILW visit, no enrollment record | REVIEW CON-16 |
| TC-31 | CDS "Bathing" and AGENCY_PC "Bathing"; override only the CDS task id | agency Bathing unchanged |
| TC-32 | caregiver A: P-1 09:00–11:00, P-2 10:00–12:00 same date | BLOCK CON-04 |
| TC-33 | caregiver 42 h in workweek | WARN CON-05 only |
| TC-35 | ILW attendant `fcsrRegistered` undefined | REVIEW CON-17 |
| TC-37 | 7-day task, 61 weekly minutes (10×6 + 1) | F-2b 18; F-2a 19; REVIEW AUTH-03 |

| TC-38 | IMPORT-SPEC fixture B (7-day plan, Fusion 455, transport 345 min) composed with all seven days active, `weeklyTransportMinutes` 60 on Sunday (transportDay 0), no overrides; authorization 2025-12-01–2026-10-31; Fusion 455 for every month | `fitToAuthorization` returns exactly: 2025-12-31 Meal Prep/Eating −60, Bathing −35; 2026-03-31 Meal Prep/Eating −60, Bathing −15; 2026-08-31 Meal Prep/Eating −55; all `kind: "fit"`; validateSchedule with those exceptions has no BLOCK |
| TC-39 | the TC-38 trims (Dec, Mar, Aug) plus a second `kind: "fit"` trim on 2026-01-31 for Meal Prep/Eating | no SCH-11 result; the same four as `kind: "change"` → one SCH-11 WARN |
| TC-40 | "Essential Correspond" | `findTaskByName` → ESSENTIAL_CORRESPONDENCE |

TC-19 (app-level), TC-23 (amendment), TC-34 (GHE) and TC-36 (exports) belong to later phases.

## Amendment C (Oct 27, 2026, Phase 3): Worksheet rules

### C.2 Worksheet rules (`src/stateparity/rules.ts`)

`validateStateParity3c(input, pack)` (`src/stateparity/validate.ts`) runs these on `calculate3c`'s rows and stamps
each result with the rule-pack version, ordered BLOCK, REVIEW, WARN, INFO, like `validatePlan`. Results carry
`refs.taskCode`. `validatePlan` and `validateSchedule` never call them (W-7). The suggested times come from
`src/stateparity/guidance.ts`, a copy of DSDS's suggested time and frequency columns that
`test/guidance.test.ts` compares with `docs/fixtures/state/worksheet-guidance.json` field for field.

| ID | Rule | Severity | Status | Source |
|---|---|---|---|---|
| WS-R01 | A task's Min/Day is below the form's suggested time, or above it for a task with a weekly frequency ("1-7 X WK"; a task done as needed, per transfer or as ordered can happen several times a day) → INFO "Outside DSDS's suggested range". Rows whose suggested time isn't minutes are skipped. | INFO | VERIFIED basis | HCBS-3c (10/26) and HCBS-3a (07/26) suggested time columns |
| WS-R02 | An ILW request (the 3c's ILW tab, or a 3a marked part of an ILW request) with a task that has units and no Description of needs → REVIEW. | REVIEW | PARTIAL | HCBS Manual 4.00 Appendix 4 (rev. Jul 2026) and Appendix 3 (rev. May 2025): Description of Needs is required for ILW requests |
| WS-R03 | The 3c's CDS tab total is above its maximum (641) → INFO "consider the Independent Living Waiver". | INFO | VERIFIED | HCBS Manual 4.00 Appendix 4 (rev. Jul 2026) |
| WS-R04 | Advanced Personal Care with exactly one task that has units, whose minutes aren't a multiple of 15 → BLOCK. | BLOCK | VERIFIED | HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care |
| WS-R05 | Advanced Personal Care with units, no ongoing nurse visits and fewer than 2 nurse visits in its first month → REVIEW. | REVIEW | PARTIAL | HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care |
| WS-R06 | General Health Evaluation checked and the Comments name no month → WARN "only for semi-annual visits; name the months". | WARN | VERIFIED | HCBS Manual 4.00 Appendix 3 (rev. May 2025), Authorized Nurse Visits and Comments |
| WS-R07 | The nurse task "Other" checked → INFO "needs prior approval and authorization from DSDS or its designee". | INFO | VERIFIED | HCBS Manual 4.00 Appendix 3 (rev. May 2025), Authorized Nurse Visits |
| WS-R08 | Adult Day Care or Adult Day Care Waiver minutes not a multiple of 15, above 600 a day, or days above 5 a week → BLOCK. | BLOCK | VERIFIED | HCBS Manual 4.00 Appendix 3 (rev. May 2025), Adult Day Care |
| WS-R09 | Home Delivered Meals above 2 a day → REVIEW. | REVIEW | PARTIAL | HCBS-3a (07/26) rate sheet cell G14: "Max 2/day" |

`validateStateParity3a(input, pack)` runs WS-R01, WS-R02 (only when the 3a is part of an ILW request), WS-R04
to WS-R09, and AUTH-09's combined respite limit. It calls `ruleAUTH09Ceiling` on the two respite lines for
"a 31-day month" rather than copying the rule. Results on a 3a line with no task carry `refs.line`.
