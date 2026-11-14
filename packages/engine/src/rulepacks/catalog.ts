import type { Severity } from "../types.js";
import { PROGRAM_RULES } from "./catalogPrograms.js";

export type RuleArea = "Authorization" | "Schedule" | "Conflicts and eligibility" | "Worksheet";
export type RuleStatus = "VERIFIED" | "VERIFIED (CDS)" | "VERIFIED basis" | "PARTIAL" | "APPROVED" | "OPEN";

export interface RuleCatalogEntry {
  id: string; area: RuleArea; rule: string; severities: Severity[];
  status: RuleStatus; source: string;
}

/**
 * Every rule of ENGINE-SPEC section 5 and Amendment C (worksheet rules), in table order. Rule
 * text, status and source are copied character for character; test/catalog.test.ts compares them
 * with the spec.
 */
export const RULE_CATALOG: readonly RuleCatalogEntry[] = [
  // Authorization (auth.ts)
  {
    id: "AUTH-03", area: "Authorization", severities: ["INFO", "REVIEW"], status: "PARTIAL",
    rule: "Derived task units use F-2b; also compute F-2a; if they differ, emit REVIEW (edge case P-1).",
    source: "HCBS-3c (10/26) cell Q11; DHSS 4.00 Appendix 14a/14b cell M7",
  },
  {
    id: "AUTH-05", area: "Authorization", severities: ["INFO"], status: "PARTIAL",
    rule: "Derived month units use F-3 for task services (CDS, ILW, AGENCY_PC, APC, HOMEMAKER, and RCF_PC, RCF_APC, whose RCF/ALF care plans INFO 05-25-03 says Fusion prorates). Other services are not prorated.",
    source: "INFO 05-25-03 (May 9, 2025); Fusion FAQ (Jun 4, 2025); DHSS 14a/14b cell D37",
  },
  {
    id: "AUTH-06", area: "Authorization", severities: ["WARN"], status: "VERIFIED",
    rule: "Imported plan flagged `migratedFromWebTool` → WARN \"per-month figures are derived\".",
    source: "INFO 05-25-03 (May 9, 2025)",
  },
  {
    id: "AUTH-07", area: "Authorization", severities: ["REVIEW"], status: "APPROVED",
    rule: "If a derived month figure ≠ the imported Fusion figure → REVIEW; Fusion value kept.",
    source: "Product decision approved Oct 20, 2026 (P-02)",
  },
  {
    id: "AUTH-08", area: "Authorization", severities: ["INFO"], status: "VERIFIED",
    rule: "Transport: keep authorized minutes, whole units, scheduled minutes, unallocated minutes.",
    source: "Policy 3.25 (01/26); HCBS-3c cell L88",
  },
  {
    id: "AUTH-09", area: "Authorization", severities: ["BLOCK", "REVIEW", "WARN"], status: "VERIFIED",
    rule: "Imported authorization above the program ceiling → REVIEW. Respite Basic + Advanced in a month > 868 → BLOCK. A month with no imported figure whose derived units (AUTH-05) are above the ceiling → WARN (Amendment B).",
    source: "3.00 Appendix 1 (rev. Jul 2026); Policy 3.50 (rev. Jul 2026); HCBS 06-26-01",
  },
  {
    id: "AUTH-11", area: "Authorization", severities: ["INFO"], status: "PARTIAL",
    rule: "ILW switch projection only when both imported authorizations exist; label \"projection\".",
    source: "Policy 3.55 (01/26)",
  },
  {
    id: "AUTH-12", area: "Authorization", severities: ["BLOCK"], status: "VERIFIED",
    rule: "ILW units scheduled while `state = pending_approval` → BLOCK. Never create a State Plan authorization for an ILW participant.",
    source: "Policy 3.55 (01/26); 3.00 Appendix 1 (rev. Jul 2026)",
  },
  {
    id: "AUTH-13", area: "Authorization", severities: ["INFO"], status: "APPROVED",
    rule: "Validation results carry the rule-pack version.",
    source: "Product decision approved Oct 20, 2026 (P-06)",
  },

  // Schedule (sch.ts)
  {
    id: "SCH-02", area: "Schedule", severities: ["BLOCK", "WARN"], status: "VERIFIED basis",
    rule: "Template: weekdays scheduled for a task > `daysPerWeek` → BLOCK; < `daysPerWeek` → WARN.",
    source: "INFO 09-25-02 (Sep 23, 2025); DHSS 14a/14b cell D7; 13 CSR 70-91.010(3)(H)2",
  },
  {
    id: "SCH-03", area: "Schedule", severities: ["WARN"], status: "APPROVED",
    rule: "Any template occurrence with minutes > `minPerDay` → WARN.",
    source: "Product decision approved Oct 20, 2026; DHSS 14a/14b weekly grid",
  },
  {
    id: "SCH-08", area: "Schedule", severities: ["BLOCK"], status: "VERIFIED",
    rule: "Expand template + exceptions onto every date of each month in the authorization; per task, scheduled minutes > 15 × month units → BLOCK.",
    source: "DHSS 14a/14b \"Example Month\" sheet; 13 CSR 70-91.010(1)(B)2",
  },
  {
    id: "SCH-11", area: "Schedule", severities: ["WARN"], status: "APPROVED",
    rule: "Same task's exception repeated in 2 consecutive months → WARN \"consider a care plan change request\" (product heuristic). Exceptions with `kind: \"fit\"` are not counted (Amendment A).",
    source: "INFO 09-25-02 (Sep 23, 2025); CDS policy clarification Q9; two-month trigger is a product heuristic",
  },
  {
    id: "SCH-12", area: "Schedule", severities: ["REVIEW"], status: "APPROVED",
    rule: "Dates outside start/end are not scheduled; partial months with no imported figure → REVIEW.",
    source: "Product decision approved Oct 20, 2026",
  },
  {
    id: "SCH-14", area: "Schedule", severities: ["BLOCK", "INFO"], status: "APPROVED",
    rule: "Visits on suspended or expired dates → BLOCK; future-effective → INFO \"draft only\".",
    source: "Product decision approved Oct 20, 2026; Policy 3.55 (pending BFP approval)",
  },
  {
    id: "SCH-15", area: "Schedule", severities: [], status: "APPROVED",
    rule: "Visit minutes = real elapsed minutes in America/Chicago, split by calendar date.",
    source: "Product decision approved Oct 20, 2026",
  },
  {
    id: "SCH-17", area: "Schedule", severities: [], status: "APPROVED",
    rule: "Fit to the month's authorization: for each month with an imported Fusion figure, if the template's minutes exceed `(Fusion units − transport units) × 15`, remove the excess starting from the last scheduled date and working backward; on each date take daily (7-day) tasks first, then longer occurrences first, then task id; output `CalendarException`s with `kind: \"fit\"`, `reason: \"Units for the month run out\"`. Months without a Fusion figure are never trimmed (derived units fit by construction). Emits no results.",
    source: "Product decision approved Oct 21, 2026 (schedules never exceed SCH-08)",
  },
  {
    id: "AMEND-01", area: "Schedule", severities: ["REVIEW"], status: "PARTIAL",
    rule: "A care plan amendment whose effective date is not confirmed from the care plan → REVIEW \"amendment effective date needs confirmation, Manual 4.20\", one for each such amendment, on its effective date. A decrease takes effect on the first day of a month (one dated mid-month, on the first of the next month); an increase on its date, which may be mid-month; a participant-requested reduction on its date. Occurrences are recalculated from the effective date forward only and keep the version in effect on their date, so history is never rewritten.",
    source: "HCBS Manual 4.20 (care plan amendments: decreases effective the first of a later month, increases may take effect mid-month, participant-requested reductions immediate)",
  },
  {
    id: "EVT-01", area: "Schedule", severities: ["BLOCK"], status: "APPROVED",
    rule: "A billable dated event (nurse visit, adult day care day, meal delivery, structured family caregiver day) outside its authorization's dates, or in a month Fusion did not authorize → BLOCK; the placement is refused. A reminder is not checked.",
    source: "The authorization's own dates and months as Fusion prints them; product decision Nov 13, 2026",
  },
  {
    id: "EVT-02", area: "Schedule", severities: ["BLOCK"], status: "APPROVED",
    rule: "Billable dated events in a month above the quantity Fusion authorized for that month, counted in the service's own unit (visits, meals, days, adult day care minutes) → BLOCK; Fusion's count controls. A quantity is a whole number above zero; a structured family caregiver day is one day, covered once.",
    source: "Fusion's authorized quantity for the month; 3.00 Appendix 1 (rev. Jul 2026) units and limits",
  },
  {
    id: "EVT-03", area: "Schedule", severities: ["BLOCK"], status: "APPROVED",
    rule: "A shift or billable event on an authorization of class CONTEXT (ILW case management, financial management, equipment, supplies, adaptations) → BLOCK; only a reminder may be placed on it. A reminder is never billable and has no quantity.",
    source: "3.00 Appendix 1 (rev. Jul 2026); Missouri coverage audit section 10, decision 2, and PR #10 (Oct 31, 2026)",
  },
  {
    id: "NUR-01", area: "Schedule", severities: ["REVIEW"], status: "PARTIAL",
    rule: "An Advanced Personal Care authorization (T1019TF, identified by its code) whose first month is in the schedule → REVIEW \"A new Advanced Personal Care authorization is expected to have two nurse visits in its first month unless an ongoing nurse visit covers it. Check the care plan.\" Never BLOCK or PASS, and nothing in later months. No visit is created or linked: the app offers a date only for a nurse visit Fusion authorized.",
    source: "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care, as reviewed Oct 31, 2026; DHSS has not confirmed the first-month visit count",
  },
  {
    id: "NUR-02", area: "Schedule", severities: ["WARN"], status: "APPROVED",
    rule: "An authorized nurse visit month that has passed with no date placed → WARN \"No date was placed for this month's visit.\" It says nothing about whether the visit happened: the app schedules, it does not record delivery.",
    source: "Missouri coverage audit RN-04 (missed general health evaluation follow-up); the follow-up wording is a product decision, Nov 13, 2026",
  },

  // Conflicts and eligibility (conflicts.ts)
  {
    id: "CON-01", area: "Conflicts and eligibility", severities: ["BLOCK", "WARN", "REVIEW"], status: "PARTIAL",
    rule: "Same service code, same participant, overlapping visits: CDS/ILW → BLOCK; agency codes → WARN. A scheduled service with no clock times → REVIEW \"No clock times yet, so overlaps can't be checked\"; it never passes on missing data.",
    source: "CDS policy clarification Q5",
  },
  {
    id: "CON-02", area: "Conflicts and eligibility", severities: ["BLOCK", "REVIEW"], status: "PARTIAL",
    rule: "Different services overlapping: matrix `allowed` → none; `prohibited` → BLOCK; `unknown` → REVIEW. With two or more services, one with no clock times → REVIEW \"No clock times yet, so overlaps can't be checked\".",
    source: "CDS policy clarification Q5; Policy 3.50 (rev. Jul 2026)",
  },
  {
    id: "CON-03", area: "Conflicts and eligibility", severities: ["BLOCK", "REVIEW"], status: "VERIFIED",
    rule: "Respite overlapping any other service → BLOCK. With respite and another service in the plan, a service with no clock times → REVIEW \"No clock times yet, so overlaps can't be checked\".",
    source: "Policy 3.50 (rev. Jul 2026)",
  },
  {
    id: "CON-04", area: "Conflicts and eligibility", severities: ["BLOCK"], status: "APPROVED",
    rule: "Same caregiver, overlapping visits → BLOCK (across participants, or two different services for one participant).",
    source: "Product decision approved Oct 20, 2026",
  },
  {
    id: "CON-05", area: "Conflicts and eligibility", severities: ["WARN"], status: "APPROVED",
    rule: "Caregiver > 40 h in the tenant's workweek → WARN.",
    source: "FLSA; product decision approved Oct 20, 2026",
  },
  {
    id: "CON-06", area: "Conflicts and eligibility", severities: ["BLOCK", "REVIEW"], status: "VERIFIED (CDS)",
    rule: "CDS attendant is spouse or legal guardian → BLOCK; for ILW → REVIEW.",
    source: "Policy 3.25 (01/26)",
  },
  {
    id: "CON-07", area: "Conflicts and eligibility", severities: ["BLOCK", "REVIEW"], status: "VERIFIED",
    rule: "AGENCY_PC, APC, HOMEMAKER, RESPITE aide is parent, sibling, child, stepchild, spouse, grandparent or grandchild → BLOCK; not an agency employee → BLOCK. CHORE → REVIEW. RCF_PC, RCF_APC → REVIEW (Policy 3.20 doesn't restate 3.05's aide restrictions; DSDS question 14).",
    source: "Policy 3.05 (04/25); Policy 3.10 (03/25); Policy 3.20 (rev. Mar 2026); Policy 3.45 (Nov 2021); Policy 3.50 (rev. Jul 2026)",
  },
  {
    id: "CON-09", area: "Conflicts and eligibility", severities: ["BLOCK", "REVIEW"], status: "PARTIAL",
    rule: "ILW and Respite (Basic and Advanced combined): any scheduled time → one REVIEW showing the highest Sunday–Saturday week and the highest rolling 7-day stretch, since DHSS hasn't defined the week (E-02); > 49 h in every reading (seven days from each weekday, inside one month) → BLOCK.",
    source: "HCBS 06-26-01; Policy 3.50 (rev. Jul 2026); which seven days make the week is open (audit E-02)",
  },
  {
    id: "CON-10", area: "Conflicts and eligibility", severities: ["BLOCK"], status: "VERIFIED",
    rule: "Nurse visits: > 1 per date → BLOCK; > 26 in a six-month period → BLOCK.",
    source: "Policy 3.15 (04/26) as updated by HCBS 08-26-01; 3.00 Appendix 1 (rev. Jul 2026)",
  },
  {
    id: "CON-13", area: "Conflicts and eligibility", severities: ["WARN", "REVIEW"], status: "VERIFIED",
    rule: "AGENCY_PC first visit > 10 calendar days after `receivedDate` → WARN; missing `receivedDate` → REVIEW.",
    source: "13 CSR 70-91.010(1)(B)1; CDS policy clarification Q2",
  },
  {
    id: "CON-16", area: "Conflicts and eligibility", severities: ["BLOCK", "REVIEW"], status: "VERIFIED",
    rule: "Two waiver enrollments with overlapping date ranges → BLOCK; sequential is fine; ILW/RESPITE/HOMEMAKER/CHORE scheduled with no enrollment record → REVIEW.",
    source: "Policy 3.05 (04/25)",
  },
  {
    id: "CON-17", area: "Conflicts and eligibility", severities: ["REVIEW"], status: "PARTIAL",
    rule: "Missing qualification data needed by CON-06/07, nurse licence for NURSE, FCSR for ILW → REVIEW.",
    source: "Policies 3.05, 3.10, 3.15, 3.25; Policy 3.55 (FCSR registration)",
  },
  {
    id: "SFC-01", area: "Conflicts and eligibility", severities: ["BLOCK", "REVIEW"], status: "VERIFIED",
    rule: "SFCW authorization overlapping another HCBS State Plan or waiver authorization → BLOCK; unknown dates or classification → REVIEW; a non-HCBS service is not blocked.",
    source: "Policy 3.60 (rev. Jul 2026); HCBS 01-26-01 (Jan 20, 2026); Appendix 2g (rev. Jun 2026)",
  },
  {
    id: "SFC-02", area: "Conflicts and eligibility", severities: ["BLOCK"], status: "VERIFIED",
    rule: "More than one primary caregiver on an SFCW authorization → BLOCK.",
    source: "Policy 3.60 (rev. Jul 2026); Appendix 2g (rev. Jun 2026)",
  },
  ...PROGRAM_RULES,
  {
    id: "WS-R01", area: "Worksheet", severities: ["INFO"], status: "VERIFIED basis",
    rule: "A task's Min/Day is below the form's suggested time, or above it for a task with a weekly frequency (\"1-7 X WK\"; a task done as needed, per transfer or as ordered can happen several times a day) → INFO \"Outside DSDS's suggested range\". Rows whose suggested time isn't minutes are skipped.",
    source: "HCBS-3c (10/26) and HCBS-3a (07/26) suggested time columns",
  },
  {
    id: "WS-R02", area: "Worksheet", severities: ["REVIEW"], status: "PARTIAL",
    rule: "An ILW request (the 3c's ILW tab, or a 3a marked part of an ILW request) with a task that has units and no Description of needs → REVIEW.",
    source: "HCBS Manual 4.00 Appendix 4 (rev. Jul 2026) and Appendix 3 (rev. May 2025): Description of Needs is required for ILW requests",
  },
  {
    id: "WS-R03", area: "Worksheet", severities: ["INFO"], status: "VERIFIED",
    rule: "The 3c's CDS tab total is above its maximum (641) → INFO \"consider the Independent Living Waiver\".",
    source: "HCBS Manual 4.00 Appendix 4 (rev. Jul 2026)",
  },
  {
    id: "WS-R04", area: "Worksheet", severities: ["BLOCK"], status: "VERIFIED",
    rule: "Advanced Personal Care with exactly one task that has units, whose minutes aren't a multiple of 15 → BLOCK.",
    source: "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care",
  },
  {
    id: "WS-R05", area: "Worksheet", severities: ["REVIEW"], status: "PARTIAL",
    rule: "Advanced Personal Care with units, no ongoing nurse visits and fewer than 2 nurse visits in its first month → REVIEW.",
    source: "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care",
  },
  {
    id: "WS-R06", area: "Worksheet", severities: ["WARN"], status: "VERIFIED",
    rule: "General Health Evaluation checked and the Comments name no month → WARN \"only for semi-annual visits; name the months\".",
    source: "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Authorized Nurse Visits and Comments",
  },
  {
    id: "WS-R07", area: "Worksheet", severities: ["INFO"], status: "VERIFIED",
    rule: "The nurse task \"Other\" checked → INFO \"needs prior approval and authorization from DSDS or its designee\".",
    source: "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Authorized Nurse Visits",
  },
  {
    id: "WS-R08", area: "Worksheet", severities: ["BLOCK"], status: "VERIFIED",
    rule: "Adult Day Care or Adult Day Care Waiver minutes not a multiple of 15, above 600 a day, or days above 5 a week → BLOCK.",
    source: "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Adult Day Care",
  },
  {
    id: "WS-R09", area: "Worksheet", severities: ["REVIEW"], status: "PARTIAL",
    rule: "Home Delivered Meals above 2 a day → REVIEW.",
    source: "HCBS-3a (07/26) rate sheet cell G14: \"Max 2/day\"",
  },
];

export function ruleById(id: string): RuleCatalogEntry | undefined {
  return RULE_CATALOG.find((entry) => entry.id === id);
}
