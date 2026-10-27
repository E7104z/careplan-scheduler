# Worksheet parity ledger

This ledger lists everything DSDS's HCBS-3c and HCBS-3a worksheets (and the manual pages that explain
them) do, and where CarePlan Scheduler does the same. `packages/engine/src/worksheet/ledger.ts` holds the
same rows as data, and `packages/engine/test/ledger.test.ts` fails if the two differ or if a `DONE` row
has no test named after it.

**Columns:** ID · Form · What DSDS's worksheet (or the manual) does · Status · Refs

### Header (3c and 3a)
| ID | Form | Item | Status | Refs |
|---|---|---|---|---|
| WS-H01 | 3c,3a | Participant name | PLANNED | memory-only (W-4) |
| WS-H02 | 3c,3a | DCN | PLANNED | memory-only |
| WS-H03 | 3c,3a | Provider agency name | PLANNED | |
| WS-H04 | 3c,3a | Provider agency phone | PLANNED | memory-only |
| WS-H05 | 3c | IHS box: participant receives or is being authorized for other HCBS besides CDS | PLANNED | |
| WS-H06 | 3c | Program: State Plan (CDS tab) or ILW (ILW tab) | PLANNED | |
| WS-H07 | 3c | Start date: earliest date CDS can begin | PLANNED | plan start already exists |
| WS-H08 | 3c,3a | Edition stamp per tab (CDS 10/26, ILW 07/26, 3a 07/26) | DONE | rule pack editions; `packages/engine/test/guidance.test.ts` |
| WS-H09 | 3c,3a | Emergency contact name and phone | PLANNED | memory-only |
| WS-H10 | 3c,3a | Signature and date line (3c: the individual completing it; 3a: DSDS staff): printed blank, never filled or signed by the app | PLANNED | W-3 |
| WS-H11 | 3a | CDS box: participant receives or is being authorized for Personal Care Assistance (Consumer-Directed) in addition to other HCBS | PLANNED | |
| WS-H12 | 3c | Once units are calculated, the monthly units are entered after the program type (State Plan / ILW) | PLANNED | shown pre-filled from the Total, editable only through the care plan |

### 3c calculation (CDS and ILW tabs)
| ID | Form | Item | Status | Refs |
|---|---|---|---|---|
| WS-C01 | 3c | The 25 tasks with DSDS's exact names, in DSDS's order | DONE | rule pack tasks (`packages/engine/src/rulepacks/mo-2026-07.ts`); `packages/engine/src/worksheet/guidance.ts`; `packages/engine/test/guidance.test.ts` (both directions, DSDS's order) |
| WS-C02 | 3c | Suggested time shown for every task | DONE | `packages/engine/src/worksheet/guidance.ts`; `packages/engine/test/guidance.test.ts` |
| WS-C03 | 3c | Suggested frequency shown for every task | DONE | `packages/engine/src/worksheet/guidance.ts`; `packages/engine/test/guidance.test.ts` |
| WS-C04 | 3c | Min/Day entry (whole minutes) | DONE | `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` (every whole minute 1–1,440) |
| WS-C05 | 3c | Days/Wk entry (1–7) | DONE | `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` (every 1–7 days) |
| WS-C06 | 3c | Units/Day = Min/Day ÷ 15, shown as the sheet shows it | DONE | `packages/engine/src/worksheet/calc3c.ts` (exact fraction and the sheet's "0.0" text); `packages/engine/test/worksheet-golden.test.ts` |
| WS-C07 | 3c | Max Days/Mo from the table 1→5, 2→10, 3→15, 4→19, 5→23, 6→27, 7→31 | EXISTING | F-1 `factorFor`; rule pack |
| WS-C08 | 3c | Units/Wk = Min/Day × Days/Wk ÷ 15 | DONE | `packages/engine/src/worksheet/calc3c.ts` (exact fraction and the sheet's "0.0" text); `packages/engine/test/worksheet-golden.test.ts` |
| WS-C09 | 3c | Total Units per task = ROUNDUP(Units/Day × Max Days/Mo) | DONE | F-2a `hcbs3cTaskUnits`; `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` |
| WS-C10 | 3c | Essential Transportation: minutes per month ÷ 15, rounded down | DONE | F-4, AUTH-08; `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` |
| WS-C11 | 3c | Total Units/Mo = Σ task units + transportation units | DONE | `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` |
| WS-C12 | 3c | Cost = Total Units × the sheet's rate ($5.23) | DONE | rate PARTIAL; `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` |
| WS-C13 | 3c | Total turns red above 641 (CDS tab) / 868 (ILW tab) | EXISTING | AUTH-09 ceilings; Prompt 5 shows it |
| WS-C14 | 3c | A row with no Days/Wk counts as nothing | DONE | `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` |
| WS-C15 | 3c | "Based on a 31 day month" footnote | DONE | rule pack `worksheet3c.daysBasis`; `packages/engine/test/worksheet-calc3c.test.ts` |
| WS-C16 | 3c,3a | Description of needs for each task | PLANNED | memory-only |
| WS-C17 | 3c,3a | Comments | PLANNED | memory-only |
| WS-C18 | 3c | Units shown with the task's suggested range check (outside range → INFO) | DONE | rule WS-R01; `packages/engine/src/worksheet/validate.ts`; `packages/engine/test/worksheet-rules.test.ts` |

### 3c ILW tab only
| ID | Form | Item | Status | Refs |
|---|---|---|---|---|
| WS-I01 | 3c-ilw | Financial Management Services: units × 157.89 | DONE | rate PARTIAL; `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` |
| WS-I02 | 3c-ilw | Case Management: flat 458.09 when entered | DONE | rate PARTIAL; `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` |
| WS-I03 | 3c-ilw | Specialized Medical Supplies: units × 100 | DONE | `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` |
| WS-I04 | 3c-ilw | Specialized Medical Equipment: units × 100 | DONE | `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` |
| WS-I05 | 3c-ilw | Environmental Accessibility Adaptations: units × 100 | DONE | `packages/engine/src/worksheet/calc3c.ts`; `packages/engine/test/worksheet-golden.test.ts` |
| WS-I06 | 3c-ilw | Description of Needs required for every ILW request (manual 4.00 App 4d) | DONE | rule WS-R02; `packages/engine/test/worksheet-rules.test.ts` |
| WS-I07 | 3c-ilw | Request goes to the Bureau of Federal Programs; BFP approval required before authorizing ILW | EXISTING | AUTH-12; Prompt 5 shows the note |
| WS-I08 | 3c | A participant needing more State Plan personal care than the cost maximum should be considered for ILW | DONE | rule WS-R03; `packages/engine/test/worksheet-rules.test.ts` |

### 3a calculation and services
| ID | Form | Item | Status | Refs |
|---|---|---|---|---|
| WS-A01 | 3a | RCF/ALF checkbox on Personal Care, Homemaker, Advanced PC, Nurse Visits | DONE | `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-calc3a.test.ts`; `packages/engine/test/worksheet-golden-3a.test.ts`; `packages/engine/test/worksheet-3a-sheet.test.ts` (the workbook has no Homemaker RCF/ALF box: recorded only) |
| WS-A02 | 3a | Personal Care: Bathing, Dietary, Dressing/Grooming, Mobility/Transfer/Position, Self Admin of Medications, Toileting, with suggested ranges | DONE | task library (`packages/engine/src/rulepacks/mo-2026-07.ts`); ranges `packages/engine/src/worksheet/guidance.ts`; `packages/engine/test/guidance.test.ts` |
| WS-A03 | 3a | "Med Rel HC Tasks" box under Personal Care; the tasks to be done are indicated in the Homemaker section | DONE | `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-calc3a.test.ts`; `packages/engine/test/worksheet-golden-3a.test.ts` |
| WS-A04 | 3a | Homemaker: 11 tasks with suggested ranges | DONE | task library (`packages/engine/src/rulepacks/mo-2026-07.ts`); ranges `packages/engine/src/worksheet/guidance.ts`; `packages/engine/test/guidance.test.ts` |
| WS-A05 | 3a | Advanced Personal Care: 7 tasks with suggested ranges | DONE | task library (`packages/engine/src/rulepacks/mo-2026-07.ts`); ranges `packages/engine/src/worksheet/guidance.ts`; `packages/engine/test/guidance.test.ts` |
| WS-A06 | 3a | APC with a single task: minutes in 15-minute increments | DONE | rule WS-R04; `packages/engine/test/worksheet-rules-3a.test.ts` |
| WS-A07 | 3a | APC: two nurse visits in the first month; none extra when the plan already has ongoing nurse visits | DONE | rule WS-R05 (PARTIAL); `packages/engine/test/worksheet-rules-3a.test.ts` |
| WS-A08 | 3a | Authorized Nurse Visits: visits per month; days per month (not per week) when less than weekly; task boxes | DONE | `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-calc3a.test.ts` |
| WS-A09 | 3a | General Health Evaluation only for semiannual nurse visits | DONE | rule WS-R06; `packages/engine/test/worksheet-rules-3a.test.ts` |
| WS-A10 | 3a | Nurse "Other" (venipuncture, physician-ordered injections) needs prior approval and authorization | DONE | rule WS-R07; `packages/engine/test/worksheet-rules-3a.test.ts` |
| WS-A11 | 3a | Total units exclude nurse visits | DONE | `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-golden-3a.test.ts` |
| WS-A12 | 3a | Respite Basic and Advanced: min/day and days/wk; combined total cannot exceed 868 | DONE | worksheet line; the 868 limit is AUTH-09, TC-17; `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-golden-3a.test.ts`; `packages/engine/test/worksheet-rules-3a.test.ts` |
| WS-A13 | 3a | Home Delivered Meals: units/day and days/wk; Units = ROUNDUP(Units/Day × MaxDays) | DONE | verified in 3a workbook row 106; `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-golden-3a.test.ts` |
| WS-A14 | 3a | Adult Day Care (63+): minutes in multiples of 15, at most 10 h a day, at most 5 days a week | DONE | rule WS-R08; `packages/engine/test/worksheet-rules-3a.test.ts`; `packages/engine/test/worksheet-3a-sheet.test.ts` |
| WS-A15 | 3a | Adult Day Care Waiver (18–62): same limits | DONE | rule WS-R08; `packages/engine/test/worksheet-rules-3a.test.ts` |
| WS-A16 | 3a | Chore: min/day and days/wk | DONE | service S5120 (`packages/engine/src/rulepacks/mo-2026-07.ts`); worksheet line `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-golden-3a.test.ts` |
| WS-A17 | 3a | Units/Day left blank except for Home Delivered Meals | DONE | `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-calc3a.test.ts` |
| WS-A18 | 3a | Line costs and total cost (O122 = sum of line costs) at the rate sheet's rates | DONE | rates PARTIAL (source Sheet2, not Appendix 1); `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-golden-3a.test.ts` |
| WS-A19 | 3a | Description of needs required only for ILW requests | DONE | rule WS-R02 with `ilwRequest`; `packages/engine/test/worksheet-rules-3a.test.ts` |
| WS-A20 | 3a | Comments carry the months for the General Health Evaluation | DONE | rule WS-R06; `packages/engine/test/worksheet-rules-3a.test.ts` |
| WS-A21 | 3a | Print one copy when a paper copy is needed | PLANNED | Prompt 6 |
| WS-A22 | 3a | Rate sheet: PC 8.14 (RCF/ALF 7.66), APC 8.17 (7.68), RN 60.99 (57.18), respite 8.14, ADC/ADCW 3.32, homemaker/chore 8.14, meals 10.99 | DONE | PARTIAL; rule pack `worksheet3a.rates`; `packages/engine/test/worksheet-golden-3a.test.ts`; `packages/engine/test/worksheet-3a-sheet.test.ts` |
| WS-A23 | 3a | Medically Related Household box: Homemaker units move into the Personal Care total and are priced at the Personal Care rate | DONE | `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-golden-3a.test.ts` |
| WS-A24 | 3a | Nurse visits: visits per month × RN rate, no units | DONE | `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-golden-3a.test.ts` |
| WS-A25 | 3a | Chore entered on its own row; chore task boxes (6) recorded, no calculation effect | DONE | `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-calc3a.test.ts`; `packages/engine/test/worksheet-3a-sheet.test.ts` |
| WS-A26 | 3a | Nurse task boxes (8) recorded, no calculation effect | DONE | `packages/engine/src/worksheet/calc3a.ts`; `packages/engine/test/worksheet-calc3a.test.ts`; `packages/engine/test/worksheet-3a-sheet.test.ts` |

### Manual (both pages)
| ID | Form | Item | Status | Refs |
|---|---|---|---|---|
| WS-M01 | both | Suggested times and frequencies are for an "average or typical participant" — say so next to them | DONE | `AVERAGE_PARTICIPANT_NOTE` in `packages/engine/src/worksheet/guidance.ts`; `packages/engine/test/guidance.test.ts` |
| WS-M02 | both | Shaded (computed) cells cannot be edited — computed cells are read-only in the view | PLANNED | |
| WS-M03 | both | Keyboard path through the fields in order (the manual recommends the Tab key) | PLANNED | a11y test |
| WS-M04 | both | Services are task-oriented and generally authorized on an ongoing basis | PLANNED | note only |
| WS-M05 | 3a | Upload to the electronic case record only when used for an ILW authorization; one copy when a copy is needed | PLANNED | note on the Worksheet view and print |

### Beyond DSDS's worksheet (the "and more")
| ID | Form | Item | Status | Refs |
|---|---|---|---|---|
| WS-X01 | beyond | Weekly and calendar schedule from the same tasks (Quick Schedule) | EXISTING | `apps/web/src/features/quick-schedule/QuickSchedule.tsx` |
| WS-X02 | beyond | Reads Fusion's care plan report and builds the schedule | EXISTING | `packages/import/src/report.ts` |
| WS-X03 | beyond | Month-by-month units for short months, partial months and suspensions | EXISTING | AUTH-05, SCH-12, SCH-14 |
| WS-X04 | beyond | Caregiver, overlap, 49-hour and nurse-visit-cap checks | EXISTING | CON-04, CON-05, CON-09, CON-10 |
| WS-X05 | beyond | "Show the math" for every number (formula in words) | PLANNED | |
| WS-X06 | beyond | Worksheet total reconciled with the schedule's units and Fusion's figure | PLANNED | |
| WS-X07 | beyond | Public proof page (/conformance) | PLANNED | |
| WS-X08 | beyond | Export into DSDS's own workbook with only the input cells filled | PLANNED | Prompt 8, optional |
| WS-X09 | beyond | Weekly watch for a changed DSDS worksheet | PLANNED | Prompt 9 |
