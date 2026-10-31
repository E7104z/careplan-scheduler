# CarePlan Scheduler — Fusion Import Specification (Phase 2)

Pasting a care plan from Fusion, or opening its PDF, is how a schedule starts. This is what
made Scheduler Lite special, and it is the front door of CarePlan Scheduler. The goal: the
person pastes or drops the plan and sees a finished schedule, with proof that every task was
read correctly.

This file is the source of truth for `packages/import` and for the import parts of
`apps/web`. `docs/APP-SPEC.md` covers the screens; `docs/ENGINE-SPEC.md` covers the math.
Reference implementation (plain JavaScript, used by the prototype):
`docs/design/reference/fusion-parse.js` and `docs/design/reference/quick-model.js`.
Fixtures: `docs/fixtures/fusion/`.

---

## 1. What Fusion gives us

Everything below was observed in real GCA care plans (Apr 2026 pastes and a Mar 2026 screen),
then de-identified for the fixtures. Never commit a real care plan, name, DCN or PA number.

The care plan screen in HCBS Fusion has, top to bottom:

| Part | Example | Notes |
|---|---|---|
| Banner | `SAMPLE PARTICIPANT B (DCN: 10000002) Care Plan: 12/01/2025 - 10/31/2026 Total Cost: $2436.53` | Name in capitals; "Total Cost" is sometimes missing. |
| Toolbar | `Export ...`, `Search:` | Ignored. |
| Column headings | `Total Units · Task Type · Minutes Per Day · Days Per Week · Units Per Day · Units Per Month · Units Per Year · Minutes Per Month` | Ignored. |
| Service group row | `PC - CDS \| TEST HOME CARE LLC \| 5555550100 \| 12/01/2025 - 10/31/2026 \| 455 units \| $2,436.53 \| PA: 20250000000002` | One per service. Cost is sometimes missing. |
| Task rows | `455 units · Bathing · 45 · 7` | "Total Units" repeats the service's monthly units on every row. |
| Transportation row | `455 units · Essential Transportation · · · · 23 · · 345` | Units per month and minutes per month; no minutes per day. |
| Paging | `Showing 1 to 10 of 14 entries · Previous · 1 · 2 · Next` | **Fusion shows 10 rows per page.** A copy of page 1 misses the rest. |

Fusion truncates some names ("Essential Correspond" for Essential Correspondence) and uses
short forms ("Asst. with Toileting").

### 1.1 Clipboard shapes we must read
The same table reaches the clipboard in different shapes depending on browser and device:

| Shape | Example row | Fixture |
|---|---|---|
| Run-together (no separators at all) | `466 unitsBathing455466 unitsChange Linens101` | A |
| Tab-separated | `455 units⇥Bathing⇥45⇥7⇥⇥⇥⇥` | B, C, D |
| Pipes or 2+ spaces between cells | `455 units \| Bathing \| 45 \| 7` | variants of B |
| Single spaces (PDF text, some browsers) | `455 units Bathing 45 7` | PDF fixtures |
| Rows only, no banner or group row | `402 units⇥Bathing⇥15⇥7` | C |
| Two pages pasted one after the other | page 1 then page 2 | B-page1, B-page2 |

### 1.2 How Fusion figures the monthly units (verified)
Fusion's monthly figure equals the engine's derived month units (`derivedServiceMonthUnits`)
for a **30-day month**: daily tasks use 30 days, other tasks use the DHSS factor
(1→5, 2→10, 3→15, 4→19, 5→23, 6→27), each task rounded up, plus transportation units.

| Plan | Shape | Fusion | Engine, 30-day month | Result |
|---|---|---|---|---|
| A, 5-day plan | run-together | 466 | 466 | match |
| B, 7-day plan | tab-separated | 455 | 455 | match |
| C, older plan (Feb 2025) | rows only | 402 | 391 (401 for 31 days) | no match: flagged, Fusion's figure used |

**Answered by DSDS's Fusion FAQ (Jun 4, 2025):** "Fusion pro-rates units monthly for care
plans containing tasks occurring 7 days weekly"; a task's units are its units per day times 31,
a task done fewer days a week counts a set number of days ("a 3 day a week task will be
calculated at 15 days per month"), and a shorter month changes only the 7-day tasks (139, 136
and 133 units for 31, 30 and 29 days in its example). INFO 05-25-03 adds that migrated plans
show only the longest month's total. So the care plan screen's one figure is Fusion's figure
for one month length (30 days for A and B), and Fusion's figure for each other month is that
figure prorated the same way: B is 469 in a 31-day month and 434 in a 28-day month. Applying 455
to every month, as before Oct 25, 2026, cut authorized care at the end of 31-day months and let
February go 21 units over Fusion's figure (IMP-10 now prorates; decided Oct 25, 2026).

### 1.3 Fusion's care plan report (PDF)
Seen in Oct 2026 in a real GCA plan (agency personal care), then de-identified as fixture E
(`E-care-plan-report-229.txt`, and `fusion-care-plan-report.pdf`, which
`make-care-plan-report.py` makes). This is the "Home & Community Based Services Care Plan" PDF,
a different document from the care plan screen. No row says "units", so the screen's reader
(IMP-05) finds nothing in it.

| Part | Example | Notes |
|---|---|---|
| Participant | `Participant Information: SAMPLE PARTICIPANT E`, then `DCN: 10000005` | Address, date of birth, phones and COOP priority are printed beside it. They are never read. |
| Plan dates | `Care Plan Information 04/01/2026 - 01/31/2027` | |
| Page header and footer | `SAMPLE PARTICIPANT E - DCN:10000005` · `Date Generated: 10/23/2026 \| Page 2 of 5` | On every page; skipped. |
| Service row | `PC - Agency ⇥ N/A ⇥ N/A ⇥ 20260000000005` | Service Type, Start, End, Provider, GHE 1, GHE 2, Prior Authorization. The dates and provider wrap onto two lines, so they land above and below the label: `04/01 ⇥ 01/31 ⇥ PROVIDER , (555) 555-` and `/2026 ⇥ /2027 ⇥ 0100`. |
| Month table | `04/01/2026 ⇥ 04/30/2026 ⇥ T1019 ⇥ 229` | Start Date, End Date, Procedure Code, Authorized Units: one row per month. |
| Task table | `Med Rel HC Tasks: Trash ⇥ 5 ⇥ 3 ⇥ N/A` | Task, #Min/Day, #Units/Day, #Days/Week, #Units/Month, Comments. An empty cell leaves nothing in the text, so a personal care row has two numbers: minutes a day, then days a week. |
| Other services | `GHE` (General Health Evaluation), procedure code T1001, 1 unit | A nurse visit, each on its own page. |

The PDF draws one wide blank text item across each gap between cells (IMP-14 drops it).
Agency plans list household tasks as "Med Rel HC Tasks: <task>" and use short names: "Laundry
(Home/Off Site)", "Shop/Errands/Correspond" and "Self Admin of Meds" (ENGINE-SPEC section 3
aliases). Those household tasks are agency personal care tasks in the rule pack too (ENGINE-SPEC
Amendment B), so a plan built by hand can have them. The real plan's tasks add up to exactly its monthly units by the method in 1.2.

---

## 2. Rules

| ID | Rule |
|---|---|
| IMP-01 | **Normalize** before reading: `\r\n`/`\r` → `\n`; no-break and figure spaces → space; Unicode dashes → `-`; remove `__` (rich-text underline marks). |
| IMP-02 | **Banner**: `^<name> (DCN: <6–12 digits>) Care Plan: <m/d/yyyy> - <m/d/yyyy>` with optional `Total Cost: $<amount>`. Gives participant name, DCN and plan dates. |
| IMP-03 | **Paging**: every `Showing <a> to <b> of <n> entries`; the plan's row count is the largest `n`. |
| IMP-04 | **Service group row**: `<LABEL> \| <provider> \| [<10-digit phone> \|] <start> - <end> \| <units> units \| [$<cost> \|] [PA: <digits>]`. LABEL is 2–6 capitals, `-`, words (e.g. `PC - CDS`). Rows after it, up to the next group row, belong to it. |
| IMP-05 | **Rows**: split the service's text on `<units>\s*units` using that service's own units, so run-together text splits exactly (the match can only start where `units` follows). With no group row, use the most frequent `<n> units`. Text after the last row is cut at `Showing`, `Previous`, `Next`, `Search:`, `Export ...` or `Total Units Task Type`. |
| IMP-06 | **Reading a row**: if it has tabs, pipes or 2+ spaces, split into cells, keeping empty ones; the name is the first cell and numbers are the numeric cells in order. Otherwise the name is the leading text up to the first digit, and the rest is numbers: separated by single spaces (cells), or one run of digits (run-together). |
| IMP-07 | **Task numbers**: cells → first two numbers are minutes per day and days per week. Run-together → the last digit is days per week (always one digit, 1–7) and the digits before it are minutes per day. Valid only if days 1–7 and minutes 1–1440; otherwise the row is unread. |
| IMP-08 | **Transportation numbers**: find the pair (units, minutes) where `floor(minutes / 15) = units`; for run-together digits try every split point. The plan's transportation is that minutes-per-month value. |
| IMP-09 | **Task names**: match the rule pack's task names and aliases ignoring case and extra spaces; if none, accept a unique prefix match of 6+ characters (Fusion truncation). A name with a group prefix, such as the care plan report's `Med Rel HC Tasks: Trash`, is matched by the part after the last colon. No match → keep the Fusion name, warn, and schedule it anyway (taskCode `FUSION:<name>`). |
| IMP-10 | **Monthly authorization**: the group row's units, prorated to each **full** month of the schedule as Fusion prorates (1.2), become a Fusion `MonthlyAuthorization` (source `fusion`) for that month. When our total from the rows read equals Fusion's figure for some month length (IMP-15), each month's figure is our total for that month: Fusion's own method on the same tasks. When it doesn't (rows may be missing), each month's figure is Fusion's, lowered in a month shorter than 30 days by what the daily tasks read lose there, and never raised above Fusion's. Partial months get none (SCH-12 asks for that month's figure). The care plan report gives each month's own figure instead (IMP-17); those are used as they are. |
| IMP-11 | **Service labels**: `PC - CDS` → `T1019U2`; `PC - Agency` → `T1019`; `HC` → `S5130` (homemaker) (care plan reports, Oct 2026). On the care plan report, a label not in the map is named by its month table's procedure code when the rule pack has that code as a 15-minute service and no other label in the report uses it; never by `T1019`, which Fusion shows under both agency and CDS. Any other label → ask the person which service it is (from the rule pack's 15-minute services), or keep it without a schedule (IMP-19), once per label. Add a label to the map only after seeing it in a real plan. |
| IMP-12 | **Several pastes**: each new paste is added to the ones before (Fusion page 2, 3…). Rows join the service with the same label and units; a task already read is not added twice; a different DCN is refused. |
| IMP-13 | **Plan dates** come from the banner, else from the group row. Neither → ask for them. |
| IMP-14 | **PDF**: text is read in the browser with pdf.js (`isEvalSupported: false`), never uploaded. Blank text items are dropped first (the care plan report draws one across each gap between cells, which would otherwise close the gap). Text items are grouped into lines by baseline (same line when `|Δy| ≤ 0.5 × font height`), sorted left to right, and joined with a tab when the gap is more than 0.8 × font height, a space when more than 0.15 ×, otherwise nothing. Pages are joined with newlines. The result goes through the same reader as a paste. A PDF with no text (a scan) gets its own message. |
| IMP-15 | **Checksum**: for each month length that occurs among the full plan months, compute derived month units from the rows read. If Fusion's units equal any of them, show "Every task read" with both numbers. If not, show the mismatch with our figures and keep Fusion's figure. |
| IMP-16 | **Privacy**: participant name and DCN live only in memory. They are never written to storage, the URL, analytics, logs, error messages or Firestore. Reloading the page keeps the plan without them. |
| IMP-17 | **Care plan report** (1.3): text with `Care Plan Information <date> - <date>`, a `Task #Min/Day` heading or the month table's heading is read as the report. Participant: the name after `Participant Information:` and the first `DCN:` (else the page header). Plan dates from `Care Plan Information`. Each month table starts a service: its label and authorization come from the nearest service row above it (the label, then the last 10+ digit number on that line); its provider from the row's top line, only when that line ends at the comma before the phone number, which starts there or is on the bottom line (else null); its start and end from the month table; `monthly` from the month table, one entry per row; `units` the most common of those figures. The task table after it, up to the next service (page headers, footers and a repeated heading skipped), gives the rows: a trailing `N/A` (Comments) is dropped, then the row is read as in IMP-06/07; essential transportation has one number, its units a month (`Essential Transportation⇥40⇥N/A` → 40 units, 600 minutes); anything else is unread. Cells may be split by tabs (the PDF) or single spaces (copied from a PDF viewer). There is no paging, so a report is never "incomplete". The address, date of birth and phones are never read. |
| IMP-18 | **Visits by month**: a report service whose procedure code is a visit in the rule pack (T1001, for example GHE) is not in `services` (it isn't weekly hours). Each month row becomes a `visits` entry (label, code, the task row's name, provider, the month's start and end, units, PA), listed with the schedule in its month (APP-SPEC 5.8), with one `not-scheduled` note per label: "GHE (General Health Evaluation) is a nurse visit, so it's listed by month, not in the week." |
| IMP-19 | **Nothing read is dropped** (Oct 31, 2026, `docs/MISSOURI-COVERAGE-AUDIT.md`): on the care plan report, a block with an unknown label whose month table's code is not `T1019`, not a code another label uses, and not a code the rule pack schedules goes in `others` (label, code as printed, its 3.00 Appendix 1 service or null, provider, PA, dates, every month's units, its rows exactly as read), never in `services`. That is an Appendix 1 service Quick Schedule doesn't place yet (adult day care, home delivered meals, the RCF/ALF services, ILW case management, FMS, equipment, supplies and adaptations, structured family caregiving) or a code outside Appendix 1. One `kept` note per label and code says what it is and why it isn't in the week: "HDM (Home Delivered Meals, S5170) isn't scheduled: it's arranged by date, not placed in the week. It's kept with the plan." For a code outside Appendix 1: "XYZ (H2015) isn't one of DHSS's Appendix 1 services, so it isn't scheduled. It's kept with the plan for review." A code alone never names a service, and meals, months, costs and covered days are never 15-minute units. A label the person keeps (IMP-11) joins `others` with its rows. When something was read but none of it has tasks for the week, the issue is `nothing-to-schedule`, naming what was read, not `no-rows`. |

---

## 3. Output (`packages/import/src/types.ts`)

```ts
export interface ImportedTask {
  name: string;            // rule-pack name when matched, else the Fusion name
  fusionName: string;      // exactly as read
  taskCode: string | null; // null when not in the rule pack
  minPerDay: number;
  daysPerWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}
export interface ImportedService {
  label: string | null;          // "PC - CDS"; null when the paste had no group row
  serviceCode: ServiceCode | null;
  provider: string | null; phone: string | null;
  start: string | null; end: string | null;   // YYYY-MM-DD
  units: number;                 // Fusion's monthly units
  cost: string | null; pa: string | null;
  tasks: ImportedTask[];
  transport: { unitsPerMonth: number; minutesPerMonth: number } | null;
  unread: { raw: string; reason: "unreadable" | "task-numbers" | "transport-numbers" }[];
  monthly: { start: string; end: string; units: number }[] | null;  // care plan report (IMP-17)
}
export interface ImportedVisit {           // IMP-18
  label: string | null; serviceCode: ServiceCode; name: string | null; provider: string | null;
  start: string; end: string; units: number; pa: string | null;
}
export type ImportIssueCode =
  | "no-rows" | "incomplete" | "unknown-service" | "no-plan-dates" | "bad-dates"
  | "different-participant" | "unread-row" | "unknown-task" | "odd-minutes" | "duplicate-task"
  | "not-scheduled";
export interface ImportIssue { level: "error" | "input" | "warn"; code: ImportIssueCode; message: string;
  have?: number; total?: number; label?: string; name?: string; raw?: string; }
export interface ImportResult {
  participant: { name: string; dcn: string } | null;
  plan: { start: string; end: string } | null;
  totalCost: string | null;
  paging: { from: number; to: number; total: number }[];
  services: ImportedService[];
  visits: ImportedVisit[];      // IMP-18; [] from the care plan screen
  others: ImportedOther[];      // IMP-19; [] from the care plan screen
  issues: ImportIssue[];
}
export function parseFusionText(text: string, pack: RulePack): ImportResult;
export function mergeFusionText(texts: string[], pack: RulePack): ImportResult;
export function textItemsToLines(pages: PdfTextItem[][]): string;   // IMP-14, pure
export interface PdfTextItem { str: string; x: number; y: number; width: number; height: number; }
```

### 3.1 Issues and what the screen does

| Code | Level | Stops the build? | Screen |
|---|---|---|---|
| no-rows | error | yes | "We couldn't find care plan tasks in that text." + how to copy. From a PDF: "We couldn't find care plan tasks in that PDF." + "Open the participant's care plan PDF from Fusion, or copy the care plan from Fusion's screen and paste it above." |
| incomplete | error | yes, unless the person chooses "Build with the N rows I have" | "This copy has N of the plan's M rows." + paste the next page |
| different-participant | error | yes | "That page is for a different participant." |
| unknown-service | input | until a service is chosen for that label, or it is kept | service select, one per label, and "Keep it, don't schedule it" (IMP-19) |
| nothing-to-schedule | error | yes | "Nothing in this care plan goes in the week" + the authorizations read (IMP-19) |
| no-plan-dates | input | until dates are entered | two date fields |
| bad-dates | error | yes | "The plan dates don't look right." |
| plan-ended | error | yes | Set by the app, which knows today's date: the plan ended before this month. "This care plan has ended" + "This care plan ended on Jun 30, 2026. A schedule covers care still to come. Open the participant's current care plan in Fusion and paste it, or open its PDF." Dates the person entered keep the date fields open. |
| unread-row | error | no | listed in the read summary with the raw text |
| unknown-task | warn | no | listed in the read summary |
| odd-minutes | warn | no | listed in the read summary |
| duplicate-task | warn | no | the duplicate is dropped (same page pasted twice) |
| not-scheduled | warn | no | listed in the read summary; the visits are listed by month (IMP-18) |
| kept | warn | no | listed in the read summary; the authorization is listed under Other authorizations and printed (IMP-19) |
| plan-ended (one service) | warn | no | with several services, one whose authorization ended before this month is left out: "HC ended on Jun 30, 2026, so it isn't scheduled." |

---

## 4. From import to schedule (`fromFusion`)

| Field | Value |
|---|---|
| source | `"fusion"` (minutes and days are locked on screen) |
| which services | every service in the plan, each its own state, in Fusion's order (APP-SPEC 5.8) |
| serviceCode, plan, headerUnits | from the service and IMP-13; on the care plan report, the plan is the service's own authorization dates |
| tasks | every imported task, ids `qt-1…`, not pinned |
| care days | the first *d* days of Monday, Tuesday, … Sunday, where *d* is the largest days-per-week of any task (5 → Mon–Fri; 7 → every day), as in Scheduler Lite. A service after the first takes the *d* quietest days of the week built so far; one with only transportation, the quietest weekday (APP-SPEC 5.8) |
| monthly figures | from the care plan report, each month's authorized units (`fusion`, by month; two periods in one month add up), used instead of IMP-10's prorated header units for full months |
| schedule months | from this month (`fromMonth`, the month it was built) or the plan's first month, whichever is later, to the plan's end; the plan's own dates are kept as read |
| transportation | minutes per month from Fusion; usual day = the last care day in that order; weekly hint = `floor(floor(minutes/15) / 5) × 15` minutes |
| month shown | the current month if it's in the plan, else the plan's first month after it |

Then the schedule is built (APP-SPEC 5.3): composer → month fit (ENGINE-SPEC SCH-17) →
`validateSchedule`. An imported plan whose own numbers break a rule (for example Respite
over its ceiling) shows "This care plan itself breaks a Missouri rule" with the checks; the
editor never adds a rule break of its own (APP-SPEC 5.7).

---

## 5. Acceptance tests (`packages/import/test/`)

Read fixtures from `docs/fixtures/fusion/` with `node:fs`. Expected values are exact.
IMP-T01 to IMP-T15 and IMP-T19 to IMP-T24 live in `packages/import/test/`. IMP-T16 to IMP-T18
and IMP-T25 need the Quick Schedule model, so they live in `apps/web/test/quick/`.

| ID | Input | Expect |
|---|---|---|
| IMP-T01 | A (run-together) | participant `SAMPLE PARTICIPANT A` / `10000001`; plan 2025-08-01–2026-06-30; service `PC - CDS` → T1019U2, 466 units, PA `20250000000001`; 15 tasks (Bathing 45×5 … Wash Dishes 20×5, "Essential Correspond" read as Essential Correspondence); transport 51 units / 765 min; no issues |
| IMP-T02 | B (tab-separated) | 15 tasks incl. Asst. with Toileting → Assistance with Toileting 10×7 and Laundry (Off Site) 140×1; transport 23 / 345; no issues |
| IMP-T03 | C (rows only) | no group row; units 402 from rows; serviceCode T1019U2; 14 tasks; transport 30 / 450; plan from banner; no issues |
| IMP-T04 | D (page 1 only) | `incomplete` with have 10, total 14 |
| IMP-T05 | B-page1 then B-page2 via mergeFusionText | 15 tasks, transport 23 / 345, no issues |
| IMP-T06 | B-page1 alone; B-page2 alone | each `incomplete` (have 10 / total 16; have 6 / total 16) |
| IMP-T07 | A with `\r\n` and no-break spaces; B with tabs → 2 spaces; B with tabs → ` \| ` | same tasks and transport as A / B |
| IMP-T08 | `455 units Bathing 45 7\n455 units Medications 5 7\n455 units Essential Transportation 23 345` | 2 tasks; transport 345 |
| IMP-T09 | `300 units Bathing458 300 units Trash53` | Trash 5×3 read; Bathing row `unread-row` (days 8) |
| IMP-T10 | `300 units⇥Pet Care⇥15⇥7` | task kept with taskCode null; `unknown-task` |
| IMP-T11 | `300 units⇥Bathing⇥17⇥5` | `odd-minutes` |
| IMP-T12 | any text with no rows | `no-rows` |
| IMP-T13 | a group row labelled `XX - ABC` | `unknown-service`, serviceCode null |
| IMP-T14 | `fusion-table-with-banner.pdf` through pdfjs-dist + textItemsToLines | same as IMP-T02 |
| IMP-T15 | `fusion-table-only.pdf` | 15 tasks, transport 345, participant null, `no-plan-dates` |
| IMP-T16 | checksum (with the engine): A → match at 466; B → match at 455 (30-day), 469 for 31 days, 434 for 28; C → no match (374 / 391 / 401 vs 402) | as stated |
| IMP-T17 | B through fromFusion + build on Nov 20, 2025 (before its plan, Dec 2025–Oct 2026, starts) | each month's figure is 455 prorated: 469 for 31 days, 455 for 30, 434 for 28 (February); no trims, no AUTH-07, zero BLOCK. With the figure at 440 (rows don't add up): never above 440, February 419; every month but February and April cut exactly to its figure at the end (SCH-17), AUTH-07 in every month. (Before Oct 25, 2026, 455 applied to every month and three 31-day month ends were trimmed.) |
| IMP-T18 | A through fromFusion + build | care days Mon–Fri; transport day Friday, weekly hint 150; day totals Mon..Fri 290, 285, 275, 270, 195; zero BLOCK, zero REVIEW |
| IMP-T19 | privacy | no exported function writes to storage or the console (spy on `console.*`, `localStorage`, `sessionStorage` during all tests) |
| IMP-T20 | E (care plan report text) | participant `SAMPLE PARTICIPANT E` / `10000005`; plan 2026-04-01–2027-01-31; one service `PC - Agency` → T1019, provider `TEST HOME CARE LLC`, PA `20260000000005`, units 229, `monthly` 10 rows of 229; 13 tasks with the rule pack's names ("Med Rel HC Tasks:" dropped; Laundry, Shopping/Errands, Self-Admin of Medications); issues: one `not-scheduled` note for GHE; no address, date of birth or phone in the result |
| IMP-T21 | `fusion-care-plan-report.pdf` through pdfjs-dist + textItemsToLines | the text of E, and the same result as IMP-T20 |
| IMP-T22 | E with June's figure changed to 200 | June's `monthly` entry 200, July's 229; `units` 229 |
| IMP-T23 | E with every tab replaced by one space | same service, months, tasks and issues as IMP-T20 |
| IMP-T24 | report rows | `Toileting⇥N/A` unread (raw kept); label `XX - Other` → `unknown-service`; a task table split by a page footer and header still reads every row; a second paste with another DCN → `different-participant` |
| IMP-T25 | E through fromFusion + build (`apps/web/test/quick/`) | service T1019; `fusion` holds 229 for each of the 10 months and the model checks each month against it; checksum `{ "30": 229, "31": 229 }` matches 229; zero BLOCK. With June at 200, June's authorized units are 200 |
| IMP-T26 | F (a care plan report with several authorizations, made-up identifiers in a real report's layout) | services PC - Agency T1019 226 (8 tasks, household tasks under it), PC - CDS T1019U2 40 (transport 40 units / 600 min, no tasks), HC S5130 5 (Wash Windows/Blinds 15 × 1), each with 9 months and its PA; `visits` two GHEs (May and Aug 2026); the provider on every block, including one whose phone is on the bottom line; issues only the GHE note |
| IMP-T27 | E | both GHEs listed as visits, in the report's order |
| IMP-T28 | F with HC relabelled `HMK`, or PC - CDS relabelled | `HMK` named S5130 by its code; a label whose code is T1019 still asks (`unknown-service`) |
| IMP-T29 | F pasted in two parts | the same services and visits as one paste |
| IMP-T30 | G (made up, in F's layout: PC - CDS plus HDM S5170, ADC S5100HC, FMS T2040U6, RN T1001U3 and XYZ H2015) | one service, PC - CDS T1019U2; `others` the five in order with their Appendix 1 services (the last none), months, units, PA and rows as read; five `kept` notes and nothing to resolve; pasted in parts, each kept once |
| IMP-T31 | G | XYZ H2015 kept verbatim (INV-03); a label whose code is T1019 still asks (INV-04) |
| IMP-T32 | G with only its kept blocks | `nothing-to-schedule` naming HDM, ADC, FMS, RN, XYZ |
| IMP-T33 | `docs/All Schedules/CarePlan_Official_Tasks_3a_3c.csv` | INV-02: all 51 rows (7 basic PC including the MED REL HC TASKS control row, 11 homemaker, 7 APC, 25 CDS/ILW tasks, transportation) match a task of their section's service; the control row is not a task, and its children match under the "Med Rel HC Tasks:" prefix |

---

## 6. Still needed from a real Fusion account

These don't block building; each becomes a fixture and a test when it arrives.
1. **A real export of the care plan screen's table** (Export → PDF), if Fusion has one. The
   first real Fusion PDF (Oct 2026) was the care plan report (1.3), now read by IMP-17; the
   table PDFs are still look-alikes.
2. **More service labels.** Seen so far: `PC - CDS`, `PC - Agency`, `HC` (homemaker), and
   `GHE` (a nurse visit, IMP-18). A plan with State Plan and ILW, or Respite, adds more to IMP-11.
3. ~~A care plan report for CDS~~. Seen Oct 2026 (fixture F's layout): its month table shows
   procedure code T1019, not T1019U2, so the label names it (IMP-11); essential transportation
   is one row with its units a month (IMP-17).
4. ~~DHSS answer on 31-day months~~ (1.2). Answered by the Fusion FAQ: Fusion prorates by the
   days in each month, and IMP-10 now does too (Oct 25, 2026). A question to DSDS on what to do
   when a month's units run out anyway is in `docs/DSDS-QUESTIONS.md`.
