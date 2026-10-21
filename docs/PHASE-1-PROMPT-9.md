# CarePlan Scheduler — Phase 1, Prompt 9 (review fixes)

Save this file as `docs/PHASE-1-PROMPT-9.md`, then paste the block below into Cline.
Branch: `phase-1-engine` (same branch; the open pull request updates automatically).

```
Read .clinerules, docs/ENGINE-SPEC.md and docs/PHASE-1-PROMPT-9.md first.

This prompt fixes defects found in review. Work in this exact order: for each fix, FIRST
add the regression test described (it must fail against the current code), THEN change the
code until it passes. Do not change any existing test's expected values. Do not add features
beyond what is listed.

All new regression tests go in packages/engine/test/review-fixes.test.ts, one describe block
per fix, named "FIX-n ...". Participant ids: P-1, P-2. Caregiver ids: C-1, C-2.

────────────────────────────────────────
FIX-1  SCH-08 must check the imported Fusion authorization (HIGH)
Problem: ruleSCH08CalendarCheck compares scheduled minutes only with derived task units and
never reads monthlyAuthorizations, so a schedule above the Fusion authorization passes.

Change:
- New signature: ruleSCH08CalendarCheck(authorizations, monthlyAuthorizations, template,
  exceptions, months).
- For each authorization and each month in `months`:
  a) Service budget (minutes):
     - If a MonthlyAuthorization with source "fusion" exists for (auth.id, month), use
       units = that value; label "Fusion".
     - Otherwise units = sum of F-3 task units for auth.tasks + transport units
       (floor(transportMinutesPerMonth / 15), 0 if undefined); label "derived".
     - Subtract transport units from the budget when transportMinutesPerMonth is defined,
       because template entries never contain transport time:
       taskBudgetMinutes = (units - transportUnits) * 15.
  b) Scheduled minutes = sum of expanded template + exception minutes for this auth's task
     ids, only on dates inside [auth.start, auth.end].
  c) scheduled > taskBudgetMinutes  → BLOCK, message names the label, e.g.
     "Scheduled 900 min exceeds Fusion authorization 600 min in 2026-11".
  d) Keep the existing per-task check (scheduled task minutes > 15 × F-3 task units) as
     BLOCK, message prefixed "Task limit (derived):".
- Update validate.ts to call the new signature.

Regression test FIX-1:
  AGENCY_PC auth A-PC, 2026-11-01..2026-11-30, one task Dietary 30 min × 7.
  Template: Dietary 30 min on all 7 weekdays (900 min in November).
  monthlyAuthorizations: { A-PC, "2026-11", units 40, source "fusion" }.
  Expect one SCH-08 BLOCK whose message contains "Fusion" and "600".
  Second case: same, but Fusion units 60 → no SCH-08 result.
  Third case: CDS auth, task Bathing 30 × 7, transportMinutesPerMonth 450, Fusion units 90,
  template Bathing 30 × 7 (900 min). Budget = (90 − 30) × 15 = 900 → no SCH-08 result.

────────────────────────────────────────
FIX-2  Eligibility rules must check only caregivers assigned to that service (HIGH)
Problem: CON-06, CON-07 and CON-17 test every caregiver against every authorization.
A participant whose daughter is the CDS attendant and who also has an agency aide gets
false CON-07 BLOCKs on the agency service.

Change:
- Add helper assignedCaregiverIds(auth, visits): caregiver ids on visits where
  visit.participantId === auth.participantId, visit.serviceCode === auth.serviceCode and the
  visit date is inside [auth.start, auth.end].
- CON-06, CON-07, CON-17 take `visits` as an extra parameter and evaluate only those
  caregivers. No visits for a service → no results for that service.
- Update validate.ts.

Regression test FIX-2:
  P-1 has CDS auth A-CDS (T1019U2) and AGENCY_PC auth A-PC (T1019), both 2026-11.
  C-1: relationships { "P-1": "child" }, agencyEmployee false; visit on T1019U2 2026-11-02 08:00–08:30.
  C-2: relationships { "P-1": "none" }, agencyEmployee true; visit on T1019 2026-11-02 12:00–12:30.
  Expect: zero CON-06 results, zero CON-07 results, zero CON-17 results.
  Second case: change C-2's relationship to "grandchild" → exactly one CON-07 BLOCK, refs.serviceAuthId "A-PC".

────────────────────────────────────────
FIX-3  Derived monthly units must include transport (MEDIUM)
Problem: derivedMonthUnits in validate.ts sums task units only; Fusion monthly units
include transport (AUTH-04), so every CDS plan with transport gets a false AUTH-07 REVIEW.

Change: derived month units = Σ F-3 task units + floor(transportMinutesPerMonth / 15)
(0 when undefined). Move derivedMonthUnits into src/math/units.ts as
derivedServiceMonthUnits(auth, year, month) and export it; SCH-08 (FIX-1) uses the same function.

Regression test FIX-3:
  CDS auth, Bathing 30 min × 7, transportMinutesPerMonth 450, month 2026-11 (30 days).
  derivedServiceMonthUnits → 60 + 30 = 90.
  With Fusion units 90 → no AUTH-07 result. With Fusion units 92 → one AUTH-07 REVIEW.

────────────────────────────────────────
FIX-4  49-hour checks per participant and per limit group (MEDIUM)
Problem: weeklyHoursDailyMinutes adds ILW and respite minutes for all participants together.

Change:
- Group visits by participantId and by limit group: "ILW" = T1019U6; "RESPITE" = S5150 + S5150TF.
- Call ruleCON09WeeklyHours once per (participant, group); include both in the message.
- Add `participantId?: string` to ValidationResult.refs in types.ts and set it.

Regression test FIX-4:
  P-1 and P-2 each have T1019U6 visits 08:00–12:00 every day 2026-11-01..2026-11-07 (28 h each).
  Expect zero CON-09 results.
  Second case: P-1 alone 08:00–15:30 every day that week (52.5 h) → exactly one CON-09 REVIEW
  with refs.participantId "P-1" (the rolling-window WARN for the same week is also expected).
  Third case: P-1 has S5150 08:00–12:00 and S5150TF 13:00–17:00 every day that week (56 h
  combined) → exactly one CON-09 REVIEW (respite group combined), plus its rolling-window WARN.

────────────────────────────────────────
FIX-5  HCBS-3c rounding must use integer math (LOW)
Problem: hcbs3cTaskUnits(31, 3) returns 32; (31/15)*15 is 31.000000000000004 in floating point.

Change in src/math/units.ts:
- hcbs3cTaskUnits(minPerDay, dpw): num = minPerDay * factor; units = Math.floor((num + 14) / 15).
- Add hcbs3cTaskUnitsFromWeekly(weeklyMinutes, timesPerWeek): num = weeklyMinutes * factor,
  den = timesPerWeek * 15, units = Math.floor((num + den - 1) / den).
- AUTH-03 uses hcbs3cTaskUnitsFromWeekly (never divides minutes first).
- minPerDay and weeklyMinutes must be integers; throw RangeError otherwise.

Regression test FIX-5:
  hcbs3cTaskUnits(31, 3).units === 31.
  For every integer m in 1..600 and dpw in 1..7: let u = hcbs3cTaskUnits(m, dpw).units;
  assert u * 15 >= m * factor and (u - 1) * 15 < m * factor.
  Existing tests (474, 4, 7, TC-37 = 19 from 61 weekly minutes) must still pass; change the
  TC-37 F-2a call to hcbs3cTaskUnitsFromWeekly(61, 7).

────────────────────────────────────────
FIX-6  Smaller corrections
6a AUTH-03: emit a result only when F-2a and F-2b differ (REVIEW). Remove the INFO result.
   Test: TC-01 tasks produce zero AUTH-03 results; the 61-weekly-minute task produces one REVIEW.
6b AUTH-06: add `migratedFromWebTool?: boolean` to ServiceAuthorization; the rule reads it
   per authorization (remove the separate boolean parameter).
   Test: one auth with migratedFromWebTool true → one WARN for that auth only.
6c SCH-14: for each visit, find the authorization for that participant + serviceCode whose
   [start, end] contains the visit date. None found → BLOCK "No authorization covers <date>".
   Suspension and future-state checks apply to the matched authorization.
   Test: two versions of the same service (rev 1: 2026-10-01..2026-10-31; rev 2:
   2026-11-01..2026-11-30, suspension 2026-11-05..2026-11-06). Visits on 10-15 and 11-10 → no
   SCH-14 result; visit on 11-05 → one BLOCK; visit on 12-01 → one BLOCK "No authorization covers".
6d AUTH-11: daily units for the projection come only from tasks of CDS and ILW
   authorizations, not every template entry.
   Test: add an AGENCY_PC task to the TC-10 fixture; projection still day 18 (24 SP + 4 ILW).
6e CON-02: skip any pair involving RESPITE (CON-03 owns those) so respite overlaps are
   reported once.
   Test: for the TC-07 visits, ruleCON02DifferentServiceOverlap returns zero results and
   ruleCON03RespiteOverlap returns exactly one BLOCK.

────────────────────────────────────────
FIX-7  Correct @source tags (from the approved v0.3 specification)

Replace the @source JSDoc line on each rule with exactly this text:

AUTH-03  HCBS-3c (10/26) cell Q11; DHSS 4.00 Appendix 14a/14b cell M7
AUTH-05  INFO 05-25-03 (May 9, 2025); Fusion FAQ (Jun 4, 2025); DHSS 14a/14b cell D37
AUTH-06  INFO 05-25-03 (May 9, 2025)
AUTH-07  Product decision approved Oct 20, 2026 (P-02)
AUTH-08  Policy 3.25 (01/26); HCBS-3c cell L88
AUTH-09  3.00 Appendix 1 (rev. Jul 2026); Policy 3.50 (rev. Jul 2026); HCBS 06-26-01
AUTH-11  Policy 3.55 (01/26)
AUTH-12  Policy 3.55 (01/26); 3.00 Appendix 1 (rev. Jul 2026)
AUTH-13  Product decision approved Oct 20, 2026 (P-06)
SCH-02   INFO 09-25-02 (Sep 23, 2025); DHSS 14a/14b cell D7; 13 CSR 70-91.010(3)(H)2
SCH-03   Product decision approved Oct 20, 2026; DHSS 14a/14b weekly grid
SCH-08   DHSS 14a/14b "Example Month" sheet; 13 CSR 70-91.010(1)(B)2
SCH-11   INFO 09-25-02 (Sep 23, 2025); CDS policy clarification Q9; two-month trigger is a product heuristic
SCH-12   Product decision approved Oct 20, 2026
SCH-14   Product decision approved Oct 20, 2026; Policy 3.55 (pending BFP approval)
SCH-15   Product decision approved Oct 20, 2026
CON-01   CDS policy clarification Q5
CON-02   CDS policy clarification Q5; Policy 3.50 (rev. Jul 2026)
CON-03   Policy 3.50 (rev. Jul 2026)
CON-04   Product decision approved Oct 20, 2026
CON-05   FLSA; product decision approved Oct 20, 2026
CON-06   Policy 3.25 (01/26)
CON-07   Policy 3.05 (04/25); Policy 3.10 (03/25); Policy 3.45 (Nov 2021); Policy 3.50 (rev. Jul 2026)
CON-09   HCBS 06-26-01; Policy 3.50 (rev. Jul 2026); Sunday-Saturday week is a product convention
CON-10   Policy 3.15 (04/26) as updated by HCBS 08-26-01; 3.00 Appendix 1 (rev. Jul 2026)
CON-13   13 CSR 70-91.010(1)(B)1; CDS policy clarification Q2
CON-16   Policy 3.05 (04/25)
CON-17   Policies 3.05, 3.10, 3.15, 3.25; Policy 3.55 (FCSR registration)

Also add a "Source" column with the same text to every rule table in docs/ENGINE-SPEC.md
section 5 and to docs/RULE-MAP.md.

Regression test FIX-7 (packages/engine/test/sources.test.ts): read every file in src/rules/
as text; for each rule ID above, assert the JSDoc block containing "@rule <ID>" also
contains the exact @source text listed. (Use node:fs in the test only.)

────────────────────────────────────────
Finish:
1. Run npx tsc --noEmit and npx vitest run in packages/engine. Paste both summaries.
2. Update docs/RULE-MAP.md: add the FIX tests next to the rules they cover.
3. Commit: "fix(engine): review fixes FIX-1..FIX-7 with regression tests".
4. Push. Add a pull request comment listing each FIX with its test name and result.
```
