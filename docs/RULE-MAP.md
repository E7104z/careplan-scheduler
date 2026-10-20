# Rule map — CarePlan Scheduler engine

Traceability from every rule in `docs/ENGINE-SPEC.md` section 5 to its implementation and
test. The conflict rules live in `conflicts.ts` (the spec's `con.ts` name is a Windows
reserved device name and cannot be created on disk).

## Rules

### Authorization

| Rule ID | File | Function | Test file | TC IDs |
|---|---|---|---|---|
| AUTH-03 | `packages/engine/src/rules/auth.ts` | `ruleAUTH03DerivedTaskUnits` | `packages/engine/test/rules-auth-sch.test.ts` | TC-37 |
| AUTH-05 | `packages/engine/src/rules/auth.ts` | `ruleAUTH05DerivedMonthUnits` | `packages/engine/test/validate.test.ts` | TC-01 (INFO emitted) |
| AUTH-06 | `packages/engine/src/rules/auth.ts` | `ruleAUTH06MigratedPlan` | — | — |
| AUTH-07 | `packages/engine/src/rules/auth.ts` | `ruleAUTH07DerivedVsFusion` | `packages/engine/test/rules-auth-sch.test.ts` | — (custom: derived 181 vs imported 180) |
| AUTH-08 | `packages/engine/src/rules/auth.ts` | `ruleAUTH08Transport` | — | — |
| AUTH-09 | `packages/engine/src/rules/auth.ts` | `ruleAUTH09Ceiling` | `packages/engine/test/rules-auth-sch.test.ts` | TC-17 |
| AUTH-11 | `packages/engine/src/rules/auth.ts` | `ruleAUTH11ProjectIlwSwitch` | `packages/engine/test/rules-auth-sch.test.ts` | TC-10 |
| AUTH-12 | `packages/engine/src/rules/auth.ts` | `ruleAUTH12PendingApproval` | `packages/engine/test/rules-auth-sch.test.ts` | — (custom) |
| AUTH-13 | `packages/engine/src/validate.ts` | `validateSchedule` (attaches `rulePackVersion`) | `packages/engine/test/validate.test.ts` | TC-01 |

### Schedule

| Rule ID | File | Function | Test file | TC IDs |
|---|---|---|---|---|
| SCH-02 | `packages/engine/src/rules/sch.ts` | `ruleSCH02TemplateDays` | `packages/engine/test/rules-auth-sch.test.ts` | — (custom) |
| SCH-03 | `packages/engine/src/rules/sch.ts` | `ruleSCH03TemplateMinutes` | `packages/engine/test/rules-auth-sch.test.ts` | TC-16 (WARN) |
| SCH-08 | `packages/engine/src/rules/sch.ts` | `ruleSCH08CalendarCheck` | `packages/engine/test/rules-auth-sch.test.ts` | TC-16 (BLOCK) |
| SCH-11 | `packages/engine/src/rules/sch.ts` | `ruleSCH11RepeatedExceptions` | — | — |
| SCH-12 | `packages/engine/src/rules/sch.ts` | `ruleSCH12PartialMonth` | `packages/engine/test/rules-auth-sch.test.ts` | TC-21 |
| SCH-14 | `packages/engine/src/rules/sch.ts` | `ruleSCH14VisitDates` | `packages/engine/test/rules-auth-sch.test.ts` | TC-22, TC-24 |
| SCH-15 | `packages/engine/src/calendar/time.ts` | `elapsedMinutes`, `splitByDate` | `packages/engine/test/calendar.test.ts` | TC-27, TC-28 |

### Conflicts and eligibility

| Rule ID | File | Function | Test file | TC IDs |
|---|---|---|---|---|
| CON-01 | `packages/engine/src/rules/conflicts.ts` | `ruleCON01SameServiceOverlap` | `packages/engine/test/rules-con.test.ts` | TC-08a |
| CON-02 | `packages/engine/src/rules/conflicts.ts` | `ruleCON02DifferentServiceOverlap` | `packages/engine/test/rules-con.test.ts` | TC-08b, TC-08c |
| CON-03 | `packages/engine/src/rules/conflicts.ts` | `ruleCON03RespiteOverlap` | `packages/engine/test/rules-con.test.ts` | TC-07 |
| CON-04 | `packages/engine/src/rules/conflicts.ts` | `ruleCON04CaregiverOverlap` | `packages/engine/test/rules-con.test.ts` | TC-32 |
| CON-05 | `packages/engine/src/rules/conflicts.ts` | `ruleCON05CaregiverHours` | `packages/engine/test/rules-con.test.ts` | TC-33 |
| CON-06 | `packages/engine/src/rules/conflicts.ts` | `ruleCON06AttendantRelationship` | `packages/engine/test/rules-con.test.ts` | TC-14 |
| CON-07 | `packages/engine/src/rules/conflicts.ts` | `ruleCON07AgencyAide` | `packages/engine/test/rules-con.test.ts` | TC-13 |
| CON-09 | `packages/engine/src/rules/conflicts.ts` | `ruleCON09WeeklyHours` | `packages/engine/test/rules-con.test.ts`, `packages/engine/test/calendar.test.ts` | TC-11, TC-25, TC-26 |
| CON-10 | `packages/engine/src/rules/conflicts.ts` | `ruleCON10NurseVisits` | `packages/engine/test/rules-con.test.ts` | TC-15 |
| CON-13 | `packages/engine/src/rules/conflicts.ts` | `ruleCON13FirstVisit` | `packages/engine/test/rules-con.test.ts` | — (custom) |
| CON-16 | `packages/engine/src/rules/conflicts.ts` | `ruleCON16WaiverEnrollments` | `packages/engine/test/rules-con.test.ts` | TC-18, TC-29, TC-30 |
| CON-17 | `packages/engine/src/rules/conflicts.ts` | `ruleCON17QualificationData` | `packages/engine/test/rules-con.test.ts` | TC-35 |

## Section 7 test cases without a test

These belong to later phases and have no Phase 1 test:

| TC | Reason |
|---|---|
| TC-19 | app-level |
| TC-23 | amendment |
| TC-34 | GHE |
| TC-36 | exports |
