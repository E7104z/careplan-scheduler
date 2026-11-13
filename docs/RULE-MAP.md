# Rule map — CarePlan Scheduler engine

Traceability from every rule in `docs/ENGINE-SPEC.md` section 5 to its implementation and
test. The conflict rules live in `conflicts.ts` (the spec's `con.ts` name is a Windows
reserved device name and cannot be created on disk).

The Source column is the `@source` citation from the approved v0.3 specification.
`packages/engine/test/sources.test.ts` (FIX-7) fails if any rule's `@source` tag drifts from it.
FIX IDs refer to the review-fix regression tests in `packages/engine/test/review-fixes.test.ts`
(see `docs/PHASE-1-PROMPT-9.md`).

## Rules

### Authorization

| Rule ID | File | Function | Test file | TC IDs | Source |
|---|---|---|---|---|---|
| AUTH-03 | `packages/engine/src/rules/auth.ts` | `ruleAUTH03DerivedTaskUnits` | `packages/engine/test/rules-auth-sch.test.ts`, `packages/engine/test/review-fixes.test.ts` | TC-37, FIX-5, FIX-6a | HCBS-3c (10/26) cell Q11; DHSS 4.00 Appendix 14a/14b cell M7 |
| AUTH-05 | `packages/engine/src/rules/auth.ts` | `ruleAUTH05DerivedMonthUnits` | `packages/engine/test/validate.test.ts`, `packages/engine/test/review-fixes.test.ts`, `packages/engine/test/facility-rules.test.ts` | TC-01 (INFO emitted), FIX-3 (`derivedServiceMonthUnits`), RCF/ALF proration | INFO 05-25-03 (May 9, 2025); Fusion FAQ (Jun 4, 2025); DHSS 14a/14b cell D37 |
| AUTH-06 | `packages/engine/src/rules/auth.ts` | `ruleAUTH06MigratedPlan` | `packages/engine/test/review-fixes.test.ts` | FIX-6b | INFO 05-25-03 (May 9, 2025) |
| AUTH-07 | `packages/engine/src/rules/auth.ts` | `ruleAUTH07DerivedVsFusion` | `packages/engine/test/rules-auth-sch.test.ts`, `packages/engine/test/review-fixes.test.ts` | — (custom: derived 181 vs imported 180), FIX-3 | Product decision approved Oct 20, 2026 (P-02) |
| AUTH-08 | `packages/engine/src/rules/auth.ts` | `ruleAUTH08Transport` | — | — | Policy 3.25 (01/26); HCBS-3c cell L88 |
| AUTH-09 | `packages/engine/src/rules/auth.ts` | `ruleAUTH09Ceiling` | `packages/engine/test/rules-auth-sch.test.ts` | TC-17 | 3.00 Appendix 1 (rev. Jul 2026); Policy 3.50 (rev. Jul 2026); HCBS 06-26-01 |
| AUTH-11 | `packages/engine/src/rules/auth.ts` | `ruleAUTH11ProjectIlwSwitch` | `packages/engine/test/rules-auth-sch.test.ts`, `packages/engine/test/review-fixes.test.ts` | TC-10, FIX-6d | Policy 3.55 (01/26) |
| AUTH-12 | `packages/engine/src/rules/auth.ts` | `ruleAUTH12PendingApproval` | `packages/engine/test/rules-auth-sch.test.ts` | — (custom) | Policy 3.55 (01/26); 3.00 Appendix 1 (rev. Jul 2026) |
| AUTH-13 | `packages/engine/src/validate.ts` | `validateSchedule`, `validatePlan` (attach `rulePackVersion`) | `packages/engine/test/validate.test.ts` | TC-01 | Product decision approved Oct 20, 2026 (P-06) |

### Schedule

| Rule ID | File | Function | Test file | TC IDs | Source |
|---|---|---|---|---|---|
| SCH-02 | `packages/engine/src/rules/sch.ts` | `ruleSCH02TemplateDays` | `packages/engine/test/rules-auth-sch.test.ts` | — (custom) | INFO 09-25-02 (Sep 23, 2025); DHSS 14a/14b cell D7; 13 CSR 70-91.010(3)(H)2 |
| SCH-03 | `packages/engine/src/rules/sch.ts` | `ruleSCH03TemplateMinutes` | `packages/engine/test/rules-auth-sch.test.ts` | TC-16 (WARN) | Product decision approved Oct 20, 2026; DHSS 14a/14b weekly grid |
| SCH-08 | `packages/engine/src/rules/sch.ts` | `ruleSCH08CalendarCheck` | `packages/engine/test/rules-auth-sch.test.ts`, `packages/engine/test/review-fixes.test.ts` | TC-16 (BLOCK), FIX-1 | DHSS 14a/14b "Example Month" sheet; 13 CSR 70-91.010(1)(B)2 |
| SCH-11 | `packages/engine/src/rules/sch.ts` | `ruleSCH11RepeatedExceptions` | `packages/engine/test/fit.test.ts` | TC-39 | INFO 09-25-02 (Sep 23, 2025); CDS policy clarification Q9; two-month trigger is a product heuristic |
| SCH-12 | `packages/engine/src/rules/sch.ts` | `ruleSCH12PartialMonth` | `packages/engine/test/rules-auth-sch.test.ts` | TC-21 | Product decision approved Oct 20, 2026 |
| SCH-14 | `packages/engine/src/rules/sch.ts` | `ruleSCH14VisitDates` | `packages/engine/test/rules-auth-sch.test.ts`, `packages/engine/test/review-fixes.test.ts` | TC-22, TC-24, FIX-6c | Product decision approved Oct 20, 2026; Policy 3.55 (pending BFP approval) |
| SCH-15 | `packages/engine/src/calendar/time.ts` | `elapsedMinutes`, `splitByDate` | `packages/engine/test/calendar.test.ts` | TC-27, TC-28 | Product decision approved Oct 20, 2026 |
| SCH-17 | `packages/engine/src/rules/fit.ts` | `fitToAuthorization` | `packages/engine/test/fit.test.ts` | TC-38, TC-39 | Product decision approved Oct 21, 2026 (schedules never exceed SCH-08) |

### Conflicts and eligibility

| Rule ID | File | Function | Test file | TC IDs | Source |
|---|---|---|---|---|---|
| CON-01 | `packages/engine/src/rules/conflicts.ts` | `ruleCON01SameServiceOverlap` | `packages/engine/test/rules-con.test.ts` | TC-08a | CDS policy clarification Q5 |
| CON-02 | `packages/engine/src/rules/conflicts.ts` | `ruleCON02DifferentServiceOverlap` | `packages/engine/test/rules-con.test.ts`, `packages/engine/test/review-fixes.test.ts` | TC-08b, TC-08c, FIX-6e | CDS policy clarification Q5; Policy 3.50 (rev. Jul 2026) |
| CON-03 | `packages/engine/src/rules/conflicts.ts` | `ruleCON03RespiteOverlap` | `packages/engine/test/rules-con.test.ts`, `packages/engine/test/review-fixes.test.ts` | TC-07, FIX-6e | Policy 3.50 (rev. Jul 2026) |
| CON-04 | `packages/engine/src/rules/conflicts.ts` | `ruleCON04CaregiverOverlap` | `packages/engine/test/rules-con.test.ts` | TC-32 | Product decision approved Oct 20, 2026 |
| CON-05 | `packages/engine/src/rules/conflicts.ts` | `ruleCON05CaregiverHours` | `packages/engine/test/rules-con.test.ts` | TC-33 | FLSA; product decision approved Oct 20, 2026 |
| CON-06 | `packages/engine/src/rules/conflicts.ts` | `ruleCON06AttendantRelationship` | `packages/engine/test/rules-con.test.ts`, `packages/engine/test/review-fixes.test.ts` | TC-14, FIX-2 | Policy 3.25 (01/26) |
| CON-07 | `packages/engine/src/rules/conflicts.ts` | `ruleCON07AgencyAide` | `packages/engine/test/rules-con.test.ts`, `packages/engine/test/review-fixes.test.ts`, `packages/engine/test/facility-rules.test.ts` | TC-13, FIX-2, RCF/ALF REVIEW | Policy 3.05 (04/25); Policy 3.10 (03/25); Policy 3.20 (rev. Mar 2026); Policy 3.45 (Nov 2021); Policy 3.50 (rev. Jul 2026) |
| CON-09 | `packages/engine/src/rules/conflicts.ts` | `ruleCON09WeeklyHours`; on the expanded template via `validatePlan` (Amendment B) | `packages/engine/test/rules-con.test.ts`, `packages/engine/test/calendar.test.ts`, `packages/engine/test/review-fixes.test.ts`, `packages/engine/test/validate.test.ts` | TC-11, TC-25, TC-26, FIX-4 | HCBS 06-26-01; Policy 3.50 (rev. Jul 2026); Sunday-Saturday week is a product convention |
| CON-10 | `packages/engine/src/rules/conflicts.ts` | `ruleCON10NurseVisits` | `packages/engine/test/rules-con.test.ts` | TC-15 | Policy 3.15 (04/26) as updated by HCBS 08-26-01; 3.00 Appendix 1 (rev. Jul 2026) |
| CON-13 | `packages/engine/src/rules/conflicts.ts` | `ruleCON13FirstVisit` | `packages/engine/test/rules-con.test.ts` | — (custom) | 13 CSR 70-91.010(1)(B)1; CDS policy clarification Q2 |
| CON-16 | `packages/engine/src/rules/conflicts.ts` | `ruleCON16WaiverEnrollments` | `packages/engine/test/rules-con.test.ts` | TC-18, TC-29, TC-30 | Policy 3.05 (04/25) |
| CON-17 | `packages/engine/src/rules/conflicts.ts` | `ruleCON17QualificationData` | `packages/engine/test/rules-con.test.ts`, `packages/engine/test/review-fixes.test.ts` | TC-35, FIX-2 | Policies 3.05, 3.10, 3.15, 3.25; Policy 3.55 (FCSR registration) |

## Catalog

| File | Exports | Test file | Checks |
|---|---|---|---|
| `packages/engine/src/rulepacks/catalog.ts` | `RULE_CATALOG`, `ruleById`, `RuleArea`, `RuleStatus`, `RuleCatalogEntry` | `packages/engine/test/catalog.test.ts` | Same IDs, order, rule text, status, source and severities as section 5 of `docs/ENGINE-SPEC.md`; every `ruleId` in `src/rules/*.ts` is listed |

## Review fixes (Prompt 9)

| Fix | Rules | Test (`describe` block) |
|---|---|---|
| FIX-1 | SCH-08 | `review-fixes.test.ts` › FIX-1 SCH-08 checks the imported Fusion authorization |
| FIX-2 | CON-06, CON-07, CON-17 | `review-fixes.test.ts` › FIX-2 eligibility rules check only caregivers assigned to the service |
| FIX-3 | AUTH-05, AUTH-07 | `review-fixes.test.ts` › FIX-3 derived monthly units include transport |
| FIX-4 | CON-09 | `review-fixes.test.ts` › FIX-4 49-hour checks run per participant and per limit group |
| FIX-5 | AUTH-03 (F-2a) | `review-fixes.test.ts` › FIX-5 HCBS-3c rounding uses integer math |
| FIX-6 | AUTH-03 (6a), AUTH-06 (6b), SCH-14 (6c), AUTH-11 (6d), CON-02/CON-03 (6e) | `review-fixes.test.ts` › FIX-6 smaller corrections |
| FIX-7 | every rule above | `sources.test.ts` › FIX-7 rule @source tags match the approved v0.3 specification |

## Section 7 test cases without a test

These belong to later phases and have no Phase 1 test:

| TC | Reason |
|---|---|
| TC-19 | app-level |
| TC-23 | amendment |
| TC-34 | GHE |
| TC-36 | exports |
