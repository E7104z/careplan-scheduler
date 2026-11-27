# Missouri complete service coverage: audit, plan and acceptance tests

Oct 31, 2026. Answers the request in `docs/All Schedules/` (blueprint, build instructions, the
21-entry service registry, the 51-row task inventory and the de-identified multi-service
fixture, with the request saved as `REQUEST-2026-10-31.md`). The request asks for an audit, a
coverage report, a phased plan and an acceptance-test matrix before production changes. This
document is that, and it records one change made on branch `missouri-coverage` that was
certainly needed (section 3). Nothing here is deployed: production changes only when the owner
merges.

## 1. Summary

- **Services:** before this branch, the app recognized 9 of DHSS's 21 Appendix 1 services. For
  the other 12, a care plan could not be imported without the person mislabeling the service
  as a 15-minute one. Now **21 of 21 are recognized**: 9 are scheduled as before, and 12 are
  kept with the plan, shown and printed, but not placed in the week yet.
- **Worksheet rows:** **51 of 51** HCBS-3a/3c rows are recognized: 50 tasks match the rule
  pack's task of the same service, and `MED REL HC TASKS` is read as the control row it is.
- **One participant schedule:** the participant-first care plan (APP-SPEC 5.8, PR #8) already
  puts every time-based service in one week while keeping each authorization's units
  separate. Fixture F (the de-identified real plan: agency PC 226, CDS transportation 40,
  homemaker 5, GHEs in May and August) proves it (section 6, JOIN-01).
- **Still to build:** placing date-based services (nurse visits, adult day care, meals,
  covered days) on the calendar, chore as one-time work, caregivers, CSV/XLSX export, and the
  rules that depend on them. Section 7 phases this work. Several rules wait on evidence only
  DHSS can give (section 8).

## 2. Repository baseline (before any change)

| Item | Finding |
|---|---|
| Branches | `origin/main` at `445fe3f` (PR #6 merged). Open: PR #5 (`phase-3-worksheet`, the DSDS workbooks and worksheet view), PR #7 (`fix-report-service-table`), PR #8 (`unified-care-plan`, includes #7; CI green). This branch is cut from #8. |
| Deployment | Firebase Hosting builds and serves `apps/web` (`firebase.json`). The deployed commit was not checked from here. Merge order keeps it safe: #7, #8, then this branch. |
| `npm run typecheck` | passes |
| `npm test` | 858 pass: engine 256, import 125, desktop 15, web 462 |
| `npm run build` | passes; `/quick` page 165.8 KB gzip of its 180 KB budget |
| Lint | the repo has no lint script; `tsc --noEmit` and the Tailwind class checks are what runs |
| Playwright (public) | 93 pass, 17 skipped (as designed) |
| Parser | `packages/import`: care plan screen paste, PDF text, and the care plan report (IMP-17/18), every block read |
| Units engine | `packages/engine`: F-2a/F-2b task units, F-3 month proration, transport allowance (AUTH-08), SCH/AUTH/CON rules with sources (`rulepacks/catalog.ts`) |
| Worksheet parity | `stateparity/calc3a.ts`, `calc3c.ts` with golden fixtures (WS-R01..R09, merged); workbook XLSX bytes and the parity ledger are in PR #5 |
| Calendar | real dates per month, partial months, suspensions, fit-to-month trims, America/Chicago elapsed minutes (SCH-15) |
| Print/PDF | one landscape page per service; whole-plan page first (APP-SPEC 5.4, 5.8) |
| Storage | Quick Schedule: browser session only, name and DCN never stored (APP-SPEC 5.6); agency mode: Firestore with tenant rules and rules tests |

## 3. The change made on this branch, and why it was certain

**Defect:** in `apps/web/src/features/import/importFlow.ts`, a service label the app hadn't
seen was a hard stop, and the only answers offered were the rule pack's nine services. A care
plan with home delivered meals, adult day care, an RCF/ALF service, an ILW support or
structured family caregiving could not be imported unless the person called it, say,
homemaker. That would schedule meals as 15-minute units. The request rules out both outcomes
("nothing is silently discarded"; "never convert meals into care hours").

**Fix (commit `f742466`, IMPORT-SPEC IMP-19, APP-SPEC 5.8, AC-30):**

- `packages/engine/src/rulepacks/appendix1.ts`: all 21 rows of 3.00 Appendix 1 (rev. Jul 2026)
  with DHSS's code, unit and limit, a schedule class (AUTO 10, APPOINTMENT 6, CONTEXT 5) and
  the engine service when one exists. The test compares it with DHSS's table (read Oct 31,
  2026) and with the owner's registry JSON (INV-01).
- The importer keeps any block it can't place in the week in `others`: its code as printed, its
  Appendix 1 service (or none), provider, PA, every month's units and its rows exactly as
  read, with a note saying why it isn't in the week. It never identifies a service by `T1019`
  alone (INV-04 still asks), and meals, months, costs and covered days are never turned into
  15-minute units.
- A label the app hasn't seen can now be kept ("Keep it, don't schedule it") instead of named.
- The whole-plan summary says what was read and what became of it, counted from the plan (for
  fixture F: "5 authorizations read: 3 scheduled in the week, 2 nurse visits by month.").
- A new **Other authorizations** panel lists each kept authorization in its own unit
  ("62 meals a month"), with the raw Fusion rows on demand; a code outside Appendix 1 is marked
  "Not recognized: kept for review".
- Every printout names the kept authorizations. A one-service printout now also names the
  nurse visits by month; it left them out before.
- Plans saved by the live version still load (`others` is optional).

**Evidence:** 33 new unit and component tests (CALC-01 among them) and 4 new accessibility
checks, all passing. Each new behavior was broken on purpose to confirm a test fails (6
mutations, all caught). The axe checks on fixture G pass at desktop and phone width in both
themes. Totals after: engine 263, import 138, desktop 15, web 476; Playwright public 97 passed
(17 skipped, as before); typecheck and build pass. The `/quick` page grew 3.2 KB to 169.0 KB
of its 180 KB budget, so Phase 3's calendar must watch its size (split it into its own chunk
if needed).

## 4. Corrections to the package

Only those certain from a primary source. None of the package files is edited; they stay as
given.

| # | Package says | Correct | Source |
|---|---|---|---|
| 1 | "These are the 20 service-code entries", then "all six State Plan entries" | 21 entries; **7** State Plan entries (APC, APC RCF/ALF, Nurse, Nurse RCF/ALF, Basic PC Agency, Basic PC RCF/ALF, CDS) | 3.00 Appendix 1 (rev. Jul 2026), read Oct 31, 2026 |
| 2 | "Structured Family Caregiving" | DHSS's table names it "Structured Family Caregiver" (the waiver is the Structured Family Caregiver Waiver); the app uses DHSS's names | same |
| 3 | Registry: respite has no monthly limit | Appendix 1 prints "868 units/mo" on **each** respite line. The shared 868 across Basic + Advanced comes from Policy 3.50, as the blueprint says; the app already blocks the combined total (AUTH-09) | same; Policy 3.50 |
| 4 | Blueprint E-13: the 10-day receipt-to-first-service rule "needs live cross-check" | Already implemented as CON-13 (WARN), sourced to 13 CSR 70-91.010(1)(B)1 | `rulepacks/catalog.ts` |
| 5 | Blueprint 4: 3a household switch | Confirmed in the workbook: `N29=IF(Sheet2!L2=TRUE,SUM(N33:N63),0)`, `N66=IF(Sheet2!L2=FALSE,SUM(N33:N63),0)`. Note: that is **all 11** homemaker rows, while the rule pack offers agency PC the 7 household tasks seen in Fusion (Amendment B). Imports aren't affected (any `Med Rel HC Tasks:` row matches); offering all 11 when building by hand is listed in Phase 2 | `4.00appendix3da3aform.xlsx` (PR #5) |
| 6 | Blueprint 4 / E-18: chore `N115` anomaly | Confirmed: `N115=IF(G115>0,ROUNDUP(G115*L115/15,0),"")`, while `N112` and `N119` use the task-frequency formula | same |

One point to be aware of rather than a correction: Appendix 1 lists ILW Case Management at
$38.17 a month, while the HCBS-3c ILW tab's case management amount in the rule pack is
$458.09 (HCBS-3c ILW tab, cells Q96-Q100). Twelve months of $38.17 is $458.04, not $458.09, so the two figures
don't reconcile. The scheduler doesn't use costs; this is added to the DHSS questions
(section 8).

## 5. Coverage report

### 5.1 The 21 Appendix 1 services

"Before" is `origin/main` plus PR #8; "now" is this branch. Classes: AUTO = scheduled from tasks;
APPOINTMENT = needs dates someone chooses; CONTEXT = an authorization with no caregiver time.

| ID | Service | Code | Unit | Class | Before | Now |
|---|---|---|---|---|---|---|
| MO_PC_AGENCY | Basic Personal Care – Agency | T1019 | 15 min | AUTO | Supported (label `PC - Agency`) | Supported |
| MO_APC_AGENCY | Advanced Personal Care | T1019TF | 15 min | AUTO | Partial: schedules; identified by code (label not yet seen); no link to its monthly RN evaluation | Partial: scheduled; identified by code; its first-month nurse visits are under review (NUR-01) until DHSS confirms the count |
| MO_RN_AGENCY | Authorized Nurse Visits | T1001 | visit | APPOINTMENT | Partial: GHE and other visits listed by month; not placed on a date; 1/day and 26/6 months exist in the engine (CON-10) only | Supported by date (Phase 3): each authorized visit is placed on a date in its month; 1 a day and 26 in six months enforced (CON-10); a GHE at a regular visit is one visit; missed-month follow-up and the upload reminder |
| MO_PC_RCF | Basic Personal Care – RCF/ALF | T1019U3 | 15 min | AUTO (facility) | **Missing**: import stopped | Supported as a facility service (Phase 2, CP2-5): scheduled, kept separate from the home code |
| MO_APC_RCF | Advanced Personal Care – RCF/ALF | T1019U3 TF | 15 min | AUTO (facility) | **Missing** | Supported as a facility service (Phase 2, CP2-5): scheduled, kept separate from the home code |
| MO_RN_RCF | Authorized Nurse Visits – RCF/ALF | T1001U3 | visit | APPOINTMENT | **Missing** | Kept, and placed by date (Phase 3): a visit a day in an authorized month |
| MO_CDS | Personal Care Assistance – CDS | T1019U2 | 15 min | AUTO | Supported (label `PC - CDS`, shown as T1019 by Fusion), transportation included | Supported |
| MO_ADW_ADC | Adult Day Care (ADW) | S5100HC | 15 min | APPOINTMENT | **Missing** (worksheet math WS-R08 only) | Supported by date (Phase 3): attendance in minutes with its transportation, caps enforced; never caregiver time |
| MO_ADW_HC | Homemaker | S5130 | 15 min | AUTO | Supported (label `HC`) | Supported |
| MO_ADW_CHORE | Chore | S5120 | 15 min | AUTO (one-time) | Partial: scheduled as a weekly pattern, not one-time work | Partial: the engine places one-time and intermittent occurrences (Phase 2, CP2-1); Quick Schedule still shows a weekly pattern |
| MO_ADW_HDM | Home Delivered Meals | S5170 | meal | APPOINTMENT | **Missing** (worksheet WS-R09 only) | Supported by date (Phase 3): deliveries counted as meals, 2 a day; never hours |
| MO_ADW_RESP_BASIC | Respite – Basic | S5150 | 15 min | AUTO (coverage) | Partial: schedules as tasks; combined 868 BLOCK and overlap BLOCK in the engine | Partial: scheduled as tasks; coverage blocks and the combined 868 figure are in the engine and shown on both lines (Phase 2, CP2-3); overlap on the schedule is Phase 4 |
| MO_ADW_RESP_ADV | Respite – Advanced | S5150TF | 15 min | AUTO (coverage) | Partial, as Basic | Partial, as Basic |
| MO_ILW_PCA | Personal Care Assistance – ILW | T1019U6 | 15 min | AUTO | Supported; 49-hour checks CON-09; pending-approval BLOCK | Supported |
| MO_ILW_CM | Case Management – ILW | T2024U6 | month | CONTEXT | **Missing** (3c amount only) | Kept; an optional dated reminder, never a shift (Phase 3) |
| MO_ILW_FMS | Financial Management Service – ILW | T2040U6 | month | CONTEXT | **Missing** | Kept; authorization context only, nothing to place (Phase 3) |
| MO_ILW_SME | Specialized Medical Equipment – ILW | T2029U6 | actual cost | CONTEXT | **Missing** | Kept; an optional dated reminder, never a shift (Phase 3) |
| MO_ILW_SMS | Specialized Medical Supplies – ILW | T2028U6 | actual cost | CONTEXT | **Missing** | Kept; an optional dated reminder, never a shift (Phase 3) |
| MO_ILW_EAA | Env. Accessibility Adaptations – ILW | S5165U6 | actual cost | CONTEXT | **Missing** | Kept; an optional dated reminder, never a shift (Phase 3) |
| MO_ADCW_ADC | Adult Day Care (ADCW) | S5100HB | 15 min | APPOINTMENT | **Missing** (worksheet WS-R08 only) | Supported by date (Phase 3), as the ADW service |
| MO_SFC | Structured Family Caregiver | S5126HB | day | APPOINTMENT (covered days) | **Missing** | Covered days placed by date, a day a day, never 96 units (Phase 3); no concurrent HCBS is Phase 4 |

Totals: **before** 4 supported, 5 partial, 12 missing; **now** 21 recognized, of which 4
supported, 5 partial, 12 recognized and kept (none dropped, none mislabeled).

Fusion labels are still learned only from real plans (IMP-11): `PC - Agency`, `PC - CDS`, `HC`
and `GHE` so far. A kept service is identified by its month table's code, which is safe for
every code except `T1019` (shown for both agency and CDS), and that one still asks.

### 5.2 The 51 HCBS-3a/3c worksheet rows

Generated from the CSV and the importer's matcher (`packages/import/test/kept.test.ts`, IMP-T33).
The task code is the rule pack's; a task shared by several services is one entry in the
library and is attached to each authorization separately (SCH-13).

| Row | Label | Section | Suggested | Task | Status |
|---|---|---|---|---|---|
| HCBS-3a B11 | BATHING | AGENCY_BASIC_PC | 30-45 MIN / 1-7 X WK | `BATHING` | Supported |
| HCBS-3a B14 | DIETARY | AGENCY_BASIC_PC | 10-60 MIN / 1-7 X WK | `DIETARY` | Supported |
| HCBS-3a B17 | DRESSING/ GROOMING | AGENCY_BASIC_PC | 15 MIN / 1-7 X WK | `DRESSING_GROOMING` | Supported |
| HCBS-3a B20 | MOBILITY/ TRANSFER/ POSITION | AGENCY_BASIC_PC | 5-10 MIN / AS NEEDED | `MOBILITY_TRANSFER_POSITION` | Supported |
| HCBS-3a B23 | SELF ADMIN OF MEDICATIONS | AGENCY_BASIC_PC | 3-5 MIN / AS NEEDED | `SELF_ADMIN_OF_MEDICATIONS` | Supported |
| HCBS-3a B26 | TOILETING | AGENCY_BASIC_PC | 5-10 MIN / AS NEEDED | `TOILETING` | Supported |
| HCBS-3a B29 | MED REL HC TASKS | AGENCY_BASIC_PC | USE HC SECTION FOR TASKS/TIMES / — | — | Control row (children read as `Med Rel HC Tasks: <task>` under PC - Agency) |
| HCBS-3a B33 | CLEAN BATH | AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD | 30-45 MIN / 1 X WK | `CLEAN_BATH` | Supported |
| HCBS-3a B36 | CLEAN KITCHEN | AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD | 30-45 MIN / 1 X WK | `CLEAN_KITCHEN` | Supported |
| HCBS-3a B39 | CLEAN LIVING AREA | AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD | 10-45 MIN / 1 X WK | `CLEAN_LIVING_AREA` | Supported |
| HCBS-3a B42 | ESSENTIAL CORRESPOND | AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD | 30 MIN / 1 X WK | `ESSENTIAL_CORRESPONDENCE` | Supported |
| HCBS-3a B45 | IRON/MEND | AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD | 10-15 MIN / 1 X WK | `IRON_MEND` | Supported |
| HCBS-3a B48 | LAUNDRY (HOME/OFF SITE) | AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD | 30-150 MIN / 1 X WK | `LAUNDRY` | Supported |
| HCBS-3a B51 | MAKE BED/ CHANGE LINENS | AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD | 10 MIN / AS NEEDED | `MAKE_BED_CHANGE_LINENS` | Supported |
| HCBS-3a B54 | MEALS/DISHES | AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD | 10-60 MIN / 1-7 X WK | `MEALS_DISHES` | Supported |
| HCBS-3a B57 | SHOPPING/ ERRANDS | AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD | 60-120 min / 1-2 X WK | `SHOPPING_ERRANDS` | Supported |
| HCBS-3a B60 | TRASH | AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD | 5 MIN / 1 X WK | `TRASH` | Supported |
| HCBS-3a B63 | WASH WINDOWS/ BLINDS | AGENCY_HOMEMAKER_OR_PC_MED_HOUSEHOLD | 10-15 MIN / 1 X WK | `WASH_WINDOWS_BLINDS` | Supported |
| HCBS-3a B69 | ASEPTIC DRESSINGS | AGENCY_APC | 15 MIN / AS ORDERED | `ASEPTIC_DRESSINGS` | Supported |
| HCBS-3a B72 | ASST TRANS DEVICE | AGENCY_APC | 15 MIN / PER TRANSFER | `ASSISTIVE_TRANSFER_DEVICE` | Supported |
| HCBS-3a B75 | BOWEL PROGRAM | AGENCY_APC | 15 MIN / AS ORDERED | `BOWEL_PROGRAM` | Supported |
| HCBS-3a B78 | CATHETER HYGIENE | AGENCY_APC | 15 MIN / 1-7 X WK | `CATHETER_HYGIENE` | Supported |
| HCBS-3a B81 | NON-INJECTABLE MEDS | AGENCY_APC | 15 MIN / AS ORDERED | `NON_INJECTABLE_MEDS` | Supported |
| HCBS-3a B84 | OSTOMY HYGIENE | AGENCY_APC | 15 MIN / 1-7 X WK | `OSTOMY_HYGIENE` | Supported |
| HCBS-3a B87 | PASSIVE ROM | AGENCY_APC | 15 MIN / AS ORDERED | `PASSIVE_ROM` | Supported |
| HCBS-3c A11 | Asst. Transfer Device | CDS_ILW_TASK | 15 MIN / PER TRANSFER | `ASSISTIVE_TRANSFER_DEVICE` | Supported |
| HCBS-3c A14 | Asst. with Toileting | CDS_ILW_TASK | 5-10 MIN / AS NEEDED | `ASSISTANCE_WITH_TOILETING` | Supported |
| HCBS-3c A17 | Bathing | CDS_ILW_TASK | 30-45 MIN / 1-7 X WK | `BATHING` | Supported |
| HCBS-3c A20 | Bowel/Bladder Routine | CDS_ILW_TASK | 15 MIN / AS ORDERED | `BOWEL_BLADDER_ROUTINE` | Supported |
| HCBS-3c A23 | Catheter Hygiene | CDS_ILW_TASK | 15 MIN / 1-7 X WK | `CATHETER_HYGIENE` | Supported |
| HCBS-3c A26 | Change Linens | CDS_ILW_TASK | 10 MIN / AS NEEDED | `CHANGE_LINENS` | Supported |
| HCBS-3c A29 | Clean Bath | CDS_ILW_TASK | 30-45 MIN / 1 X WK | `CLEAN_BATH` | Supported |
| HCBS-3c A32 | Clean Floors | CDS_ILW_TASK | 30-45 MIN / 1 X WK | `CLEAN_FLOORS` | Supported |
| HCBS-3c A35 | Clean Kitchen | CDS_ILW_TASK | 30-45 MIN / 1 X WK | `CLEAN_KITCHEN` | Supported |
| HCBS-3c A38 | Clean/Maintain Equipment | CDS_ILW_TASK | AS NECESSARY / AS NECESSARY | `CLEAN_MAINTAIN_EQUIPMENT` | Supported |
| HCBS-3c A41 | Dressing/Grooming | CDS_ILW_TASK | 15 MIN / 1-7 X WK | `DRESSING_GROOMING` | Supported |
| HCBS-3c A44 | Essential Correspondence | CDS_ILW_TASK | 30 MIN / 1 X WK | `ESSENTIAL_CORRESPONDENCE` | Supported |
| HCBS-3c A47 | Laundry (Home) | CDS_ILW_TASK | 30-60 MIN / 1 X WK | `LAUNDRY_HOME` | Supported |
| HCBS-3c A50 | Laundry (Off Site) | CDS_ILW_TASK | 150 MIN / 1 X WK | `LAUNDRY_OFF_SITE` | Supported |
| HCBS-3c A53 | Make Bed | CDS_ILW_TASK | 5 MIN / AS NEEDED | `MAKE_BED` | Supported |
| HCBS-3c A56 | Meal Prep/Eating | CDS_ILW_TASK | 10-60 MIN / 1-7 X WK | `MEAL_PREP_EATING` | Supported |
| HCBS-3c A59 | Medications | CDS_ILW_TASK | 3-5 MIN / AS NEEDED | `MEDICATIONS` | Supported |
| HCBS-3c A62 | Mobility/Transfer | CDS_ILW_TASK | 5-10 MIN / AS NEEDED | `MOBILITY_TRANSFER` | Supported |
| HCBS-3c A65 | Ostomy Hygiene | CDS_ILW_TASK | 15 MIN / 1-7 X WK | `OSTOMY_HYGIENE` | Supported |
| HCBS-3c A68 | Passive ROM | CDS_ILW_TASK | 15 MIN / AS ORDERED | `PASSIVE_ROM` | Supported |
| HCBS-3c A71 | Tidy and Dust | CDS_ILW_TASK | 10-15 MIN / 1 X WK | `TIDY_AND_DUST` | Supported |
| HCBS-3c A74 | Trash | CDS_ILW_TASK | 5 MIN / 1 X WK | `TRASH` | Supported |
| HCBS-3c A77 | Treatments | CDS_ILW_TASK | 15 MIN / AS ORDERED | `TREATMENTS` | Supported |
| HCBS-3c A80 | Turning/Positioning | CDS_ILW_TASK | 5-10 MIN / AS NEEDED | `TURNING_POSITIONING` | Supported |
| HCBS-3c A83 | Wash Dishes | CDS_ILW_TASK | 10-30 MIN / 1-7 X WK | `WASH_DISHES` | Supported |
| HCBS-3c A86 | ESSENTIAL TRANSPORTATION | CDS_ILW_TRANSPORT | 60-120 MIN / 1 - 2 X WK | `ESSENTIAL_TRANSPORTATION` | Supported (transportation: monthly minutes, AUTH-08) |

## 6. Proof with the de-identified multi-service plan (JOIN-01)

Fixture F (`docs/fixtures/fusion/F-care-plan-report-multi.txt`) is the real seven-page care
plan's layout with made-up identifiers. The owner's JSON fixture states the same figures.

| Requirement | Result | Test |
|---|---|---|
| 5 authorization records read | 3 services + 2 GHE visits; "5 authorizations read: 3 scheduled in the week, 2 nurse visits by month." | IMP-T26, `test/quick/kept.test.ts`, `ui-kept.test.tsx` |
| Agency PC 226 a month, 8 tasks, household tasks under PC, not homemaker | 226 each month; our total from the tasks matches Fusion's 226 | IMP-T26, AC-28 |
| CDS transportation 40 units, not merged with agency by T1019 | its own service (T1019U2), 600 minutes a month, its own PA | IMP-T26, IMP-T28 |
| Homemaker 5 | Wash Windows/Blinds 15 × 1, its own authorization | IMP-T26 |
| GHE May and August | listed in their months only, never weekly | IMP-T27, AC-28 |
| One schedule | one week, every task under the service that pays for it | AC-28, `ui-whole-plan.test.tsx` |
| Nothing after Oct 31, 2026 | no month after the plan's end | AC-28 |
| Transport with no frequency isn't auto-assigned as appointments | set aside on one editable day as a weekly allowance, labeled a scheduling choice | APP-SPEC 5.8 decision 3 |

## 7. Phased plan

Each phase ships on its own branch and PR, tests first, with a mutation check, and leaves
production unchanged until merged. "Evidence" items are not engineering choices; the phase
builds a REVIEW state until the evidence arrives.

### Phase 1: recognize and keep everything (done on this branch)
INV-01, INV-02, INV-03, INV-04, JOIN-01 pass. Remaining Phase 1 items move to Phase 2:
source page links for each extracted field, and an import review dialog listing every
authorization with its classification (the Other authorizations panel and read summary
cover most of it today).

### Phase 2: service-specific calculators and import detail
- Chore as one-time or intermittent work: dates and durations, no weekly template (ADW-05).
- Agency PC by hand: offer all 11 household rows under `MED REL HC TASKS`, matching the 3a
  `N29` (correction 5), with the switch so a task counts under PC or homemaker, never both.
- Respite as coverage blocks rather than tasks; combined monthly figure across Basic and
  Advanced shown on both (engine rule exists).
- ADC attendance (minutes a day in 15-minute steps, ≤ 600 a day, ≤ 5 days a week, transport
  part ≤ 120 minutes a day) and HDM meals a day (≤ 2): reuse WS-R08 and WS-R09.
- RCF/ALF variants as facility services (no home visit assumed).
- Global task IDs (UUID) so the same label in two authorizations is never confused when
  occurrences are stored (JOIN-03).
- Source page and line for each field read; an expandable raw view in the read summary.
- **Evidence:** 3a `N115` intent (E-18); the 3c ILW case-management amount (section 4).

### Phase 3: the participant calendar with dated events (done Nov 13, 2026, branch `coverage-phase-3`)
Built as prompts CP3-1 to CP3-8 of `docs/CLINE-PROMPTS-PDF-ONLY-AND-COVERAGE-3-5.md`. The matrix in
section 8 names the test for each row it proves. Two items carry over: chore and respite still
show as weekly patterns in Quick Schedule (their Phase 2 engine pieces are not wired into the
app), and clock times arrive with Phase 4.
- Place nurse visits (GHE, APC evaluation, training) on a date the person picks within the
  authorized month; enforce 1 a day and 26 in six months (CON-10) on the schedule; never
  create a visit Fusion didn't authorize; a GHE done at a regular visit is one visit.
- Place ADC attendance days, meal deliveries and SFC covered days on the same calendar.
- Optional nonbillable dated events or reminders for CONTEXT_APPOINTMENT (ILW case
  management, appointment only if specified) and the three CONTEXT_EVENT authorizations
  (ILW equipment, supplies, adaptations) — never a caregiver shift.
- GHE missed-visit follow-up (WARN), and upload due by the 15th of the next month
  (HCBS 08-26-01) as a reminder, never a visit.
- Date-specific exceptions as recorded events over the weekly pattern (SCH-11 exists).
- Monthly calendar view of the whole plan with each service's balance.
- **Evidence:** Fusion behavior for partial months and suspensions (E-17).

### Phase 4: restrictions and staffing
- Caregivers per service (agency, CDS attendant, SFC primary and backup); qualifications
  stored, never inferred from a name.
- Engine rules already written, wired to the schedule: CON-01..07, CON-16, CON-17, respite
  overlap BLOCK (CON-03), SFC exclusivity, waiver overlap.
- CDS and ILW share one task pool with separate ledgers; project the State Plan-to-ILW switch
  on the schedule only when both imported authorizations exist (AUTH-11, INFO 05-25-01).
- Worker double-booking BLOCK and over 40 hours WARN across participants (CON-04, CON-05).
- 49 hours a week (ILW, respite): change CON-09 so a REVIEW is shown even when the fixed-week
  and rolling diagnostics pass, as the blueprint says (E-02).
- **Evidence:** the state's definition of the 49-hour week (E-02); ILW attendant relationship
  rules (E-14); service pairs not yet confirmed (E-06).

### Phase 5: exports and completeness display
- CSV and XLSX of the same occurrences as the screen and PDF (EXPORT-01).
- Coverage line on every view, including one-service plans, and on the printout.
- No "compliant" or "approved" wording anywhere while a REVIEW stands (today the status reads
  "Ready to use" and lists items to review; keep it that way).
- **Evidence:** fuller 14a/14b parity beyond the one committed case (E-12); the XLSX bytes are already committed in `docs/fixtures/state/`.

### Security and environment (runs across phases)
Quick Schedule stays local (browser only, no upload, name and DCN never stored). Agency mode is a
cloud product on covered Google Cloud infrastructure (Firebase Hosting + Firestore/Auth) —
owner decision 2026-11-13 (PHASE-3-SPEC P3-08/P3-10). Saved participants store
`displayName` only (no DCN), with random internal ids. Live PHI stays disabled until the Google
Cloud BAA is executed, every service's coverage is verified and the security review is done; the
`config/phiStorage.enabled` deployment flag (set only by the Admin SDK) keeps participant writes
closed in the meantime.

### Outside Appendix 1 (not in scope until researched)
Medically Complex Adult Waiver, Brain Injury Waiver, DMH developmental disabilities waivers,
Medicare home health, hospice and private pay each need their own manuals and rule packs.
Until then, their codes are kept as "Not recognized: kept for review", which is what IMP-19
does for any code outside Appendix 1.

## 8. Acceptance-test matrix

Status: **PASS** (test named), **PARTIAL**, **TO BUILD** (phase), **EVIDENCE** (waits on DHSS or
Fusion material).

| ID | Requirement | Status | Where |
|---|---|---|---|
| INV-01 | 21 services, each once, one class | PASS | `engine/test/appendix1.test.ts` |
| INV-02 | 51 worksheet rows recognized, control row kept | PASS (recognition); workbook math parity in PR #5 | IMP-T33; `stateparity-golden*.test.ts` |
| INV-03 | Unknown code survives verbatim | PASS | IMP-T31 |
| INV-04 | T1019 under two headers stays two authorizations | PASS | IMP-T28, IMP-T31 |
| CALC-01 | 10 min × 7 days → 21 units (worksheet) | PASS | `engine/test/math.test.ts` (both worksheet formulas; added on this branch) |
| CALC-02 | Household tasks under PC counted once | PASS (worksheet N29/N66) | WS-A23 in `stateparity-golden-3a.test.ts` |
| CALC-03 | APC total = sum of rounded tasks | PASS | `stateparity-golden-3a.test.ts` (N90) |
| CALC-04 | Transport 90 × 1 → 450 min → 30 units; remainder kept | PASS | `engine/test/math.test.ts` |
| CALC-05 | Derived vs Fusion rounding labeled; Fusion kept | PASS | AUTH-03, AUTH-07 tests |
| CALC-06 | 28/29/30/31-day months, no 31 days in February | PASS | `math.test.ts`, `calendar.test.ts` |
| CALC-07 | Month over authorization → BLOCK | PASS | SCH-08 tests, `review-fixes.test.ts` |
| CALC-08 | Minutes and units shown separately | PASS | `scheduleSheet.test.ts` ("461 + 5 min" scheduled) |
| JOIN-01 | Fixture F: 5 authorizations, one schedule | PASS | section 6 |
| JOIN-02 | Providers and caregivers stay distinct | PARTIAL: providers per authorization; no caregivers yet | Phase 4 |
| JOIN-03 | Same label in two authorizations, two IDs | PASS | `apps/web/test/quick/provenance.test.ts` ("JOIN-03: the same task label in two authorizations gets two distinct UUIDs"), `persistence.test.ts` |
| JOIN-04 | Nurse/CDS overlap allowed; respite overlap BLOCK; unknown REVIEW | PASS in the engine; the schedule has no clock times yet | `rules-con.test.ts`; Phase 4 |
| RN-01 | GHE months; none for RCF/CDS/ILW/ADW/ADCW/SFC only | PASS: only the months Fusion authorized are shown; no visit month is derived and no visit is placed by the app | `apps/web/test/quick/planEvents.test.ts` ("RN-01: only the visits Fusion authorized, and nothing placed by the app") |
| RN-02 | Visits counted by visit; 1 a day, 26 in six months | PASS on the schedule: dated in the authorized month, 1 a day and 26 in six months through CON-10; a GHE at a regular visit is one visit | `engine/test/events.test.ts`; `planEvents.test.ts` ("RN-02"); e2e `calendar.spec.ts` |
| RN-03 | APC evaluation and training visits | PARTIAL by design: NUR-01 is REVIEW in the authorization's first month, never BLOCK or PASS; no visit is created. EVIDENCE: DHSS has not confirmed the first-month visit count | `engine/test/nur.test.ts`; `apps/web/test/quick/apcReview.test.ts` |
| RN-04 | Missed GHE follow-up | PASS: a passed visit month with no date placed raises NUR-02 (WARN); it says nothing about delivery. The evaluation upload is a reminder on the 15th of the next month, never a visit | `engine/test/events.test.ts` ("NUR-02"); `planEvents.test.ts` ("RN-04"); `ui-visits.test.tsx` |
| ADW-01 | Respite 500 + 500 > 868 → BLOCK | PASS | AUTH-09 tests |
| ADW-02 | Respite overlap BLOCK; same day earlier is fine | PASS in the engine | CON-03 tests; Phase 4 |
| ADW-03 | ADC 40 units/day, 5 days/week, transport ≤ 120 min | PASS on the calendar: minutes attended in 15-minute steps, 600 a day, 5 days a week, 120 transportation minutes a day, through WS-R08's limits | `engine/test/attendance.test.ts`, `events.test.ts`; `apps/web/test/quick/otherEvents.test.ts` ("ADW-03") |
| ADW-04 | HDM ≤ 2 a day; meals never minutes | PASS on the calendar: 2 a day (a third is refused, at WS-R09's own REVIEW severity); meals are counted as meals, never minutes | `engine/test/meals.test.ts`, `events.test.ts`; `otherEvents.test.ts` ("ADW-04"); IMP-T30 |
| ADW-05 | Chore one-time, no weekly template | PARTIAL: the engine places one-time and intermittent chore occurrences (PASS, CP2-1); Quick Schedule still shows chore as a weekly pattern | `engine/test/oneTime.test.ts` ("placeOneTimeOccurrences (ADW-05)"); the app wiring is still to build |
| SFC-01 | A day is a day, not 96 units; no concurrent HCBS | PARTIAL: a covered day is one day, covered once, never units or minutes (PASS on the calendar); no concurrent HCBS is Phase 4 | `otherEvents.test.ts` ("SFC-01"); `engine/test/events.test.ts`; Phase 4 (CP4-4) |
| ILW-01 | CDS and ILW separate, shared tasks, projected switch | PARTIAL: AUTH-11 | Phase 4 |
| ILW-02 | 49 hours: REVIEW even when diagnostics pass | PASS: CON-09 REVIEW on any ILW or respite time, with both figures; BLOCK only over 49 h in every reading of the week (CP4-6). EVIDENCE E-02 stays open | `engine/test/rules-con09.test.ts` ("ILW-02"); `apps/web/test/quick/weeklyHours.test.ts` ("ILW-02") |
| DATES-01 | Mid-month, suspension, expiry, future, DST, overnight | PARTIAL, narrowed: mid-month start, expiry, future start and the DST weeks PASS on the calendar path; overnight and DST minutes PASS in the engine (SCH-15); a visit in a suspension is BLOCK in the engine (SCH-14). Not on the schedule yet: clock times (Phase 4). EVIDENCE E-17: how Fusion shows a suspension, which Quick Schedule has no way to read | `apps/web/test/quick/phase3-acceptance.test.ts` ("DATES-01 on the calendar path"); `engine/test/calendar.test.ts`, `rules-auth-sch.test.ts` |
| STAFF-01 | Caregiver double-booked; over 40 h | PASS in the engine (CON-04, CON-05) | Phase 4 |
| SEC-01 | No upload without action; no PHI in diagnostics; tenant isolation | PARTIAL: IMP-16 privacy test, Firestore rules tests; participant gate (R-21–R-28) built, live PHI disabled until Google Cloud BAA executed | section 7 |
| EXPORT-01 | PDF, print, CSV, XLSX agree | PARTIAL: PDF and print share one sheet and name kept authorizations; CSV/XLSX to build | Phase 5 |
| SOURCE-01 | Rules cite a dated source; version on results | PASS | `catalog.test.ts`, `sources.test.ts`, AUTH-13 |
| WORKBOOK-01 | 14a/14b parity | PARTIAL: covered for unit math (D7/L/M7, F-2b/F-3/F-5) and the Example Month on one case; the 14a "Example Month" H12 defect is recorded; 28-day-February, 6-day, 0-minute-day and odd-remainder cases added | `stateparity-golden-14.test.ts`, `stateparity-14-edge.test.ts` |

## 9. Unresolved: what only DHSS or Fusion can settle

These stay REVIEW in the app. Questions 1-7 in `docs/DSDS-QUESTIONS.md` (PR #5) already cover
rounding, APC first-month visits, meals per day and the 3c editions and amounts. Add these
when the email goes:

8. **The 49-hour week (ILW and respite):** which seven days make the week, and how a week that
   crosses a month or year end is counted (E-02).
9. **ILW attendants:** may a spouse or legal guardian be an ILW attendant, and with what
   exceptions (E-14)?
10. **Partial months and suspensions:** how Fusion figures a month's units when service starts,
    stops or is suspended mid-month (E-17).
11. **HCBS-3a chore row 115:** is `ROUNDUP(G115*L115/15,0)` intended, unlike rows 112 and 119
    (E-18)?
12. **ILW case management:** Appendix 1 lists $38.17 a month; the HCBS-3c ILW tab shows
    $458.09. Which applies, and is the 3c amount yearly?
13. **Appendix 14a/14b:** the current XLSX files are obtained and committed (`docs/fixtures/state/`, SHA-256 pinned). Unit math and the Example Month now match on one case; the 14a "Example Month" H12 hardcode is a state defect (see `docs/DSDS-QUESTIONS.md`) and fuller parity across more cases is still to build (E-12).
14. **Aides in an RCF/ALF:** Policy 3.05 bars immediate family and non-employees from delivering
    PC, and says PC is also provided in an RCF/ALF; Policy 3.20 (rev. Mar 2026) doesn't restate
    it. Does the restriction apply to RCF/ALF personal care and APC? (CON-07 is REVIEW there.)
15. **APC transfer device in an RCF/ALF:** Policy 3.10 lists Assistance with Transfer Device and
    says APC may also be provided in an RCF/ALF; Policy 3.20's APC list leaves it out. May it be
    authorized in a facility? (The task stays offered, per 3.10.)

## 10. Decisions taken here

1. **Kept, not forced.** An authorization the week can't hold is kept and shown, never mapped
   to a 15-minute service by guesswork. A code identifies a kept service only through
   Appendix 1, and `T1019` never does.
2. **Schedule classes.** AUTO 10, APPOINTMENT 6, CONTEXT 5. Structured family caregiving is
   APPOINTMENT (covered calendar days) rather than CONTEXT, because its unit is a dated day;
   the blueprint's illustrative counts are not targets.
3. **Names are DHSS's.** The registry uses the table's own names; the owner's JSON stays as
   given and is only compared by ID, program, code and unit.
4. **Old plans keep loading.** `others` is optional in storage, so a plan saved by the live
   app opens unchanged.
5. **Scope stopped at Phase 1.** Phases 2-5 change scheduling behavior and need the owner's
   approval of this plan first, as the request asks.
6. **CDS task rules and program checks (CP4-7, Nov 13, 2026).** Severities follow the policy
   text read that day at health.mo.gov. BLOCK only where it states the exclusion outright:
   Policy 3.25 (rev. Jan 2026) "No time can be authorized for" stand-by, prompting, cueing,
   respite or waiting (CDS-01, CDS-02, for a task label that is only that), and its "not eligible
   for CDS" for NF/RCF/ALF residents (CDS-05) and DMH self-directed services (PRG-02); Policy
   4.35.3 (rev. May 2023) for PACE (PRG-01); Policy 4.35.1 for DD Shared Living, Residential
   Habilitation and ISL against State Plan personal care (PRG-02). REVIEW where the plan can't
   show the fact: a label that only mentions those words, a therapy or skilled-care label
   (CDS-03), NEMT coverage of a CDS trip (CDS-04) and whether State Plan care is used up before
   DD waiver personal assistance (PRG-03). The prompt's "DMH residential limits State Plan PC"
   is stronger in 4.35.1 ("not eligible"), so PRG-02 is BLOCK.
7. **Cost cap and backup coverage (CP4-8, Nov 13, 2026).** CAP-01's words are Manual 4.20's
   (rev. Jul 2025): agency model PC and CDS together may not exceed 60% of the cost maximum; APC
   and RN visits can take it past 60%, only to 100%; over 100% with ADW or ILW needs Bureau of
   Federal Programs approval. Advanced PC with CDS isn't flagged, since 4.20 lets APC exceed 60%.
   For backup coverage, 4.15 sets the COOP priority risk indicator per participant, which
   orders participants (agency mode, CP4-9). In Quick Schedule's one participant it can't order
   uncovered tasks, so the person enters a priority for each task and the list follows it. The
   40-hour check for a replacement uses every seven days that include the date, because Quick
   Schedule has no agency workweek (CON-05 waits for CP4-9).
