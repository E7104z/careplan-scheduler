# CarePlan Scheduler — Phase 3 Cline Prompts (State worksheet parity and proof)

Goal: CarePlan Scheduler does **everything DSDS's worksheets do**, matches their arithmetic
**exactly**, and can **prove** it to anyone, even though it is not an official DSDS tool.

Sources this phase follows (all published by DHSS/DSDS):
- **HCBS-3c** Consumer Directed Services Worksheet, `4.00appendix4da-3cform.xlsx` (CDS tab 10/26, ILW tab 07/26)
- **HCBS-3a** In-Home Services Worksheet, `4.00appendix3da3aform.xlsx` (07/26)
- HCBS Manual pages 4.00 Appendix 3 (`.../400-home-and-community-based-services-10`) and Appendix 4d/3c (`.../400-home-and-community-based-services-11`)

Paste these into Cline **one at a time, in order**, on the branch `phase-3-worksheet` (Prompt 1
creates it from `main`). Start the next prompt only after Cline reports every check in the
prompt's **Finish** list passing.

Read first, every prompt: `.clinerules`, `docs/WORKSHEET-PARITY.md` (after Prompt 1),
`docs/ENGINE-SPEC.md`, `docs/APP-SPEC.md`.

Order: 1 files, ledger, rules · 2 exact 3c calculator and golden test · 3 suggested ranges,
task library, worksheet rules · 4 the 3a services · 5 Worksheet screen · 6 print and PDF ·
7 `/conformance` proof page · 8 export into DSDS's own workbook (optional) · 9 watch DSDS for changes.

**Review decisions (Oct 27, 2026, Prompt 1).** Built on `phase-3-worksheet`.
- **State files.** This delivery had the prompts, `hcbs3a-golden.json`, `make-golden-3a.py` and
  `reference-model-3a.py`. The rest of the list in Prompt 1 was made here from primary sources. Both
  workbooks were downloaded from health.mo.gov on Oct 27, 2026. The 3a's SHA-256 is the one in Prompt 4
  (`b32c35e5…`) and the 3c's is `701aaa12…`. The two manual pages have moved to
  `https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/400-home-and-community-based-services-10`
  (3a, "Revised - May 2025") and `…-11` (3c, "Revised - July 2026"); their page bodies are saved as text.
  `scripts/state/make-golden.py` (the 3c recalculation, built the same way as the 3a script) and
  `scripts/state/extract-guidance.py` were written from these prompts. `worksheet-guidance.json` comes
  from the second script, and the 3a CSV from the workbook's stored values (`scripts/state/sheet-to-csv.py`).
  `reference-model-3a.py` replays all 508 workbooks / 10,811 rows of `hcbs3a-golden.json` with 0 differences.
- **`hcbs3c-golden.json` needs LibreOffice**, and it isn't installed here. The 3c golden test (Prompt 2)
  and the conformance samples (Prompt 7) wait for it; see the note under Prompt 2.
- **Ledger refs are checkable.** The ledger test needs every `EXISTING` row to name a rule, a TC, a
  formula or a file that exists. WS-C01, A02, A04, A05 and A16 now also name
  `packages/engine/src/rulepacks/mo-2026-07.ts`. The "Beyond" table now has Form (`beyond`) and Refs
  columns, so X01–X04 name their file or rules, and X08/X09's "(Prompt 8, optional)" / "(Prompt 9)"
  moved into Refs. The test compares refs too, not only id, status and item.
- `.gitattributes`: `docs/fixtures/state/** -text`. Git on Windows (`core.autocrlf`) would otherwise
  check the JSON, CSV and text fixtures out with CRLF, and their SHA-256 would stop matching.
- The 3c workbook prints "DSDS STAFF NAME:" and "DATE:" on both tabs, while its manual page says
  "Assessor Signature and Date" for "the individual completing the document". W-3 stands (leave it blank;
  label it as the manual words it). DSDS question 6 (Prompt 7) asks which is right.

**Review decisions (Oct 27, 2026, Prompt 2).**
- **The 3c golden file was made here.** I used the reviewer's LibreOffice version, 24.2.7.2 (the official
  Windows build, checksum-verified, unpacked without installing), and `scripts/state/make-golden.py`.
  First, the same LibreOffice re-ran the reviewer's `make-golden-3a.py`: all 508 workbooks came out
  identical to the committed `hcbs3a-golden.json`. So the two machines' recalculations agree.
  The 3c file also records the Units/Day and Units/Wk text as LibreOffice displays it (a CSV saved
  "as shown"), so the "0.0" display is checked as well as the numbers.
- On Windows with long paths off, LibreOffice crashes without a message when its profile path is
  long. The README now says to give it a short profile path (`UserInstallation`).
- `formulaText`: an exact result reads "45 min ÷ 15 × 15 days = 45 units". A rounded one reads
  "309 min ÷ 15 × 23 days = 473.8, rounded up to 474 units". (The prompt's example said "rounded up"
  where nothing is rounded.) The fraction is never a whole number or `.0`, so one decimal is always
  clear. `calculate3c` also returns `costText` ("72 units × $5.23 = $376.56") for "Show the math".
- Inputs the sheet takes but a care plan can't have go to `issues`. That covers transportation
  minutes or ILW service units that aren't a whole number 0 or more, on top of the prompt's minutes
  and days. The sheet's Case Management line gives $458.09 for any entry, 0 included; that is copied,
  and the golden file confirms it.
- `worksheet3c` also carries `ilwExtrasSource` and `ceilingSource`, so every state number has a source (W-1).
- DSDS question 2 (the 3c's ROUNDUP against Appendix 14a/14b's TRUNC(x + 0.99), AUTH-03) fills the
  gap the prompts leave: they add questions 3, 3b and 4–7.
- Still for Jason: the three-value Excel check above. LibreOffice, not Excel, recalculated both golden files.

## What was found when this was written (Oct 26, 2026, `main` at the Merge of PR #4)

Already true, do not rebuild:
- The engine's F-2a (`hcbs3cTaskUnits`) equals the 3c's cell Q formula. Checked by recalculating
  DSDS's own workbook in LibreOffice for **every whole-minute value 1–1,440 × 1–7 days on both tabs
  (20,160 task cases), plus the transportation, total and cost cells: 0 differences**. Claude also
  ran the engine against the recorded answers. Prompt 2 builds the calculator and turns this into a
  permanent test (`hcbs3c-golden.json` is the recorded answers).
- The 25 CDS/ILW tasks and Essential Transportation are all in `mo-2026-07.ts`.
- Ceilings 641 (CDS tab) and 868 (ILW tab, Respite) are in the rule pack (AUTH-09).

Missing (this is the work):
1. No worksheet view at all: Quick Schedule shows weekly/monthly schedules, never the DSDS layout
   (Min/Day, Days/Wk, Units/Day, Max Days/Mo, Units/Wk, Total Units, Cost).
2. No "suggested time" or "suggested frequency" anywhere (both worksheets print them per task).
3. No cost (the 3c multiplies total units by $5.23) and no ILW cost lines (FMS, Case Management,
   SMS, SME, EAA).
4. No header fields: provider phone, IHS box, program, start date, emergency contact.
   No per-task "Description of needs", no Comments. The manual says Description of Needs is
   **required for all ILW requests**.
5. No 3a services: nurse visits, Respite Basic/Advanced worksheet lines, Home Delivered Meals,
   Adult Day Care (63+), Adult Day Care Waiver (18–62), Chore as worksheet lines, RCF/ALF flag,
   "Med Rel HC Tasks" flag. No 3a rules (APC 15-minute increments, ADC multiples of 15 / 10 h per
   day / 5 days a week, two nurse visits in an APC's first month, General Health Evaluation
   only for semiannual visits).
6. No proof a reviewer can see.

Known facts about DSDS's files that the prompts must respect:
- The CDS tab is edition **10/26**; the ILW tab and the 3a are **07/26**. Show the edition per tab.
- The 3c's cost uses a hard-coded **$5.23**; the real source is 3.00 Appendix 1. Treat the rate as
  PARTIAL until Jason confirms it (Prompt 7 adds the question for DSDS).
- Everything DSDS prints is "based on a 31 day month". The 3c and Fusion differ for short months
  (the engine already tells these apart: AUTH-03/AUTH-05). The Worksheet view uses the 3c's
  31-day math; the schedule keeps using calendar months. Show both and say which is which.
- The 3a workbook was read on Oct 27, 2026 (Prompt 4 lists what is in it). It has one calculation sheet and a rate sheet;
  its Personal Care rate ($8.14) differs from the 3c's CDS rate ($5.23), and it enforces nothing except days per week 1–7.
- Oracle caveat: LibreOffice, not Excel, recalculated the workbook. The arithmetic is plain
  `ROUNDUP`/`ROUNDDOWN`/`IF`, but Prompt 2 asks Jason to open the golden workbook once in Excel.

---

## Phase 3 rules (Prompt 1 appends these to `.clinerules`)

```
## Phase 3 rules (worksheet parity)
W-1. No state number is typed by hand in `src/`. Days-per-month table, ceilings, the unit rate,
     ADC limits and suggested ranges live in the rule pack with a `source` string. A test
     compares each with `docs/fixtures/state/`.
W-2. When the engine and DSDS's workbook disagree, stop and report. Never edit a golden file,
     a fixture or a test expectation to make a test pass.
W-3. The app never calls its output an official DSDS/DHSS form. Title: "Worksheet view". Always
     show: "Follows DSDS-HCBS-3c (10/26). Not an official DSDS form." Never sign for anyone and never pre-fill a
     signature or date. The 3c's "Assessor Signature and Date" is for "the individual completing the document";
     the 3a's is for "DSDS staff". The app leaves both blank (the 3c may carry an optional typed assessor name
     the person fills in, blank by default). Do not use the state's seal or the words
     "Missouri Department of Health and Senior Services" as a heading.
W-4. Participant name, DCN, provider phone, emergency contact and any person's name are memory-only
     like `identity` (rule 19, I-3): never sessionStorage, localStorage, Firestore, URL, console.
W-5. Do not invent billing codes, ceilings or rates. Where the state files do not give one, add it
     with status OPEN and make the app show REVIEW ("Waiting on DHSS").
W-6. Every ledger row (docs/WORKSHEET-PARITY.md) that is DONE has a test whose name contains its
     ID, e.g. `describe("WS-C09 ...")`. The ledger test enforces this.
W-7. Worksheet results (WS-*) never feed the Quick Schedule guard or its "Follows every rule" status.
     They appear only in the Worksheet view and on /conformance.
```

---

## The parity ledger

Prompt 1 copies this table into `docs/WORKSHEET-PARITY.md` and into
`packages/engine/src/worksheet/ledger.ts` (as data). Status starts as shown. `EXISTING` rows
cite the rule or test that already covers them.

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
| WS-H08 | 3c,3a | Edition stamp per tab (CDS 10/26, ILW 07/26, 3a 07/26) | PLANNED | |
| WS-H09 | 3c,3a | Emergency contact name and phone | PLANNED | memory-only |
| WS-H10 | 3c,3a | Signature and date line (3c: the individual completing it; 3a: DSDS staff): printed blank, never filled or signed by the app | PLANNED | W-3 |
| WS-H11 | 3a | CDS box: participant receives or is being authorized for Personal Care Assistance (Consumer-Directed) in addition to other HCBS | PLANNED | |
| WS-H12 | 3c | Once units are calculated, the monthly units are entered after the program type (State Plan / ILW) | PLANNED | shown pre-filled from the Total, editable only through the care plan |

### 3c calculation (CDS and ILW tabs)
| ID | Form | Item | Status | Refs |
|---|---|---|---|---|
| WS-C01 | 3c | The 25 tasks with DSDS's exact names, in DSDS's order | EXISTING | rule pack tasks; Prompt 3 adds order and a both-directions test |
| WS-C02 | 3c | Suggested time shown for every task | PLANNED | |
| WS-C03 | 3c | Suggested frequency shown for every task | PLANNED | |
| WS-C04 | 3c | Min/Day entry (whole minutes) | PLANNED | |
| WS-C05 | 3c | Days/Wk entry (1–7) | PLANNED | |
| WS-C06 | 3c | Units/Day = Min/Day ÷ 15, shown as the sheet shows it | PLANNED | |
| WS-C07 | 3c | Max Days/Mo from the table 1→5, 2→10, 3→15, 4→19, 5→23, 6→27, 7→31 | EXISTING | F-1 `factorFor`; rule pack |
| WS-C08 | 3c | Units/Wk = Min/Day × Days/Wk ÷ 15 | PLANNED | |
| WS-C09 | 3c | Total Units per task = ROUNDUP(Units/Day × Max Days/Mo) | EXISTING | F-2a `hcbs3cTaskUnits`; Prompt 2 adds the golden test |
| WS-C10 | 3c | Essential Transportation: minutes per month ÷ 15, rounded down | EXISTING | F-4, AUTH-08 |
| WS-C11 | 3c | Total Units/Mo = Σ task units + transportation units | PLANNED | |
| WS-C12 | 3c | Cost = Total Units × the sheet's rate ($5.23) | PLANNED | rate PARTIAL |
| WS-C13 | 3c | Total turns red above 641 (CDS tab) / 868 (ILW tab) | EXISTING | AUTH-09 ceilings; Prompt 5 shows it |
| WS-C14 | 3c | A row with no Days/Wk counts as nothing | PLANNED | |
| WS-C15 | 3c | "Based on a 31 day month" footnote | PLANNED | |
| WS-C16 | 3c,3a | Description of needs for each task | PLANNED | memory-only |
| WS-C17 | 3c,3a | Comments | PLANNED | memory-only |
| WS-C18 | 3c | Units shown with the task's suggested range check (outside range → INFO) | PLANNED | rule WS-R01 |

### 3c ILW tab only
| ID | Form | Item | Status | Refs |
|---|---|---|---|---|
| WS-I01 | 3c-ilw | Financial Management Services: units × 157.89 | PLANNED | rate PARTIAL |
| WS-I02 | 3c-ilw | Case Management: flat 458.09 when entered | PLANNED | rate PARTIAL |
| WS-I03 | 3c-ilw | Specialized Medical Supplies: units × 100 | PLANNED | |
| WS-I04 | 3c-ilw | Specialized Medical Equipment: units × 100 | PLANNED | |
| WS-I05 | 3c-ilw | Environmental Accessibility Adaptations: units × 100 | PLANNED | |
| WS-I06 | 3c-ilw | Description of Needs required for every ILW request (manual 4.00 App 4d) | PLANNED | rule WS-R02 |
| WS-I07 | 3c-ilw | Request goes to the Bureau of Federal Programs; BFP approval required before authorizing ILW | EXISTING | AUTH-12; Prompt 5 shows the note |
| WS-I08 | 3c | A participant needing more State Plan personal care than the cost maximum should be considered for ILW | PLANNED | rule WS-R03 |

### 3a calculation and services
| ID | Form | Item | Status | Refs |
|---|---|---|---|---|
| WS-A01 | 3a | RCF/ALF checkbox on Personal Care, Homemaker, Advanced PC, Nurse Visits | PLANNED | |
| WS-A02 | 3a | Personal Care: Bathing, Dietary, Dressing/Grooming, Mobility/Transfer/Position, Self Admin of Medications, Toileting, with suggested ranges | EXISTING | task library; ranges Prompt 3 |
| WS-A03 | 3a | "Med Rel HC Tasks" box under Personal Care; the tasks to be done are indicated in the Homemaker section | PLANNED | |
| WS-A04 | 3a | Homemaker: 11 tasks with suggested ranges | EXISTING | task library; ranges Prompt 3 |
| WS-A05 | 3a | Advanced Personal Care: 7 tasks with suggested ranges | EXISTING | task library; ranges Prompt 3 |
| WS-A06 | 3a | APC with a single task: minutes in 15-minute increments | PLANNED | rule WS-R04 |
| WS-A07 | 3a | APC: two nurse visits in the first month; none extra when the plan already has ongoing nurse visits | PLANNED | rule WS-R05 (PARTIAL) |
| WS-A08 | 3a | Authorized Nurse Visits: visits per month; days per month (not per week) when less than weekly; task boxes | PLANNED | |
| WS-A09 | 3a | General Health Evaluation only for semiannual nurse visits | PLANNED | rule WS-R06 |
| WS-A10 | 3a | Nurse "Other" (venipuncture, physician-ordered injections) needs prior approval and authorization | PLANNED | rule WS-R07 |
| WS-A11 | 3a | Total units exclude nurse visits | PLANNED | |
| WS-A12 | 3a | Respite Basic and Advanced: min/day and days/wk; combined total cannot exceed 868 | EXISTING | AUTH-09, TC-17; worksheet line Prompt 4 |
| WS-A13 | 3a | Home Delivered Meals: units/day and days/wk; Units = ROUNDUP(Units/Day × MaxDays) | PLANNED | verified in 3a workbook row 106 |
| WS-A14 | 3a | Adult Day Care (63+): minutes in multiples of 15, at most 10 h a day, at most 5 days a week | PLANNED | rule WS-R08 |
| WS-A15 | 3a | Adult Day Care Waiver (18–62): same limits | PLANNED | rule WS-R08 |
| WS-A16 | 3a | Chore: min/day and days/wk | EXISTING | service S5120; worksheet line Prompt 4 |
| WS-A17 | 3a | Units/Day left blank except for Home Delivered Meals | PLANNED | |
| WS-A18 | 3a | Line costs and total cost (O122 = sum of line costs) at the rate sheet's rates | PLANNED | rates PARTIAL (source Sheet2, not Appendix 1) |
| WS-A19 | 3a | Description of needs required only for ILW requests | PLANNED | |
| WS-A20 | 3a | Comments carry the months for the General Health Evaluation | PLANNED | |
| WS-A21 | 3a | Print one copy when a paper copy is needed | PLANNED | Prompt 6 |
| WS-A22 | 3a | Rate sheet: PC 8.14 (RCF/ALF 7.66), APC 8.17 (7.68), RN 60.99 (57.18), respite 8.14, ADC/ADCW 3.32, homemaker/chore 8.14, meals 10.99 | PLANNED | PARTIAL |
| WS-A23 | 3a | Medically Related Household box: Homemaker units move into the Personal Care total and are priced at the Personal Care rate | PLANNED | |
| WS-A24 | 3a | Nurse visits: visits per month × RN rate, no units | PLANNED | |
| WS-A25 | 3a | Chore entered on its own row; chore task boxes (6) recorded, no calculation effect | PLANNED | |
| WS-A26 | 3a | Nurse task boxes (8) recorded, no calculation effect | PLANNED | |

### Manual (both pages)
| ID | Form | Item | Status | Refs |
|---|---|---|---|---|
| WS-M01 | both | Suggested times and frequencies are for an "average or typical participant" — say so next to them | PLANNED | |
| WS-M02 | both | Shaded (computed) cells cannot be edited — computed cells are read-only in the view | PLANNED | |
| WS-M03 | both | Keyboard path through the fields in order (the manual recommends the Tab key) | PLANNED | a11y test |
| WS-M04 | both | Services are task-oriented and generally authorized on an ongoing basis | PLANNED | note only |
| WS-M05 | 3a | Upload to the electronic case record only when used for an ILW authorization; one copy when a copy is needed | PLANNED | note on the Worksheet view and print |

### Beyond DSDS's worksheet (the "and more")
| ID | Item | Status |
|---|---|---|
| WS-X01 | Weekly and calendar schedule from the same tasks (Quick Schedule) | EXISTING |
| WS-X02 | Reads Fusion's care plan report and builds the schedule | EXISTING |
| WS-X03 | Month-by-month units for short months, partial months and suspensions | EXISTING |
| WS-X04 | Caregiver, overlap, 49-hour and nurse-visit-cap checks | EXISTING |
| WS-X05 | "Show the math" for every number (formula in words) | PLANNED |
| WS-X06 | Worksheet total reconciled with the schedule's units and Fusion's figure | PLANNED |
| WS-X07 | Public proof page (/conformance) | PLANNED |
| WS-X08 | Export into DSDS's own workbook with only the input cells filled | PLANNED (Prompt 8, optional) |
| WS-X09 | Weekly watch for a changed DSDS worksheet | PLANNED (Prompt 9) |

---

## Prompt 1 — State files, ledger, rules

Branch: `phase-3-worksheet` (create it from `main`). Commit message:
`docs(worksheet): state fixtures, parity ledger and Phase 3 rules`

**Jason does this first** (Cline cannot download from health.mo.gov). Put these in the repo root
`docs/fixtures/state/` before pasting the prompt:
1. `4.00appendix4da-3cform.xlsx`, the 3c, from
   https://health.mo.gov/sites/health/files/2026-10/4.00appendix4da-3cform_0.xlsx (rename as shown)
2. `4.00appendix3da3aform.xlsx`, the 3a, from
   https://health.mo.gov/sites/health/files/2026-07/4.00appendix3da3aform.xlsx
3. `hcbs3a-in-home-services-worksheet.csv` (the `4_1.csv` already shared)
4. `hcbs3c-golden.json`, `hcbs3a-golden.json` and `worksheet-guidance.json` (made by Claude; they come with this file). The golden
   file's `meta.sourceFile` shows the name the workbook had when Claude ran it; the SHA-256 is what matters.
   Compare the SHA with your downloaded copy: if it differs, DSDS has re-published the form since Oct 26 —
   run `python scripts/state/make-golden.py docs/fixtures/state/4.00appendix4da-3cform.xlsx docs/fixtures/state/hcbs3c-golden.json`
   (needs LibreOffice) before Prompt 2.
5. `scripts/state/make-golden.py`, `scripts/state/make-golden-3a.py`, `scripts/state/extract-guidance.py` and `scripts/state/reference-model-3a.py` (come with this file)
6. `docs/fixtures/state/pages/manual-hcbs3c-cds-worksheet.txt` and `.../manual-hcbs3a-in-home-services-worksheet.txt`:
   the full text of the two manual pages as Jason pasted them on Oct 27, 2026 (they come with this file; Prompt 3's
   guidance test and Prompt 4 read them, and Prompt 9's watcher can compare against them).

Then paste:

> Read `.clinerules` and the top of `docs/PHASE-3-CLINE-PROMPTS.md` (everything above "Prompt 1").
> 1. Create branch `phase-3-worksheet` from `main`.
> 2. Confirm the six items above exist. If any is missing, stop and list what is missing.
> 3. Append the "Phase 3 rules" block from the prompts file to `.clinerules`, verbatim, and change
>    nothing else in `.clinerules`.
> 4. Add `docs/fixtures/state/README.md`: for each file its name, the URL it came from (the two
>    health.mo.gov URLs above; the CSV is "the 3a saved as CSV"), its SHA-256 (compute with
>    `node -e` and `crypto`; do not guess), and the edition stamp printed inside it.
> 5. Create `docs/WORKSHEET-PARITY.md` containing the parity ledger tables from the prompts file,
>    verbatim, preceded by two sentences saying what the file is for.
> 6. Create `packages/engine/src/worksheet/ledger.ts`: `export type LedgerStatus = "PLANNED" |
>    "EXISTING" | "DONE"`, `export interface LedgerEntry { id: string; form: string; item: string;
>    status: LedgerStatus; refs: string }`, `export const WORKSHEET_LEDGER: readonly LedgerEntry[]`
>    holding every row of the tables (the "Beyond DSDS's worksheet" rows have `form: "beyond"`).
>    Export it from `src/index.ts`.
> 7. Create `packages/engine/test/ledger.test.ts` with these tests: ids are unique and match
>    `/^WS-[A-Z]\d{2}$/`; every row of `docs/WORKSHEET-PARITY.md` matches a ledger entry (id, status,
>    item text) and the reverse; every `EXISTING` row's `refs` names at least one rule id (e.g.
>    `AUTH-09`), test id (`TC-17`) or file that exists; every `DONE` row has a `describe(` or `it(`
>    in `packages/engine/test/` or `apps/web/` whose name contains the row's id; the SHA-256 of each
>    file listed in `docs/fixtures/state/README.md` equals the file's real hash.
> 8. Do not change `docs/ENGINE-SPEC.md`, `docs/APP-SPEC.md` or any existing source file. This prompt (and
>    Prompts 2, 3, 4, 7 and 9 where they say so) may add files under `docs/fixtures/state/`; `.clinerules` rule 20 is
>    otherwise unchanged. Do not edit the files you were given.
>
> Finish (in `packages/engine`): `npx tsc --noEmit`, `npx vitest run`. Both must pass. Paste the summary lines.

---

## Prompt 2 — Exact 3c calculator and the golden test

Branch `phase-3-worksheet`. Commit message:
`feat(engine): HCBS-3c calculator that reproduces DSDS's workbook, with golden test`

**Jason does this once, in Excel (LibreOffice made the golden file; this proves Excel agrees).** Open
`docs/fixtures/state/4.00appendix4da-3cform.xlsx` in Excel. On the CDS tab, for "Bathing" enter Min/Day 61 and
Days/Wk 7 and note the Total Units cell; then enter 45 and 3 and note it again; then 309 and 5. The engine's answers are
127, 45 and 474 (`ceil(61×31/15)`, `ceil(45×15/15)`, `ceil(309×23/15)`). If Excel shows anything else, tell Cline
and stop: that is a LibreOffice/Excel difference and the golden file needs regenerating in Excel.

> Read `.clinerules`, `docs/WORKSHEET-PARITY.md`, `docs/fixtures/state/README.md`, and
> `packages/engine/src/math/units.ts`.
> **Goal:** a pure function that produces every number on the 3c, exactly as DSDS's workbook does.
>
> 1. Rule pack (`rulepacks/types.ts`, `mo-2026-07.ts`): add to `RulePack` an optional
>    `worksheet3c` object: `{ tabs: { CDS: { edition: string; ceiling: number }, ILW: { edition: string;
>    ceiling: number } }, unitRateCents: number, unitRateStatus: "PARTIAL", unitRateSource: string,
>    ilwExtras: { fmsRateCents: number; caseManagementCents: number; smsCents: number; smeCents: number;
>    eaaCents: number }, daysBasis: 31 }`. Fill the numbers from `docs/fixtures/state/hcbs3c-golden.json`
>    `meta` (formulas `=L93*5.23` → 523 cents, `157.89` → 15789, `458.09` → 45809, `*100` → 10000;
>    ceilings from `meta.tabs.*.ceilingValue`; rate from `meta.tabs.*.unitRateCents`; editions from `meta.tabs.*.edition`). Source strings:
>    `"HCBS-3c (10/26) cell O93"` etc. A test must derive these from the golden meta, not repeat them.
> 2. `src/worksheet/calc3c.ts`: `calculate3c(input: Worksheet3cInput, pack: RulePack): Worksheet3cResult`.
>    Input: `{ tab: "CDS" | "ILW"; rows: { taskCode: string; minPerDay: number | null; daysPerWeek: number | null }[];
>    transportMinutesPerMonth: number | null; ilwExtras?: {...units} }`.
>    Result per row: `unitsPerDay` and `unitsPerWeek` as exact fractions `{ num: number; den: number }`
>    (Min/Day over 15, and Min/Day × Days/Wk over 15) plus `display` strings (whole number, or one
>    decimal as Excel shows it — check how the workbook displays 0.4666… and match its number format
>    from the cell's `number_format`), `maxDaysPerMonth`, `totalUnits`, and `formulaText`
>    (e.g. `"45 min ÷ 15 × 15 days = 45 units, rounded up"`). Blank Days/Wk → the row is blank and
>    counts 0 (WS-C14). Totals: `totalUnits`, `costCents` (= units × `unitRateCents`, integer), `overCeiling`,
>    `ceiling`. Transport: minutes ÷ 15 rounded down, plus `unallocatedMinutes` (the sheet hides it;
>    we show it).
> 3. **Integer math only** (`.clinerules` 11): units = `ceil(min × maxDays / 15)` as
>    `Math.floor((min * maxDays + 14) / 15)`. Never `Math.ceil(a / b)`. Whole minutes `0–1440` and days `1–7`
>    only; anything else is returned in `issues[]` with copy "Enter whole minutes from 0 to 1,440." /
>    "Choose 1 to 7 days." and the row counts 0. Do not throw.
> 4. Do **not** change `hcbs3cTaskUnits`, `workbookTaskUnits`, `monthTaskUnits` or any existing rule.
> 5. `test/worksheet-golden.test.ts`: read `docs/fixtures/state/hcbs3c-golden.json` with `readFileSync`.
>    First assert `meta.sourceSha256` equals the SHA-256 of the xlsx in `docs/fixtures/state/` (message:
>    "The golden file was made from a different edition of the worksheet. Run
>    scripts/state/make-golden.py again and review the differences.").
>    Then replay **every** workbook in the file: build the 25 rows, call `calculate3c`, and assert each
>    row's units, the transport units, `totalUnits` and `costCents` equal what DSDS's workbook recorded.
>    ILW workbooks also check `ilwExtras` outputs (Q96–Q100). Group in `describe` blocks named
>    `WS-C09 task units match DSDS's workbook`, `WS-C10 ...`, `WS-C11 ...`, `WS-C12 ...`, `WS-I01 ...`
>    through `WS-I05`, `WS-C13 ceiling flag at 641/642 and 868/869`, `WS-C14 blank rows`.
>    Add the counts to a final test that fails unless `meta.caseCounts` is at least 10,080 for CDS and for ILW and the replayed row counts equal it.
> 6. Also add unit tests through `calculate3c`: ENGINE-SPEC TC-04 (309 min, 5 days → 474). TC-37 needs fractional
>    daily minutes, which the worksheet never takes, so it stays covered by the existing tests. Add `describe("Excel cross-check")` pinning
>    61×7 → 127, 45×3 → 45 and 309×5 → 474, the three values Jason confirms in Excel. If Jason reports a different
>    number, do not change the expectation: stop and report (W-2).
> 7. Mark WS-C04…C12, C14, C15, I01–I05 and the rows listed under the golden tests `DONE` in the
>    ledger (`ledger.ts` and `docs/WORKSHEET-PARITY.md`, same text), with refs to the file and test names.
>    WS-C06, WS-C08 are DONE here too (fractions + display). Leave WS-C16/C17 PLANNED.
> 8. Export from `src/index.ts`. `ENGINE-SPEC.md`: append **Amendment C** at the end: what `calculate3c`
>    is, that it is separate from `validatePlan`, and that it follows HCBS-3c exactly (this one edit is allowed).
>
> If any golden row differs from the engine, **stop and report the row, the sheet's value and the engine's
> value** (W-2).
>
> Finish (engine): `npx tsc --noEmit`, `npx vitest run`. Paste both summary lines and the golden test's
> case counts.

---

## Prompt 3 — Suggested ranges, task library, worksheet rules

Branch `phase-3-worksheet`. Commit message:
`feat(engine): DSDS suggested ranges, task-library parity and worksheet rules WS-R01 to WS-R03`

> Read `.clinerules`, `docs/WORKSHEET-PARITY.md`, `docs/fixtures/state/worksheet-guidance.json`.
> 1. `src/worksheet/guidance.ts`: a table `GUIDANCE` keyed by form (`"3c-cds" | "3c-ilw" | "3a"`) and the
>    DSDS row label, giving `{ taskCode, label, time: string, freq: string, minLow, minHigh, frequency }`
>    and the order of rows on the form. The 3c rows come from `worksheet-guidance.json` `3c.CDS.tasks`
>    and `3c.ILW.tasks` (they are identical; keep both, they are separate forms); the 3a rows from
>    `3a.sections`. Map each label to a `taskCode` through the rule pack's names and `aliases`; add
>    aliases to `mo-2026-07.ts` where a DSDS label has none (for example `ASST TRANS DEVICE`,
>    `DRESSING/ GROOMING`, `LAUNDRY (HOME/OFF SITE)`). Do not change task codes.
> 2. `test/guidance.test.ts`:
>    - the `GUIDANCE` table equals `worksheet-guidance.json` field for field (W-1) — `WS-C02`, `WS-C03`;
>    - every label on each form maps to exactly one `taskCode`, and every `CDS`/`ILW` task in the pack
>      appears on both 3c tabs in DSDS's order, and the reverse (`WS-C01`);
>    - every 3a Personal Care, Homemaker and Advanced PC label maps (`WS-A02`, `WS-A04`, `WS-A05`);
>    - the editions in the rule pack equal `worksheet-guidance.json` (`WS-H08`).
> 3. `src/worksheet/rules.ts`, three rules named after their IDs with JSDoc `@rule` and `@source`:
>    - `ruleWSR01OutsideSuggestedRange` (`INFO`): a task's Min/Day is outside the form's suggested
>      range. Message: "Outside DSDS's suggested range of {time}. Describe the need." Skip rows whose
>      suggested time is not a minutes range (for example `USE HC SECTION…`) and rows where the
>      range is a single value only when the entry is equal. Source: `HCBS-3c (10/26) suggested time column`.
>    - `ruleWSR02IlwDescription` (`REVIEW`): ILW tab, or a 3a marked "part of an ILW request" (3a: mandatory only for ILW requests), with a task that has units but
>      no Description of needs → "Describe why this task is needed and why this time is right." Source:
>      `HCBS Manual 4.00 Appendix 4d: Description of Needs is required for all ILW requests`. Status PARTIAL
>      (the manual says "all ILW requests"; we apply it per task) → keep `REVIEW`, never `BLOCK`.
>    - `ruleWSR03ConsiderIlw` (`INFO`): CDS tab total units above 641 → "Needs more than the State Plan
>      maximum. The manual says to consider the Independent Living Waiver." Source: same page.
>    A `validateWorksheet3c(input, pack)` entry point in `src/worksheet/validate.ts` runs them and stamps
>    `rulePackVersion` like `validatePlan`. Do **not** call these from `validatePlan` or `validateSchedule` (W-7).
> 4. Add the three rules to `RULE_CATALOG` in a new area `"Worksheet"` (extend `RuleArea`) with `status:
>    "PARTIAL"` for WS-R02 and `"VERIFIED"` for WS-R01/R03 ... **only if** the cited text supports it; the
>    catalog test compares with ENGINE-SPEC, so also append the three rows to ENGINE-SPEC Amendment C
>    (allowed) in the same table format. Update the Rules page copy only if the page lists areas by a
>    fixed array — add `"Worksheet"` there.
> 5. Tests for each rule: one passing and one failing case, with ids `WS-R01`…`WS-R03`. Mark WS-C01,
>    C02, C03, C16 (data model part only: the field is carried through the input and the rule reads it),
>    C18, I06, I08, M01 (the note constant `AVERAGE_PARTICIPANT_NOTE` exported from guidance.ts, text
>    "DSDS's suggested times and frequencies are for an average or typical participant."), A02, A04,
>    A05, H08 `DONE`. WS-C16 stays PLANNED until Prompt 5 (the UI field).
>
> Finish (engine): `npx tsc --noEmit`, `npx vitest run`; at the repo root `npm run typecheck`, `npm test`.
> Paste summary lines.

---

## Prompt 4 — The 3a services

Branch `phase-3-worksheet`. Commit message:
`feat(engine): HCBS-3a calculator, nurse, respite, meals, adult day care and chore lines, rules WS-R04 to WS-R09`

**Files (Jason puts them in `docs/fixtures/state/` before Prompt 1 if not already there):**
`4.00appendix3da3aform.xlsx` (SHA-256 `b32c35e555b1ec493c1745b1ca8f5fd90237a3cd6c50ddf149b11b24629de0b8`,
edition `DSDS-HCBS-3a (07/26)`), `hcbs3a-golden.json` (made by Claude from that workbook: 508 recalculated copies,
10,811 task rows, every flag combination) and `scripts/state/make-golden-3a.py`. If the SHA differs, DSDS re-published
the 3a: run the script (needs LibreOffice), read the diff, and stop and report before changing code.

**What Claude verified in the 3a workbook (Oct 27, 2026).** One sheet of calculations (`HCBS-3a`, 164 formulas) and a
rate sheet (`Sheet2`, 14 formulas). Cell addresses are in `hcbs3a-golden.json` `meta`.
1. **Task rows** (29): Personal Care 6, Homemaker 11, Advanced PC 7, Respite Basic and Advanced, Adult Day Care,
   Adult Day Care Waiver, Chore (entered on row 119). Each is exactly the 3c arithmetic:
   `Units = ROUNDUP(Min/Day ÷ 15 × MaxDays)` with MaxDays 5/10/15/19/23/27/31 for 1–7 days. Reuse `calculate3c`'s row math; do not copy it.
2. **Home Delivered Meals** (row 106): the inputs are **units per day** and days per week (no minutes);
   `Units = ROUNDUP(UnitsPerDay × MaxDays)`.
3. **Nurse visits** (row 96): one input, visits per month. No units. `Cost = visits × RN rate`, only when visits ≥ 1.
4. **Medically Related Household tasks** (Sheet2!L2, the box under Personal Care): when **on**, the Homemaker units are
   added into the Personal Care total (N29 = Σ Homemaker units) and priced at the Personal Care rate; Homemaker total is 0.
   When **off**, Homemaker is its own total, priced at the Homemaker/Chore rate.
5. **Subtotals only, no grand total of units:** Personal Care (N30), Homemaker (N66), Advanced PC (N90), plus each line.
   **Total cost** (O122) is the sum of every cost cell. "Excludes nurse visits" in the manual means nurse visits add no units.
6. **Rates** (Sheet2, dollars per unit; store as integer cents): Personal Care 8.14 (RCF/ALF 7.66); Advanced PC 8.17
   (RCF/ALF 7.68); RN visit 60.99 (RCF/ALF 57.18); Basic respite 8.14; Advanced respite 8.14; Adult Day Care and Adult Day
   Care Waiver 3.32; Homemaker and Chore 8.14; Home Delivered Meals 10.99 (labelled "Max 2/day"). The RCF/ALF boxes that change
   a rate are Personal Care, Advanced PC and Nurse Visits only. The rate for CDS on the 3c is a different number ($5.23).
7. **What the workbook enforces:** days per week must be a whole number 1–7. Nothing else. It does **not** enforce
   the 868 respite limit, APC 15-minute steps, or the Adult Day Care limits; those exist only as printed text and in the manual.
   CarePlan Scheduler enforces them (that is the "and more").
8. **Not to be copied** (state quirks): row 115's `N115`/`O115` formulas read cells that are always empty and never show a
   value; the "Respite Calc" in `Sheet2!R2:R3` (block lookups) is not used by any cell, and its two lists have 66 and 64
   entries; the block respite rates 81.07, 106.66, 267.79 and the nurse-respite rate 5.97 are listed but no formula uses
   them; the Homemaker RCF/ALF box, the 8 nurse task boxes and the 6 chore task boxes do not feed any formula. They are
   inputs to *record*, never to calculate. `reference-model-3a.py` (Claude's independent model) matches the workbook on every golden case.

**Nurse task boxes (8):** Fill Insulin Syringes, Eval APC Plan, Monitor Skin Cond, Train APC, Other (see below),
General Health Evaluation, Med Setup, Nail Care. **Chore task boxes (6):** Provide Rodent Control Within Home Using OTC,
Spray For Insects Within Home Using OTC, Clean Closets/Basement & Attics, Air Mattresses/Bedding, Wash Walls and Woodwork, Shampoo Rugs.

> Read `.clinerules`, `docs/WORKSHEET-PARITY.md`, `docs/fixtures/state/`, `packages/engine/src/worksheet/calc3c.ts`.
> 1. **Rule pack.** Add `worksheet3a` to `RulePack`: `{ edition: string, rates: {...cents above}, ratesStatus: "PARTIAL",
>    ratesSource: string, hdmMaxUnitsPerDayNote: 2 }`. Fill every number **from `hcbs3a-golden.json` `meta.rateCells`** (parse
>    the three `IF(...)` formulas for the RCF/ALF pairs); a test derives them from the meta rather than repeating them (W-1).
>    `ratesSource` = `"Sheet2 of DSDS-HCBS-3a (07/26); not yet checked against 3.00 Appendix 1"`.
> 2. **Calculator.** `src/worksheet/calc3a.ts`: `calculate3a(input, pack)`. Input: flags `{ personalCareRcfAlf, apcRcfAlf, nurseRcfAlf,
>    medRelHousehold }` (plus display-only `homemakerRcfAlf` and `cdsBox`), `rows` (section, taskCode, minPerDay, daysPerWeek) for the 29 rows,
>    `hdm: { unitsPerDay, daysPerWeek } | null`, `nurse: { visitsPerMonth, tasks: NurseTask[], comments } | null`, `chore: { tasks: ChoreTask[] }`.
>    Output: per-row units and `formulaText`; the subtotals above; per-line cost in cents; `totalCostCents`; `issues[]`.
>    Integer math only (rule 11). Reuse the 3c row function for the 29 rows; HDM uses the same table with units, not minutes.
>    A row with no Days/Wk counts as nothing. Do **not** model the quirks in item 8.
> 3. **Rules** in `src/worksheet/rules.ts` (same style as Prompt 3, each with `@rule` and `@source`), run by `validateWorksheet3a`:
>    - `ruleWSR04ApcSingleTask` (`BLOCK`): exactly one APC row has units and its minutes are not a multiple of 15.
>      Source: 3a instructions, Advanced Personal Care.
>    - `ruleWSR05ApcFirstMonthNurse` (`REVIEW`, PARTIAL): APC rows present, fewer than 2 nurse visits in the first month and the plan has
>      no ongoing nurse visits. Add this question to `docs/DSDS-QUESTIONS.md` as item 3 (allowed), email text included.
>    - `ruleWSR06GeneralHealthEvaluation` (`WARN`): General Health Evaluation is checked and the Comments do not name a month. "Check this
>      only for semi-annual visits and name the months in Comments."
>    - `ruleWSR07NurseOther` (`INFO`): Other is checked: "Needs prior approval and authorization from DSDS or its designee."
>    - `ruleWSR08AdultDayCare` (`BLOCK`): minutes not a multiple of 15, above 600 a day, or days above 5 a week (ADC and ADCW).
>      Source: 3a instructions, Adult Day Care. (The workbook only checks 1–7 days.)
>    - `ruleWSR09HdmUnits` (`REVIEW`, PARTIAL): Home Delivered Meals above 2 units a day. Source: "Max 2/day" printed beside the meals rate on the
>      3a's rate sheet; no manual text states it. Add it as item 3b of the DSDS questions.
>    - Respite over 868 combined units a month is AUTH-09 (`EXISTING`, BLOCK); call that rule from `validateWorksheet3a`, do not copy it.
> 4. **Golden test** `test/worksheet-golden-3a.test.ts`: SHA check (message as in Prompt 2); replay **every** workbook in `hcbs3a-golden.json`
>    (map the row numbers 11…119 to sections as the lists above) and assert each row's units, the subtotals (N29, N30, N66, N90, N106) and
>    every cost cell (O30, O66, O90, O96, O100, O103, O106, O109, O112, O119, O122) in cents; assert `N115`/`O115` are never produced.
>    Fail if `meta.caseCounts.taskRows` is below 10,811 or the replayed count differs. `describe` names: `WS-A06`…`WS-A18`, `WS-A22`…`WS-A26`.
> 5. One passing and one failing test per rule (ids in the `describe` names).
> 6. **Ledger and docs.** Mark WS-A01, A03, A06–A18, A22–A26 `DONE` (A12: "worksheet line; the 868 limit is AUTH-09"). Leave anything needing the screen
>    (A21, C16, C17, H01–H04, H09–H12) `PLANNED`. Append the 3a calculator, rate table and rules to ENGINE-SPEC Amendment C (allowed), including the
>    list of state quirks not copied and why.
> If the engine and the golden disagree, stop and report the cell, the workbook's value and ours (W-2).
>
> Finish (engine): `npx tsc --noEmit`, `npx vitest run`; root `npm run typecheck`, `npm test`. Paste summary lines and the golden case counts.

---

## Prompt 5 — The Worksheet screen

Branch `phase-3-worksheet`. Commit message:
`feat(web): Worksheet view that follows the DSDS-HCBS-3c and 3a layout, with show the math`

> Read `.clinerules` (rules 13–22 and W-1…W-7), `docs/APP-SPEC.md` sections 4, 5.1, 5.4, 5.6, 5.7 and 11,
> `docs/WORKSHEET-PARITY.md`, and these files: `QuickSchedule.tsx`, `SchedulePane.tsx`, `CarePlanPane.tsx`,
> `state.ts`, `useQuickStore.ts`, `model.ts`, `types.ts`, `ruleCopy.ts`, `print.css`.
> **What to build.** A third view in Quick Schedule, **Worksheet**, beside the existing schedule view
> (a tab control with the existing tab pattern; if there is none, a two-item `role="tablist"` with arrow keys).
> It shows the care plan the person already entered, laid out as the DSDS form for the selected service:
> `T1019U2` → 3c CDS tab; `T1019U6` → 3c ILW tab; `T1019`, `T1019TF`, `S5130`, `S5120`, `S5150`,
> `S5150TF` → 3a. All numbers come from `calculate3c` / `calculate3a` (rule 13). No math in the app.
> 1. **Header** (WS-H01…H12): participant name, DCN, provider name, provider phone, IHS checkbox (3c), CDS checkbox (3a, WS-H11), program
>    (read-only: follows the service) with the monthly units beside it (WS-H12: pre-filled from the total), start date (read-only: the plan start), edition stamp ("Follows DSDS-HCBS-3c
>    (10/26)" using the pack's edition), emergency contact name and phone. Name, DCN, phone and emergency contact
>    live in memory only (W-4): add them to `identity`/a new `worksheetPrivate` object that `persistence.ts`
>    never writes. There are no signature or date fields. Show a blank line labelled "Signature and date:
>    for the person completing the form" on the 3c and "DSDS staff signature and date" on the 3a (the manual words
>    them differently); never fill or auto-date either (W-3). The 3c may carry an optional typed "Assessor" name,
>    blank by default and memory-only." Banner at the top, always: "Follows DSDS-HCBS-3c (10/26). Not an official DSDS form." (W-3).
> 2. **Table** with DSDS's exact columns and order: Task · Suggested time · Suggested frequency · Min/Day ·
>    Days/Wk · Units/Day · Max Days/Mo · Units/Wk · Total Units. Rows in DSDS's order from `GUIDANCE`; the person's
>    tasks fill their rows; DSDS rows with no task show blank. A care-plan task that is not on the form shows in
>    a section "Not on the DSDS form" with an INFO note. Computed columns are read-only text (WS-M02). Min/Day and
>    Days/Wk are **the same values** as the care plan pane (one source of truth: editing here goes through the
>    guard exactly as the care plan pane does, rule 19a — reuse its handlers; do not add a second path).
> 3. **Essential transportation** row and the **Total** row, with cost as "Estimated cost at $5.23 a unit (the rate
>    on DSDS's worksheet)". The total turns the `danger` token (a token, not a color literal) and says
>    "Over the 641-unit maximum" / "Over the 868-unit maximum" when `overCeiling`. If CDS and over: the WS-R03 note
>    with a button "See it on the ILW worksheet" that switches the service to ILW **through the guard**.
> 4. **Descriptions of need** per task (textarea) and **Comments**; ILW: the extras block (FMS, Case Management,
>    SMS, SME, EAA units → cost) and the note "ILW requests go to the Bureau of Federal Programs. BFP approval is
>    required before authorizing ILW." (WS-I07). 3a: RCF/ALF checkboxes; the Med Rel HC Tasks box under Personal Care, which when checked asks which Homemaker tasks are
>    done under the Personal Care authorization and marks those Homemaker rows (WS-A03); an "This is part of an ILW request"
>    switch (the manual: Description of Needs on the 3a is mandatory only for ILW requests, so WS-R02 applies on the 3a only
>    when the switch is on); the one-copy / upload-only-for-ILW note (WS-M05); Nurse Visits block
>    (visits per month, the 8 task boxes, Comments), Respite Basic/Advanced, Home Delivered Meals (units per day), Adult Day Care and
>    Adult Day Care Waiver, Chore (its own row and 6 task boxes) — exactly the blocks Prompt 4 built, with line costs and the total cost
>    shown as "Estimated at the rates on DSDS's rate sheet".
> 5. **Show the math** button on the table: each Total Units cell reveals its `formulaText` ("45 min ÷ 15 × 15 days
>    = 45 units, rounded up") and the table footer shows `AVERAGE_PARTICIPANT_NOTE` and "Based on a 31-day month"
>    (WS-X05, M01, C15).
> 6. **Reconcile line** under the table (WS-X06): "Worksheet (31-day basis): N units · Schedule, {month}: M units ·
>    Fusion: F units." with a one-sentence plain-words reason when they differ, using the existing AUTH-03/05 copy.
>    No green; use token colors only.
> 7. **Checks**: show `validateWorksheet3c/3a` results in a list under the table using `SeverityPill`; add their
>    copy to `ruleCopy.ts` under the exact sentences Prompt 3 and 4 gave (rule 15, sentence case).
> 8. **Accessibility** (rule 16): label every field; Tab order follows the form top to bottom, left to right
>    (WS-M03); axe zero violations on the Worksheet view in phone and desktop; the table has a caption and
>    `scope` headers; `aria-live="polite"` for the total.
> 9. **Tests**: pure helpers (`worksheetView.ts`: mapping from `QuickState` to `Worksheet3cInput`/3a, with tests
>    that the mapping never reads anything but state and the pack); Playwright `quick-schedule.spec.ts` additions
>    (public project, no Firebase): switch to Worksheet, enter 45 min × 5 days → Total shows 45? (compute the number from
>    the golden file in the test, not by hand), change service to ILW, ceiling message appears at 642 units (build a plan
>    that reaches it by minutes); sessionStorage never contains the name, DCN, phone or emergency contact after typing
>    them. Bundle: `/quick` must stay under the 180 KB budget; the Worksheet view may be a lazy chunk.
> 10. Ledger: mark every row this screen completes `DONE` with `describe` names containing the ids
>     (H01–H10, C13, C16, C17, I07, M02–M04, X05, X06, A01, A03, A08…A20 as built) — in `apps/web` tests.
>
> Finish: `npm run typecheck`, `npm test`, `npm run build` (runs check-bundle), then
> `npx playwright test --project=desktop --project=phone` in `apps/web`. Paste summary lines and the `/quick`
> gzip size.

---

## Prompt 6 — Print and PDF in the DSDS layout

Branch `phase-3-worksheet`. Commit message: `feat(web): one-page Worksheet print and PDF`

> Read `schedulePdf.ts`, `printSchedule.ts`, `print.css`, and the Worksheet view from Prompt 5.
> Add "Print worksheet" and "Save worksheet as PDF" to the Worksheet view, same mechanism as the schedule
> (File > Print in the Windows app already calls the schedule's print; add the worksheet only if the menu code
> needs no change, otherwise leave the desktop app alone — rule D-5).
> The page: one portrait page per form (3c CDS, 3c ILW, 3a — two pages if the 3a's blocks don't fit), header block,
> the table with the same columns, total row, descriptions, comments, ILW extras, and at the bottom:
> "Prepared with CarePlan Scheduler on {date}. Not an official DSDS form." Print the signature and date line blank, labelled
> as on the screen (3c: "for the person completing the form"; 3a: "DSDS staff"). Name, DCN, phone and emergency contact print only if the person typed them.
> Footer on every page: rule-pack id and the form edition ("Follows DSDS-HCBS-3c (10/26)").
> Tests: a text test of the PDF builder (extract text with pdf.js like the existing schedule PDF test) that finds
> every column header, the total, the edition, the "Not an official DSDS form" line, and that the staff-name
> and date lines are empty. Ledger: WS-A21, WS-H10 `DONE`.
> Finish: `npm run typecheck`, `npm test`, `npm run build`, Playwright desktop+phone. Paste summary lines.

---

## Prompt 7 — `/conformance`: the proof page

Branch `phase-3-worksheet`. Commit message: `feat(web): public conformance page and ledger completeness test`

> Read `docs/APP-SPEC.md` sections 3 (routes), 10 (budgets), 12 (public pages), the Rules page, and `router.tsx`.
> **Goal:** anyone — a DSDS reviewer, an agency owner — can see in two minutes that CarePlan Scheduler matches
> DSDS's worksheets, and can check it themselves.
> 1. `scripts/state/make-conformance-samples.mjs` reads `hcbs3c-golden.json` and writes
>    `apps/web/src/pages/conformanceSamples.ts`: counts (workbooks, task cases, transport cases per tab, the
>    min/max minutes, the SHA-256 and edition of each state file, the LibreOffice version, date) and **12 fixed
>    sample rows** (include 309 min × 5 days, 61 min × 7 days, 45 × 3, 1 × 1, 1440 × 7, and the 641/642 total
>    boundary). Commit the generated file. A test compares it with the golden file and fails if they drift.
> 2. `/conformance` (public, no Firebase, lazy chunk, within the 180 KB budget): 
>    - Heading "How CarePlan Scheduler matches the state's worksheets".
>    - A plain statement: "CarePlan Scheduler is not an official DSDS tool and DSDS has not reviewed it." Then
>      what was done: "We typed {N} combinations of minutes and days into DSDS's own worksheet workbook,
>      recalculated it, and compared every answer with ours. {D} differences." — `D` is computed from the
>      samples module's `differences` field, which the test requires to be `0`; if it is ever not 0 the page
>      build fails.
>    - **Check it yourself** (the proof): a table of the 12 sample rows: Min/Day, Days/Wk, "DSDS workbook
>      says" (recorded), "CarePlan Scheduler says" (computed live by `calculate3c`). Beside it: 4 steps — download
>      DSDS's worksheet (link to the two health.mo.gov manual pages, not the files), type the first row in, compare.
>    - **Ledger status**: the parity ledger as a table with status pills and a count line "{n} of {total} worksheet
>      items done" and the list of anything not `DONE`/`EXISTING` (must be empty at the end of this prompt).
>    - **Known limits** (honest): LibreOffice was the recalculation engine; the unit rate is DSDS's number and
>      PARTIAL; the CDS tab is 10/26 and the ILW tab and 3a are 07/26; Quick Schedule's calendar months
>      differ from the worksheet's 31-day basis and the page says so.
>    - Link from the footer and the Rules page ("How we match DSDS's worksheets").
> 3. `apps/web/e2e/public/conformance.spec.ts`: page loads, axe zero violations on phone and desktop, the live
>    column equals the recorded column for all 12 rows, no network calls to Firebase.
> 4. `packages/engine/test/ledger.test.ts` gains the final test: **no ledger row is `PLANNED`** except rows whose
>    `refs` contain "Prompt 8" or "Prompt 9" (the optional ones).
> 5. Append items 4–7 to `docs/DSDS-QUESTIONS.md` (allowed): (7) the 3a's rate sheet lists block respite rates (81.07, 106.66, 267.79), a nurse-respite rate (5.97) and a "Respite Calc" that no cell uses, and the Homemaker RCF/ALF box changes no rate: are these retired or intended? Is Personal Care $8.14 (agency, 3a) versus $5.23 (CDS, 3c) the current rate pair, and where in 3.00 Appendix 1 are they? (4) the CDS tab edition is 10/26 and the ILW tab is
>    07/26: do the ILW formulas and the $157.89 / $458.09 / $100 amounts follow the 10/26 edition? and what is the
>    source of the $5.23 rate; (6) the 3c page says the "individual completing the document" signs and dates it, while the 3a says "DSDS staff" signs: may a provider-side designee complete and sign the 3c, and does DSDS want a provider-prepared worksheet at all? and the 3c page says "Revised - July 2026" but the CDS tab is stamped 10/26 and sits in the 2026-10 folder: which is the current edition? (5) the ILW section of the manual says "ILW tab on the HCBS-4c" while the form is
>    HCBS-3c: which is current? — each with ready-to-send email text in the same format.
> Finish: `npm run typecheck`, `npm test`, `npm run build`, Playwright desktop+phone. Paste summary lines.

---

## Prompt 8 (optional, last) — Export into DSDS's own workbook

Branch `phase-3-worksheet`. Commit message: `feat(web): fill DSDS's own worksheet workbook with the entered values`

Only start this if Jason says so. It is the strongest proof (Excel itself recalculates the person's numbers)
and the riskiest (it edits a state file).

> Read `.clinerules`, Prompt 5's `worksheetView.ts`, and `docs/fixtures/state/`.
> Add a lazily loaded export: the web app bundles **unchanged copies** of the two state workbooks as static
> assets (`apps/web/public/state/…`, with a test that their SHA-256 equals `docs/fixtures/state/README.md`)
> and writes **only the input cells** into a copy by editing the sheet XML inside the .xlsx (zip). Add the one
> dependency `fflate` `0.8.2` (`--save-exact`), imported only in the lazy chunk. Inputs written: participant
> name, DCN, provider, phone, IHS, start date, Min/Day (column L), Days/Wk (column N), transport minutes (F88),
> descriptions, comments, ILW extra units (O96–O100), emergency contact. **Never** write any formula cell,
> the signature or date cells. Set `fullCalcOnLoad="1"` so Excel recalculates on open.
> Tests: (a) unit test that unzips the export and the original and proves that only whitelisted cells differ;
> (b) a manual script `scripts/state/verify-export.py` (not in CI) that exports a sample, recalculates it with
> LibreOffice and asserts the workbook's Total Units equals `calculate3c`'s; run it and paste the output.
> The button says "Download as DSDS's worksheet (.xlsx)" and the note says "This is DSDS's own file with your
> numbers typed in. DSDS staff complete and sign it." Memory-only fields (W-4) are written to the file the person
> downloads, never to anywhere else.
> If the bundle budget or the XML edit is not safe, stop and report; do not widen the budget.
> Ledger: WS-X08 `DONE`.
> Finish: `npm run typecheck`, `npm test`, `npm run build`, Playwright desktop+phone, and the manual verify script output.

---

## Prompt 9 — Watch DSDS for a changed worksheet

Branch `phase-3-worksheet`. Commit message: `ci: weekly check that DSDS's worksheets and manual pages have not changed`

> Add `.github/workflows/state-forms-watch.yml`: `on: schedule` (Mondays 14:00 UTC) and `workflow_dispatch`.
> Steps (pin `actions/checkout@v4`, `actions/setup-node@v4`, as `ci.yml` does): download the two manual pages
> (`.../400-home-and-community-based-services-10` and `-11`), read the `.xlsx` links from them, download each file
> with `curl --fail`, compute SHA-256, compare with `docs/fixtures/state/README.md`. If a hash differs or a link has
> changed, open (or update) one GitHub issue titled "DSDS changed a worksheet" listing the file, old and new hash,
> and the page's "Revised" date, using `gh issue` with `permissions: issues: write`. Never commit or open a PR from
> the workflow. If the download fails, fail the job without opening an issue.
> Put the logic in `scripts/state/watch.mjs` (Node 22, no dependencies) so it can run locally; add a vitest-free
> self-test run by `node scripts/state/watch.mjs --self-test` that checks the link extractor on a saved copy of
> each page's HTML (save the two pages into `docs/fixtures/state/pages/`, allowed in this prompt).
> Ledger: WS-X09 `DONE`.
> Finish: `node scripts/state/watch.mjs --self-test`, `npm run typecheck`, `npm test`. Paste output.

---

## After Phase 3

- `/conformance` shows every ledger row `DONE` or `EXISTING`, 0 differences against DSDS's workbooks.
- When DSDS publishes a new edition: the weekly job opens an issue; rerun `make-golden.py`, read the diff,
  update the rule pack, and the golden test says exactly what changed.
- Send `docs/DSDS-QUESTIONS.md` items 1–7 to LTSS@health.mo.gov. Until DSDS answers, the Rules page keeps PARTIAL
  rows as "Needs review".
