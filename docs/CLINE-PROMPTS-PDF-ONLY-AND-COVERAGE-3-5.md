# CarePlan Scheduler: Cline prompts for PDF-only import and Coverage Phases 3, 4 and 5

Nov 13, 2026. Everything Cline needs to finish the Missouri coverage plan in
`docs/MISSOURI-COVERAGE-AUDIT.md`, plus the owner's Nov 13 decision to take the paste feature out.
Coverage Phase 2 already has its prompts in `docs/COVERAGE-PHASE-2-CLINE-PROMPT.md` (CP2-1 to
CP2-8); this file does not repeat them. Nothing here is deployed until the owner merges.

**Read this header before pasting anything.**

## 0. Decisions this file carries

1. **Paste is removed; the care plan PDF is the only way in (Nov 13, 2026).** Quick Schedule reads
   the PDF the owner downloads from Fusion, in the browser, and nothing is uploaded. "Build a
   schedule by hand" and the two examples stay. This replaces the Oct 2026 requirement that
   Fusion copy-and-paste must work. The parser in `packages/import` still reads text (that is
   what the PDF reader hands it), so its text fixtures and tests stay.
2. **The schedule leaves the app as a PDF only.** "Save as PDF" and "Print schedule" (the same
   one PDF, APP-SPEC 5.4) stay. There is no CSV or XLSX export. This changes the audit's
   EXPORT-01 from "PDF, print, CSV, XLSX agree" to "screen, PDF and print agree" (CP5-1).
3. Everything else in the audit stands: Phases 2 to 5 as written there, PR #10's two
   clarifications, the Oct 29 decision that the worksheet tab, print, export and the old
   `/conformance` stay gone (keep only the state-parity engine math and tests), and the goal that
   the State of Missouri adopts the app. Anything the State has not confirmed stays `REVIEW`.
4. Design choices in these prompts are marked **(design)**. Cline follows them. If one cannot be
   built as written because the code says otherwise, stop and report; do not improvise a
   different design.

## 0a. Corrections after reading `main` (Nov 13, 2026, at `47eaa2e`)

These were found when the prompts were first run against the repository. Where a correction and
a prompt below disagree, the correction wins.

1. **Coverage Phase 2 is mostly merged.** CP2-1 to CP2-6 and CP2-8 are on `main` (PR #12 carried
   the last of them). Only **CP2-7** (the amendment model) is left, so Group 2 is CP2-7 alone. The
   old `coverage-phase-2` branch is merged history; CP2-7 goes on `coverage-phase-2-amendments`.
2. **Two different things are called "Phase 3".** `docs/PHASE-3-SPEC.md` and
   `docs/PHASE-3-CLINE-PROMPTS.md` are the agency track (BAA, App Check, audit log and MFA, saved
   participants, billing). "Coverage Phase 3" in this file is the participant calendar. They do
   not depend on each other, except for CP4-9 below.
3. **CP4-9's gate is narrower than "BAA decision made".** The customer BAA and its owner-only
   acceptance are merged (PR #13, PHASE-3-SPEC P3-03). What is still open is the Google Cloud BAA
   (PHASE-3-SPEC section 1) and P3-08 (name and DCN in storage), both the owner's. CP4-9 stays
   gated on them. When it is built it uses PHASE-3-SPEC's `tenants/{t}/participants/{pid}` path
   and its rule that nothing is written before `baaVersion` exists; it does not design a second
   participants collection.
4. **`.clinerules` rule 19 names `cps.quick.v2`; the key in use is `cps.quick.v3`** (v2 still
   loads). PDF-2 corrects the rule text while it is editing `.clinerules`.
5. **Branches are stacked when the previous pull request is not merged yet.** The owner merges.
   A group's branch is cut from the previous group's branch, and its pull request says so.
6. One test (`carePlan.test.ts`, "a service that ended earlier") failed only on a Windows checkout
   (the fixture comes out with CRLF line endings). Its pattern now reads either ending.
7. **Later on Nov 13: Phase 4 split in two.** PR #17 merged `coverage-phase-4` (CP4-1 to CP4-5,
   so also everything in #14, #15 and #16) into `main`. CP4-6 to CP4-8 are on
   `coverage-phase-4-checks`, cut from that `main`. PRs #15 and #16 are left open but add
   nothing `main` lacks.
8. **CON-05 isn't on the schedule yet, on purpose.** CP4-3 left it out because its workweek
   start is the agency's tenant setting, and running it on public pages pulled luxon into
   their bundle (APP-SPEC 5.3 step 9). It arrives with CP4-9. **If CP4-9 is skipped**, CON-05
   must still run in Quick Schedule, on one participant's visits, in the lazy extras chunk,
   with a workweek start the person enters (no default, since an FLSA workweek is the
   employer's to fix). Record that in APP-SPEC 5.3 step 9, so a skipped CP4-9 never drops the
   40-hour check silently.

## 1. Order and branches

Run the prompts one at a time, in this order. Start the next only after the "Finish" list of the
current one passes. Each group below is one branch and one pull request, cut from `main` after
the previous group is merged. Never commit to `main`, never `--force`.

| Order | Branch | Prompts | What it delivers |
|---|---|---|---|
| 1 | `pdf-only-import` | PDF-1, PDF-2 | Paste removed; PDF is the only way in |
| 2 | `coverage-phase-2` | CP2-1 to CP2-8 (existing file) | Chore, household rows, respite, ADC and meals calculators, RCF/ALF, global IDs, amendment model, regression |
| 3 | `coverage-phase-3` | CP3-1 to CP3-8 | Dated events and the participant calendar |
| 4 | `coverage-phase-4` | CP4-1 to CP4-9 | Clock times, caregivers, restrictions |
| 5 | `coverage-phase-5` | CP5-1 to CP5-5 | PDF parity, completeness display, release gate |

CP4-9 is gated on an owner decision (see its header). Everything else runs without waiting.

## 2. Read first, every prompt, in this order

`.clinerules`; `docs/MISSOURI-COVERAGE-AUDIT.md` sections 5, 7, 8 and 9; `docs/ENGINE-SPEC.md`;
`docs/IMPORT-SPEC.md`; `docs/APP-SPEC.md` sections 4.3, 5.7 and 5.8; the fixtures in
`docs/fixtures/fusion/` and `docs/fixtures/state/`. The prompt then names what else to read.

## 3. Rules for every prompt (these restate `.clinerules`; they are not optional)

- **Tests first, then a mutation check.** For each behavior, write the failing test, make it
  pass, then break the behavior on purpose once and confirm a test fails. Name the mutation and the
  test that caught it in the commit body.
- **Never fabricate a BLOCK or a PASS.** A rule whose authority is not settled emits `REVIEW` with
  its source and the open question. Evidence items (audit section 9) stay `REVIEW`; do not pick a
  value.
- **Never turn a non-hourly service into 15-minute units.** Meals stay meals, days stay days,
  visits stay visits, monthly and cost authorizations stay as kept records.
- **Never overwrite an imported Fusion figure.** Derived values are `source: "derived"` with a
  `method` (engine rule 9).
- **Nothing silently dropped.** Every authorization read is scheduled, placed by date, or kept and
  shown. Unknown stays visible.
- **No "compliant" or "approved" wording** anywhere while a `REVIEW` stands. The status keeps
  reading "Ready to use" and lists what needs review.
- **Every change a person makes goes through the guard** (APP-SPEC 5.7, rule 19a). A placement that
  would break a BLOCK rule is refused with the limit shown, never accepted and flagged later.
- **Privacy:** participant name and DCN never reach storage, the URL, the console or Firestore
  (IMP-16). Caregiver names are memory-only, treated exactly like the participant's name: kept
  in React state, never written to `sessionStorage`, Firestore, the URL or logs. No real care plan
  or real name in code, tests, fixtures, docs or commit messages (I-2). Test data is made up
  (`P-TEST-01`, "Caregiver A").
- **Storage is additive.** New fields are optional. A plan saved by the live version must still
  open (`persistence.ts` validates new fields the way it validates `others`). Plans stay under
  `cps.quick.v3` in `sessionStorage`; do not add `localStorage` or Firestore writes for Quick
  Schedule.
- **Bundle:** `/quick` is at 169.0 KB gzip of its 180 KB budget. Heavy new views (the calendar,
  the caregiver board, the PDF pages) load with `import()` in their own chunk. `check-bundle.mjs`
  must pass and public pages must not import Firebase.
- **A new engine rule needs all of:** a function named after its ID with JSDoc `@rule` and
  `@source`; a `RULE_CATALOG` entry; a `RULE_COPY` entry for every severity it can emit
  (`ruleCopy.ts`; a test enforces this); a row in `docs/RULE-MAP.md`; a row in `docs/ENGINE-SPEC.md`
  section 5 (a test, AC-22, compares the catalog with that section); and a test. Before using a
  rule ID below, check it is free; if it exists, stop and report. When a prompt adds a rule, it
  authorizes editing `RULE-MAP.md` and `ENGINE-SPEC.md` section 5 for that rule only.
- New user-facing copy follows APP-SPEC 4.3 (sentence case, plain words, buttons say what happens,
  errors say how to fix it). Add the new copy to the APP-SPEC section the prompt names; the prompt
  authorizes that edit and no other spec edit.
- Colors, fonts and radii come only from `tokens.css` through the Tailwind token names; no green;
  the "Signature blue" scheme stays. Accessibility is part of done: labels, keyboard paths, visible
  focus, `aria-live` where the spec says, axe zero violations, 390 x 844 with no horizontal scroll.
- Integer-minute arithmetic only. Files under 300 lines, one concept per file, no `any`, no default
  exports, no `TODO` or stubs, no `console.log`.
- Do not edit `firestore.rules`, `docs/design/tokens.css`, `docs/fixtures/` or any spec unless the
  prompt says so. If one looks wrong, stop and report.

**Standard finish** (every prompt's "Finish" means all of these, with the summary lines pasted in
the final message): `npm run typecheck`; `npm test`; `npm run build` (this runs
`scripts/check-bundle.mjs`); and, when any UI changed, `npm run test:e2e -w @careplan/web`. When a
prompt touches `firestore.rules`, also `npm run test:rules -w @careplan/web`.

---

# Group 1: PDF-only import (branch `pdf-only-import`)

## Prompt PDF-1: Remove the paste box; the care plan PDF is the only way in

Read first: the header above; `docs/APP-SPEC.md` D-13, 5.1, 5.2 (QS-12), 4.2 (Textarea) and 5.6;
`docs/IMPORT-SPEC.md` IMP-12 to IMP-14 and section 3.1; `apps/web/src/features/import/`
(`ImportPanel.tsx`, `ImportIssues.tsx`, `readPdf.ts`, `importFlow.ts`, `ReadSummary.tsx`);
`apps/web/src/ui/Textarea.tsx`, `apps/web/src/ui/FileDrop.tsx`;
`apps/web/src/features/quick-schedule/QuickSchedule.tsx`; `apps/web/src/pages/Landing.tsx`,
`Privacy.tsx`.

Build (app only; `packages/import` and `packages/engine` are not changed):
- `ImportPanel.tsx`: remove the textarea, the "Build schedule" button, the three paste steps,
  `PASTE_BOX_ID`, `PASTE_FIRST`, the page counter and the `"paste"` import source. The panel
  becomes: `h2` "Open the care plan PDF from Fusion"; numbered steps "In Fusion, open the
  participant's care plan." / "Download it as a PDF." / "Choose the PDF here or drop it on the box.";
  the `FileDrop` (title "Choose the PDF", "or drop it here"); "The PDF is read on this computer. It
  isn't uploaded."; the two examples ("5-day plan", "7-day plan"); and "No care plan handy? Build a
  schedule by hand". Keep the panel's two-column layout at 860 px and up: PDF on the left, examples
  and by hand on the right.
- Focus: after "New care plan" focus goes to the PDF chooser. Replace `PASTE_BOX_ID` with an id on
  the chooser (give `FileDrop` an `id` prop if it lacks one) and update `QuickSchedule.tsx`.
- `readPdf.ts` and `ImportPanel.tsx` messages lose every mention of pasting: no readable text →
  "It may be a scan or a photo. Download the care plan PDF from Fusion again."; can't read →
  "Check that it's the care plan PDF from Fusion and not password-protected."; reader unavailable →
  "Check your internet connection and try again."
- `ImportIssues.tsx`: remove the `"paste"` value of `ImportSource` (leave `"pdf"` or drop the type
  if nothing needs it). Reword every issue that says copy or paste: no care plan found → "We
  couldn't find care plan tasks in that PDF." with "Open the participant's care plan PDF from
  Fusion."; incomplete → "This PDF has N of the plan's M rows." with "Open the PDF that has every
  page of the care plan, or build with the N rows we have."; the next-page issue → "Open the PDF
  with the rest of the pages, or build with the rows we have." A second PDF chosen after an
  incomplete one is still added to the first (IMP-12 stays; `importFlow.ts` is unchanged apart
  from its comment). The IMPORT-SPEC 3.1 issue codes and severities do not change.
- `Textarea.tsx`: remove `onPasteText` and the `insertFromPaste` handling (only `ImportPanel` used
  it); keep the component, which the dev gallery and other forms use.
- Page copy: `QuickSchedule.tsx` intro → "Open a care plan PDF from Fusion. You get a ready schedule
  that follows Missouri's rules, and you can change it within them."; the notice → "Nothing you
  open is uploaded or saved to our servers. It stays in this browser tab, and the participant's
  name and DCN are gone when you close it."; `ReadSummary.tsx` example line → "This is what a Fusion
  plan looks like. Open a PDF above to make your own."; `Landing.tsx` headline → "Open a Fusion care
  plan PDF. Get a schedule that follows Missouri's rules." with small line "Quick Schedule needs
  no account. Nothing you open is uploaded.", and the feature that read "Paste a care plan or open
  its PDF" → lead "Open the care plan PDF." detail "Fusion's care plan PDFs are read in your
  browser, every page, and the plan stays on your computer."; `Privacy.tsx` → "reads the care plan
  PDF you open, on your computer. Nothing you open is uploaded."
- Search `apps/web/src` for the word "paste" (case-insensitive) and for "copy it": fix every
  user-facing string and every comment that is now false. The search must come back empty except
  where the word is about the clipboard in `features/agency/clipboard.ts` (invite links), which is
  unrelated and stays.
- Tests: the unit and component tests that pasted text (`ui-import.test.tsx`, `ui-page.test.tsx`,
  `ui-plan.test.tsx`, `ui-schedule.test.tsx`, `ui-kept.test.tsx`, `ui-whole-plan.test.tsx`,
  `ui-print.test.tsx`, `ui.test.tsx`, `pages.test.tsx`, `router.test.tsx`) switch to a helper in
  `test/quick/ui-helpers.tsx`, `openCarePlanText(text)`, that mocks `readPdf` to return
  `{ kind: "text", text }` and fires the chooser's file input with a file named `care-plan.pdf`.
  The text fixtures A to G stay as they are; they keep testing the parser and now reach the UI
  through the same door a PDF uses. Add tests: there is no textarea and no "Build schedule" button
  on the import panel; every error string above appears for its case; a second PDF after an
  incomplete one builds the plan (the old two-page paste case, IMP-T29); a text file or a
  non-care-plan PDF shows "That isn't a PDF" / "We couldn't find care plan tasks in that PDF."
- Mutation checks: put the textarea back and confirm the "no textarea" test fails; reword one
  error back to "paste" and confirm the copy test fails.

Finish: standard finish, plus the `/quick` chunk size line from `check-bundle.mjs` (it should not
grow). Commit on `pdf-only-import`: `feat(web): care plan PDF is the only way in; remove paste import`.

## Prompt PDF-2: Browser tests, specs and rules follow the PDF-only decision

Read first: `apps/web/e2e/public/helpers.ts`, `quick-schedule.spec.ts`, `a11y.spec.ts`,
`phone.spec.ts`; `docs/fixtures/fusion/` (the three PDFs, `make-care-plan-report.py`);
`docs/APP-SPEC.md` (acceptance AC-01 to AC-30, landing and privacy sections); `docs/IMPORT-SPEC.md`.

This prompt authorizes editing `.clinerules`, `docs/APP-SPEC.md` and `docs/IMPORT-SPEC.md`, only
for the changes listed here. It also authorizes adding files under `apps/web/e2e/public/`.

Build:
- `helpers.ts`: delete `pasteCarePlan`. Add `openCarePlan(page, pdfPath)` that sets the PDF on the
  chooser's file input. Scenarios that used a text fixture use the closest real PDF fixture:
  `fusion-table-with-banner.pdf` (care plan screen, AC-08), `fusion-table-only.pdf`,
  `fusion-care-plan-report.pdf` (AC-24, fixture E). A scenario that needs a PDF no fixture gives (an
  incomplete plan, a plan in two PDFs, text with no care plan in it) builds the PDF inside the test
  with `pdf-lib` from the text fixture: one line per fixture line at a fixed y, each tab-separated
  cell at its own x. Add a unit test proving `readPdf` on such a PDF returns text that `parseFusionText`
  reads to the same result as the fixture text (IMP-T tests). If that round trip cannot be made to
  match for a fixture, stop and report which one; do not weaken the fixture or the expected values.
- `quick-schedule.spec.ts`, `a11y.spec.ts`, `phone.spec.ts`: replace every paste step and every
  "Paste the care plan from Fusion" heading check with the PDF equivalents ("Open the care plan
  PDF from Fusion"). Layout checks that measured the paste box measure the PDF chooser.
- `docs/APP-SPEC.md`: intro and D-13 ("Import is the front door: Quick Schedule opens on "Open the
  care plan PDF from Fusion"; building by hand is the fallback"); "Two ways in" (PDF, by hand);
  5.1 page intro and import panel (as built in PDF-1); the Textarea row in 4.2 (no `onPasteText`);
  QS-12 ("as if opened from a PDF"); the example line; the privacy notice; AC-02, AC-06, AC-07 and
  AC-09 (opening PDFs, the second PDF, a PDF with no care plan in it); the performance line that
  says "a pasted plan"; the landing headline, small line, feature list and the privacy page text.
  Add a dated note "Nov 13, 2026: paste removed, PDF only" to D-13.
- `docs/IMPORT-SPEC.md`: the opening description, the line about real plans (it says pastes: say
  the text came from Fusion screens and PDFs), the "two pages pasted" row, IMP-12 ("several
  files of the same plan"), the issue-copy rows in 3.1 (same strings as PDF-1), and the test names
  that say paste. Add one note: input is the text of the care plan PDF; the parser reads text and
  its text fixtures A to G are parser fixtures.
- `.clinerules`: the `packages/import` bullet reads "reads Fusion care plans (the text of the care
  plan PDF)"; App rule 19 and the Quick Schedule storage rule are unchanged.
- Do not touch the older prompt files (`PHASE-1-*`, `PHASE-2-*`, `All Schedules/`); they are
  history.

Tests: the full Playwright public suite passes on desktop and phone; AC-14 (no Firebase and no
pdf.js on `/`, `/quick`, `/rules` until a PDF is chosen) and AC-15 (privacy: nothing in storage
or the console) still pass with a PDF opened. Mutation: make the chooser's file input accept a
text file and confirm the "not a PDF" e2e fails.

Finish: standard finish with e2e. Commit: `test(web): e2e and specs follow PDF-only import`.

---

# Group 2: Coverage Phase 2 (branch `coverage-phase-2`)

Run `docs/COVERAGE-PHASE-2-CLINE-PROMPT.md` in full, CP2-1 to CP2-8, after PDF-2 is merged. Two
notes for that file now that paste is gone: CP2-6's "source page and line" is read from the PDF's
own pages (the reader already returns text page by page), and its "expandable raw view" appears
in the read summary for a PDF-read plan. Nothing else in it changes.

---

# Group 3: Coverage Phase 3, the participant calendar with dated events (branch `coverage-phase-3`)

Base: `main` after Phase 2 is merged. Goal: the services Phase 1 kept (nurse visits, adult day
care, meals, structured family caregiving, ILW context items) get dates on one participant
calendar, and the weekly pattern and the dated events show together. The model Phase 2 built
(global IDs, the effective-dated amendment chain) is what these prompts build on.

## Prompt CP3-1: Dated events in the engine (design)

Read first: `packages/engine/src/types.ts` (`Visit`, `CalendarException`); `calendar/expand.ts`,
`calendar/time.ts`; `rules/conflicts.ts` (`ruleCON10NurseVisits`); `rules/sch.ts`
(`ruleSCH14VisitDates`); `rulepacks/appendix1.ts`; the CP2-4 calculators in `stateparity/`.

Build in `packages/engine/src/events/` (pure, no I/O; dates `YYYY-MM-DD`, local times
`YYYY-MM-DDTHH:mm` in America/Chicago converted only in `calendar/time.ts`):
- `PlanEvent`: `id` (UUID), `authorizationId` (the global authorization UUID from CP2-6),
  `kind` (`NURSE_VISIT` | `ADC_DAY` | `MEAL_DELIVERY` | `SFC_DAY` | `REMINDER`), `date`, optional
  `start` and `end`, `quantity` (visits = 1, meals = count, ADC = minutes in 15-minute steps, SFC
  day = 1), `note` (the person's own text, never required), `billable: false` for every
  `REMINDER` and `true` for the rest. Events carry no name or DCN.
- `eventBalance(authorization, events, month)`: authorized, placed, left, in the service's own
  unit (visits, meals, days, minutes), never converted to 15-minute units except ADC attendance,
  which is already minutes.
- `placeEvent(input)`: returns `{ accepted: boolean, results: ValidationResult[] }`. It refuses
  (BLOCK) an event whose date is outside its authorization's period or month, that would exceed the
  authorized quantity for the month, or that breaks a cap (below). Caps come from calling existing
  rules: nurse visits `ruleCON10NurseVisits` (1 a day, 26 in six months); ADC and meals the CP2-4
  calculators (ADC at most 40 units a day, 5 days a week, transport 120 minutes or less a day;
  meals 2 a day). Do not copy a cap into a new constant.
- New rules (IDs checked free first): `EVT-01` event date inside the authorized period (BLOCK, source
  the authorization's own dates); `EVT-02` events never exceed the authorized quantity in a month
  (BLOCK; Fusion's authorized count controls); `EVT-03` an authorization class `CONTEXT` never
  produces a caregiver shift or a billable event (BLOCK on attempt; source: audit section 10
  decision 2 and Appendix 1).
- Export `PlanEvent` and the functions from `packages/engine/src/index.ts`.

Tests: placing within the month is accepted; outside the authorized period is refused (EVT-01);
placing more than authorized is refused (EVT-02); a nurse visit on a day that already has one is
refused through CON-10; a 27th visit in six months is refused; ADC at 41 units in a day and a 6th
day in a week are refused; 3 meals in a day is refused; a billable event on a CONTEXT
authorization is refused (EVT-03); balances are in the service's own unit. Mutation: lift the
per-month quantity check and confirm EVT-02's test fails.

Finish: standard finish. Commit on `coverage-phase-3`: `feat(engine): dated plan events, balances and EVT rules`.

## Prompt CP3-2: Nurse visits and general health evaluations on dates

Read first: audit section 5.1 (`MO_RN_AGENCY`, `MO_RN_RCF`), section 7 Phase 3, acceptance RN-01 to
RN-04; `PlanVisit` in `apps/web/src/features/quick-schedule/types.ts`; fixture F (GHE in May and
August); the code that lists "Nurse visits by month" (`PlanOverview.tsx`, `grouping.ts`).

Build:
- `CarePlan.events?: PlanEvent[]` (optional, additive; `persistence.ts` validates it like `others`).
  State reducer actions `placeEvent`, `moveEvent`, `removeEvent`, all through the guard (5.7): a
  refused placement shows the limit and changes nothing.
- On each authorized nurse visit (a `PlanVisit`, one per authorized month for a GHE), a "Pick a
  date" control: a native date input limited to that authorization's month. Picking a date places
  one `NURSE_VISIT` event; the list "Nurse visits by month" shows the date beside the month, or
  "No date yet". The app never creates a visit Fusion did not authorize and never places one by
  itself.
- A general health evaluation done at a regular nurse visit is one visit: when a GHE is placed on a
  date that already holds another authorized nurse visit, the two are shown as one visit on that
  date and count once against the one-a-day limit (audit section 7 Phase 3).
- Missed-evaluation follow-up (`NUR-02`, WARN, source: audit RN-04; the follow-up wording is a
  product decision, labeled so): a past authorized month with no placed date shows "No date was
  placed for this month's visit." with the action to place one. It says nothing about whether the
  visit happened; the app schedules, it does not record delivery.
- Evaluation upload reminder: for a placed GHE, add a non-billable `REMINDER` event on the 15th of
  the next month, labeled "Upload the evaluation (HCBS 08-26-01)". It is a reminder, never a visit,
  and does not count toward any visit limit.
- RCF/ALF, CDS, ILW, ADW, ADCW and SFC-only plans get no GHE months derived: only months Fusion
  authorized are shown (RN-01). Nothing is derived.
- APP-SPEC 5.8: add a short "Nurse visits on dates" paragraph (authorized to edit that section only).

Tests: RN-01 to RN-04 as the matrix words them; fixture F's May and August visits can each be
dated within their month and not outside it; two visits on one date are refused; the GHE-at-a-
regular-visit pair counts once; the reminder lands on the 15th of the next month, is non-billable
and is not counted as a visit; a past unplaced month raises `NUR-02` and a placed one does not.
Mutation: count the reminder as a visit and confirm the limit test fails.

Finish: standard finish with e2e (fixture F end to end). Commit: `feat(web): place nurse visits on dates, GHE follow-up and upload reminder (RN-01 to RN-04)`.

## Prompt CP3-3: Advanced personal care nursing triggers (REVIEW until DHSS answers)

Read first: audit section 7 Phase 3 and the Appendix "Phase 3 additions"; `docs/DSDS-QUESTIONS.md`
(the APC first-month visits question is already in the list for DHSS); `MO_APC_AGENCY` in
`appendix1.ts`.

Build:
- For an Advanced Personal Care authorization (T1019TF, identified by its code, as today), when
  its first month is in the plan, emit `NUR-01` as `REVIEW` (never BLOCK or PASS): "A new Advanced
  Personal Care authorization is expected to have two nurse visits in its first month unless an
  ongoing nurse visit covers it. Check the care plan." Source: Appendix 3 as reviewed Oct 31,
  2026. State the open question: DHSS has not confirmed the first-month visit count.
- The app offers "Pick a date" for a nurse visit only when Fusion authorized one. If none is
  authorized, it says so and creates nothing.
- A nurse visit less often than weekly is entered as days a month, not days a week (the visit and
  the calendar use dated events, so this needs no new input). A GHE is for the semiannual visit
  only.
- Do not link an APC authorization to a "monthly RN evaluation" visit automatically; show the
  evaluation as a reminder only if the care plan lists one.

Tests: an APC plan emits `NUR-01` REVIEW in its first month and nothing in later months; no event is
created; the check never reads as passing (`status.ts` keeps "Needs review"); a plan with an ongoing
authorized nurse visit shows the visit and still shows REVIEW. Mutation: make `NUR-01` emit INFO and
confirm the "never passing" test fails.

Finish: standard finish. Commit: `feat(engine): APC first-month nurse visit review (NUR-01)`.

## Prompt CP3-4: Adult day care, home delivered meals and structured family caregiving on dates

Read first: audit sections 5.1 and 7 Phase 3, acceptance ADW-03, ADW-04, SFC-01; CP2-4's
calculators; `others.ts` (these authorizations are `PlanOther` today).

Build:
- A kept authorization whose Appendix 1 class is `APPOINTMENT` (ADC `S5100HC`/`S5100HB`, meals
  `S5170`, structured family caregiver `S5126HB`) gets a "Place on the calendar" control in the
  Other authorizations panel. It stays in `others`; the events reference it by its UUID.
- **ADC:** the person picks a date and a number of minutes (15-minute steps). The caps come from
  `placeEvent`. Transportation minutes within the day are a separate entry that counts toward the
  120-minute transport cap. Never turned into caregiver time.
- **Meals:** the person picks a date and a meal count (2 or fewer a day). Counted as meals.
- **Structured family caregiver:** the person marks covered days. One day is a day, never 96 units.
  Show "N covered days of M authorized" for the month. Primary and backup caregiver tracking is
  CP4-2; here only the days.
- Each service shows its own balance in its own unit ("62 meals a month, 10 placed, 52 left").
  Over-authorization is refused by `placeEvent` (EVT-02).
- Replace the panel's reason line for these services: "Arranged by date" stays, with the count of
  placed dates.
- APP-SPEC 5.8: add "Services arranged by date" (authorized to edit that section only).

Tests: ADW-03 and ADW-04 on the calendar path; 5 ADC days is accepted and a 6th in a week is
refused; 2 meals accepted, 3 refused; SFC days never produce units (INV-01 test stays green);
balances in own unit; a plan with no events reads as before. Mutation: let ADC minutes above 600 a
day through and confirm the cap test fails.

Finish: standard finish with e2e. Commit: `feat(web): place ADC days, meal deliveries and SFC covered days on dates`.

## Prompt CP3-5: Context items as optional reminders, never shifts

Read first: audit section 7 Phase 3 (context bullets), section 5.1 classes `CONTEXT`; `EVT-03` from CP3-1.

Build:
- ILW case management (`T2024U6`) may have a dated reminder only if the person adds one ("appointment
  only if specified"). ILW equipment, supplies and environmental adaptations (`T2029U6`, `T2028U6`,
  `S5165U6`) may have a dated reminder the same way. ILW financial management (`T2040U6`) has none:
  it is authorization context only and shows its authorization, nothing to place.
- A reminder is a `REMINDER` event: non-billable, no quantity, never a caregiver shift, never in
  any unit total. It is shown on the calendar with a different mark from visits, and listed in the
  printout's legend as "Reminder, not a visit".
- Costs: the scheduler holds none; do not add cost fields.

Tests: a reminder on a CONTEXT authorization is accepted and counts toward nothing; any billable
or shift-producing event on one is refused (EVT-03); financial management offers no control.
Mutation: let a reminder add to a day's minutes and confirm the totals test fails.

Finish: standard finish. Commit: `feat(web): optional reminders for ILW context authorizations`.

## Prompt CP3-6: Care plan amendments, forward only (builds on CP2-7)

Read first: the CP2-7 model (`effectiveFrom`, `effectiveTo`, `direction`, `amendmentId`); Manual 4.20
as the audit states it (decreases effective the first of a later month, increases may take effect
mid-month, participant-requested reductions immediate); the Oct 31 review items in the Phase 2
file's appendix. This is the **only** place the amendment behaviors are built.

Build:
- Wire the three behaviors onto the CP2-7 model in the engine: a `decrease` takes effect on the
  first day of a later month than the amendment date; an `increase` may take effect on its
  `effectiveFrom` date mid-month; a `reduction-immediate` takes effect on its date. Recalculate
  occurrences from the effective date forward only. Historic occurrences and events never change.
- Where the effective date is not clear from the care plan, keep the CP2-7 `REVIEW`
  ("amendment effective date needs confirmation, Manual 4.20"). The app never picks a date for the
  person.
- UI, per service in its detail view: "Record a care plan change": kind (Increase / Decrease /
  Reduction asked for by the participant), the effective date, and the new units or tasks. Every
  recorded change goes through the guard. A recorded change never edits the imported Fusion figure;
  it adds a version.
- The calendar shows a marker on the effective date and the version in effect on each date.

Tests: increase mid-month recalculates from that date and not before; decrease dated mid-month takes
effect on the first of the next month; immediate reduction takes effect on its date; a month crossing
an amendment shows both versions; a plan with no amendment is unchanged; saved plans load. Mutation:
apply a decrease on its date instead of the next month's first and confirm the test fails.

Finish: standard finish. Commit: `feat(engine): amendment behaviors, forward-only recalculation (AMEND-01, Manual 4.20)`.

## Prompt CP3-7: The participant calendar and per-service balances (design)

Read first: `apps/web/src/features/quick-schedule/MonthPanel.tsx`, `MonthBalance.tsx`,
`PlanOverview.tsx`, `planSheet.ts`, `others.ts`; engine `calendar/expand.ts`; APP-SPEC 5.4 Month
and 5.8.

Build:
- `normalizeEvents(plan, models)` in `features/quick-schedule/normalizeEvents.ts` (pure): one list of
  every occurrence in the plan, each with date, service, authorization, kind, minutes or quantity,
  and its unit label: the weekly pattern expanded to real dates (engine `expandMonth`, trims and
  exceptions applied), plus every `PlanEvent`. **This list is the only source the calendar, the
  list view and, in CP5-1, the PDF read from.**
- A **Month** tab on the whole-care-plan view: a calendar grid, Sunday to Saturday, one cell per
  date. Each cell shows each service's scheduled minutes (a band per service, labeled by name, not
  only by color) and its events (visit, ADC, meals, covered day, reminder, each with its own mark
  and label). Dates outside the plan and days without care are dashed, as in the single-service
  month. An amendment's effective date has a marker (CP3-6).
- Beside it, **Authorization balances**: for each authorization in the month, authorized, placed or
  scheduled, left, in its own unit; the next nurse visit needed; the shared respite cap when both
  respite lines exist (AUTH-09's combined figure).
- **List view** of the same month ("Month as a list"): the accessible alternative and the default
  below 860 px; a table with date, service, what, how much. The grid has `role="grid"`, arrow-key
  movement and a visible focus; every cell has an accessible name that reads its date and contents.
- **One-day changes:** selecting a date offers "Change this day": minutes for a task on that date
  only, recorded as a `CalendarException` over the weekly pattern (SCH-11 exists); the pattern and
  the authorization are never edited. It goes through the guard.
- The Month tab and its code load with `import()` in their own chunk; `/quick`'s entry stays within
  budget.
- APP-SPEC 5.8: add "The participant calendar" (authorized to edit that section only).

Tests: a plan's `normalizeEvents` for fixture F has each service's weekly occurrences on real dates
and the two GHE visits only in their months; `normalizeEvents` never merges two authorizations; the
grid and the list show the same occurrences (a test compares them); a one-day change appears on that
date only and leaves the pattern alone; balances match `eventBalance`; axe zero violations at desktop
and phone width in both themes; no horizontal scroll at 390 x 844. Mutation: let the calendar read
the weekly pattern directly instead of `normalizeEvents` and confirm the grid-equals-list test fails.

Finish: standard finish with e2e and the chunk sizes from `check-bundle.mjs`. Commit:
`feat(web): participant month calendar and authorization balances`.

## Prompt CP3-8: Phase 3 regression and the matrix

Read first: audit section 8 (the matrix rows marked Phase 3), acceptance DATES-01, RN-01 to RN-04,
SFC-01 (the Phase 3 part), ADW-03, ADW-04.

This prompt authorizes editing `docs/MISSOURI-COVERAGE-AUDIT.md` section 8's Status and Where
columns and section 5.1's "Now" column, and nothing else in it.

Build tests only, plus the doc status:
- DATES-01: mid-month start, a suspension, expiry, a future start, a DST change week (the March and
  November Sundays), and an overnight visit, on the calendar path. Elapsed minutes use America/Chicago
  (SCH-15).
- End to end on fixture F and fixture G: every authorization appears once; events placed; the PDF is
  untouched in this phase (CP5-1 does it).
- Old plans: a plan saved before Phase 3 opens; a saved plan with events round-trips; no participant
  name, DCN or caregiver name in `sessionStorage` (AC-15 style test).
- Update the audit: set each row whose status the tests now prove to PASS (naming its test), keep
  the rest as they are, and mark Phase 3 done in section 7.

Finish: standard finish with e2e, and a list of the new test counts. Commit:
`test: Phase 3 acceptance (DATES-01, RN, ADW-03/04) and audit status`.

---

# Group 4: Coverage Phase 4, restrictions and staffing (branch `coverage-phase-4`)

Base: `main` after Phase 3 is merged. The engine already has CON-01 to CON-07, CON-09, CON-10,
CON-13, CON-16 and CON-17 and tests for them; they run on `Visit` objects with clock times. The
schedule has none yet, so Phase 4 gives it optional clock times and caregivers, and then calls the
rules instead of re-writing them.

## Prompt CP4-1: Visit windows with clock times (design)

Read first: `packages/engine/src/types.ts` (`Visit`); `rules/conflicts.ts` (how visits are read);
`scheduleSheet.ts` ("Visit length", "Set each EVV visit window to its visit length").

Build:
- Optional **visit start time** per service per weekday (`HH:mm`, America/Chicago), stored with the
  service in the plan (optional field, additive). Default: none. The visit's length is the day's
  total already shown as "Visit length"; the end is start plus length, computed with
  `calendar/time.ts` so a visit past midnight and a DST day are right.
- `buildVisits(plan, models)` (pure): turns services with start times into engine `Visit` objects
  for the weeks of the plan. Services without start times produce none.
- Where start times are missing, the overlap rules (CON-01, CON-02, CON-03) emit `REVIEW`
  "No clock times yet, so overlaps can't be checked" instead of passing. They never pass on missing
  data.
- UI: in the service detail's weekly view, a "Start time" field per care day. Go through the guard.
  Copy: "Optional. Add a start time to check overlaps with other services."
- Print and the daily task list show the start time when one is set.

Tests: a visit past midnight splits by date (SCH-15); a DST Sunday length is right; no start times →
REVIEW not PASS; adding times builds `Visit`s whose total minutes equal the day's total. Mutation:
make missing times pass and confirm the REVIEW test fails.

Finish: standard finish. Commit on `coverage-phase-4`: `feat(web): optional visit start times and visit objects for rule checks`.

## Prompt CP4-2: Caregivers per service, qualifications stored and never inferred

Read first: engine `Caregiver` type; `ruleCON06AttendantRelationship`, `ruleCON07AgencyAide`,
`ruleCON17QualificationData`; the privacy rules in the header (caregiver names are memory-only).

Build:
- `CarePlan.caregivers?: Caregiver[]`-like records in the app: `id`, a display name (**memory-only**,
  like the participant's name; after a reload it shows "Caregiver 1"), and the engine's
  `relationships`, `agencyEmployee`, `nurseLicense`, `fcsrRegistered` flags that the person enters.
  Qualifications are entered, never guessed from a name or a role word (CON-17).
- Assignment: per service, who is the agency aide, the CDS attendant, the SFC primary and backup.
  A service can have one or several caregivers; each visit takes one.
- A "Caregivers" panel (own chunk) to add caregivers and assign them. Through the guard.
- Missing qualification data emits `REVIEW` via CON-17, never a pass.

Tests: names never reach storage (a test greps the saved JSON); qualification flags persist; a
missing flag is REVIEW; assignment survives reload as "Caregiver 1" labels. Mutation: persist the
display name and confirm the storage test fails.

Finish: standard finish with e2e. Commit: `feat(web): caregivers and qualifications, names kept in memory only`.

## Prompt CP4-3: Wire the existing conflict rules into the schedule

Read first: `rules/conflicts.ts`, `validate.ts` (`validatePlan`), `docs/RULE-MAP.md` rows CON-01 to
CON-07, CON-16, CON-17; `status.ts`, `ChecksPanel.tsx`, `grouping.ts`, `ruleCopy.ts`.

Build:
- Run CON-01 to CON-07, CON-16 and CON-17 on the `Visit`s from `buildVisits` and the caregivers.
  Do not re-implement any rule; call the existing functions through the plan validator the way
  AUTH and SCH rules already run (APP-SPEC 5.3 step 9 changes: the visit rules now run when visits
  exist; update that paragraph).
- Results join the existing Checks panel and status line: BLOCK groups under "Must fix", REVIEW
  under "Needs review". Add `RULE_COPY` for every CON rule and severity not already covered (the
  existing test names any gap).
- The guard (5.7) refuses an edit that creates a same-service overlap of one caregiver (CON-01),
  respite overlap (CON-03) or a caregiver in two visits at once (CON-04). Other combinations the
  rule pack has not verified stay `REVIEW`; do not turn an unknown pair into a pass or a block.
- Waiver overlap (CON-16) uses enrollments the person enters ("Waivers this participant is
  enrolled in", with dates), never inferred.
- Update `docs/APP-SPEC.md` 5.3 step 9 and 5.5's last bullet (authorized to edit those two only).

Tests: JOIN-04 end to end on fixture F with times: nurse and CDS overlap allowed, respite overlap
BLOCK, an unknown pair REVIEW; a caregiver in two overlapping visits BLOCK (STAFF-01); a spouse
as paid attendant BLOCK only where CON-06 says so; waiver overlap per CON-16's tests. Mutation:
drop the guard check for CON-04 and confirm the refusal test fails.

Finish: standard finish with e2e. Commit: `feat(web): run visit and caregiver rules on the schedule (CON-01 to CON-07, 16, 17)`.

## Prompt CP4-4: Respite coverage overlap, SFC exclusivity and waiver overlap

Read first: audit section 5.1 and Phase 4 bullets; `ruleCON03RespiteOverlap`, `ruleCON16WaiverEnrollments`,
AUTH-09; CP2-3's respite coverage blocks; CP3-4's SFC days.

Build:
- Respite coverage blocks (CP2-3) get start and end times and feed `buildVisits`, so CON-03 sees
  them: a respite block overlapping any other HCBS service visit is BLOCK; respite earlier the
  same day is fine.
- **SFC exclusivity:** a structured family caregiver covered day with a concurrent HCBS service
  the rule pack lists as incompatible is BLOCK through CON-16; any pair the pack does not list is
  `REVIEW`. One primary caregiver per covered day; backup tracked (CP4-2).
- Combined Basic plus Advanced respite 868 and the weekly figure stay as AUTH-09 and CON-09 have
  them; nothing is re-implemented.

Tests: ADW-02 on the calendar; SFC-01 (the Phase 4 part); a covered day with a verified-incompatible
service BLOCK and with an unlisted pair REVIEW. Mutation: treat an unlisted pair as allowed and
confirm the REVIEW test fails.

Finish: standard finish. Commit: `feat(engine): respite overlap and SFC exclusivity on the schedule`.

## Prompt CP4-5: CDS and ILW as one task pool with two ledgers

Read first: audit Phase 4 bullets; AUTH-11 (`ruleAUTH11ProjectIlwSwitch`); `INFO 05-25-01`; Policy 3.50.

Build:
- When a plan has both a CDS authorization (`T1019U2`) and an ILW authorization (`T1019U6`), the
  tasks are one pool for delivery with two separate unit ledgers. The week shows each task once,
  under the authorization that pays for it on that date.
- The projected State Plan to ILW switch date (AUTH-11) is shown on the calendar as a **projection**
  ("Projected: ILW units begin about this date"), only when both authorizations were imported. Never
  shown when only one exists. It never changes either authorization's Fusion figure.
- ILW attendant relationship rules (E-14) stay `REVIEW` until DHSS answers (audit section 9, Q9).

Tests: the pool shows each task once; two ledgers stay separate; the projection appears only with
both authorizations and is labeled; no projection with one. Mutation: show the projection with one
authorization and confirm the test fails.

Finish: standard finish. Commit: `feat(web): CDS and ILW shared task pool with a labeled projection (AUTH-11)`.

## Prompt CP4-6: The 49-hour week shows REVIEW even when the diagnostics pass

Read first: `ruleCON09WeeklyHours`; audit section 9 Q8 and matrix ILW-02; the Phase 4 bullet on E-02.

Build:
- Change CON-09 so that for ILW and respite a `REVIEW` is always shown: "DHSS hasn't confirmed which
  seven days make the week for the 49-hour limit. Check the care plan." Source: audit E-02. The fixed
  week and rolling diagnostics still run and still BLOCK when a check **clearly** exceeds 49 hours
  in every reading; they never turn the REVIEW into a pass.
- Do not pick Sunday to Saturday. Show both diagnostics in the check's details.
- Update the CON-09 rows in `ruleCopy.ts`, `RULE-MAP.md` and `ENGINE-SPEC.md` section 5.

Tests: a plan under 49 hours in both readings still shows REVIEW (ILW-02); over 49 in both readings
shows BLOCK and REVIEW; over in one reading only shows REVIEW with both figures. Mutation: let
passing diagnostics clear the REVIEW and confirm ILW-02's test fails.

Finish: standard finish. Commit: `feat(engine): 49-hour week stays under review until DHSS defines it (CON-09, E-02)`.

## Prompt CP4-7: Policy 3.25 CDS task rules and program compatibility

Read first: the Phase 4 additions in the Phase 2 file's appendix; CON-06, CON-16; audit section 9.

Build care-plan-level checks as engine rules (IDs checked free): `CDS-01` no stand-alone prompting,
cueing or standby as a CDS task; `CDS-02` waiting time is not CDS time; `CDS-03` skilled or
physician-ordered therapy is excluded; `CDS-04` NEMT-covered medical trips are excluded from CDS
transportation; `CDS-05` residents of RCF/ALF or nursing facilities are not eligible for CDS where
the setting is known; `PRG-01` PACE excludes DSDS HCBS; `PRG-02` DMH residential services (Shared
Living, Residential Habilitation, Individualized Supported Living) limit State Plan personal care;
`PRG-03` the funding sequence (State Plan personal care before a comparable waiver authorization).
Source for each: Policy 3.25 or the named policy as the audit gives it.
- A task or setting is flagged only from what the plan states (a task labeled with those words, a
  provider setting printed on the plan, or an enrollment the person enters). Never inferred from
  names. Verified pairs permit; **unknown pairs `REVIEW`; confirmed prohibitions BLOCK** only
  where the rule's source states the prohibition outright; otherwise REVIEW.
- Spouse or legal guardian as a paid CDS attendant stays CON-06; do not duplicate it.

Tests: each rule with a plan that triggers it and one that does not; an unknown pair is REVIEW.
Mutation: make an unverified rule BLOCK and confirm the severity test fails.

Finish: standard finish. Commit: `feat(engine): CDS task rules and program compatibility checks (CDS-01 to 05, PRG-01 to 03)`.

## Prompt CP4-8: Combined personal care and CDS cost cap, and backup coverage

Read first: Phase 4 additions in the Phase 2 file's appendix (60% cap, Manual 4.20; backup and
emergency coverage, Manual 4.15, COOP).

Build:
- `CAP-01`: a care-plan-level `REVIEW` when the plan holds both Agency Basic PC (`T1019`) and CDS
  (`T1019U2`): "Combined State Plan personal care and CDS are subject to the 60% cost maximum."
  Include the APC/RN route to 100% and the Bureau of Federal Programs note as the audit words them.
  The scheduler holds no costs, so this is one flag on the plan, never a per-service balance and
  never a block.
- **Backup coverage** (needs caregivers from CP4-2 and visit times from CP4-1): the person marks a
  caregiver unavailable for dates. The app lists the visits left uncovered, offers eligible
  caregivers (qualified, not double-booked, not over hours), and orders uncovered tasks by the
  participant's COOP risk priority **as the person enters it** (High, Medium, Low; the app never
  guesses risk). Choosing a replacement is a recorded `CalendarException`; the approved
  authorization is never changed.

Tests: the cap flag appears with both services and with neither only one; backup lists only eligible
caregivers; risk order follows the entered priority; the authorization is untouched. Mutation:
auto-assign a caregiver without the person's choice and confirm the test fails.

Finish: standard finish with e2e. Commit: `feat(web): combined PC and CDS cap flag and backup coverage (Manual 4.20, 4.15)`.

## Prompt CP4-9: Agency worker load across participants (GATED)

**Do not start this prompt until the owner writes "BAA decision made" in the conversation.** The
audit's security note says hosted storage of participant data needs business associate agreements
with Google (Firebase) and Vercel, or PHI kept out of hosted storage, and that decision belongs to
the owner and a compliance advisor. If the owner's answer is "keep participant data out of hosted
storage", skip this prompt and record in the audit that cross-participant checks are not offered.

Read first: `firestore.rules`, `apps/web/rules-test/`, `docs/APP-SPEC.md` section 7.2 (Collections), `docs/ENGINE-SPEC.md` CON-04 and CON-05.

This prompt authorizes editing `firestore.rules` and adding rules tests, only as listed.

Build (design):
- Agency mode stores, per participant, only an **agency alias** the agency types (such as "P-001"):
  no name, no DCN, no address. Visits and caregiver ids under `tenants/{tenantId}/participants/{id}`.
  Roles follow the existing members rules (owner and scheduler write, viewer reads). Add rules and
  rules tests (next free R-numbers) proving tenant isolation and that a non-member reads nothing.
- Cross-participant checks run in the engine on the union of an agency's visits: `CON-04` (a
  worker in two participants' visits at once: BLOCK, product safety) and `CON-05` (a worker over
  40 hours in the agency's workweek: WARN). The workweek start comes from the tenant setting.
- Everything the person sees about another participant is the alias only.

Tests: rules tests R-xx; two participants sharing a worker at the same time BLOCK; 41 hours WARN
using the tenant's workweek start; no name, DCN or caregiver name in any Firestore write (a test
reads the written documents). Mutation: write a participant name field and confirm the privacy test
fails.

Finish: standard finish plus `npm run test:rules -w @careplan/web` and `npm run test:e2e:emulated -w
@careplan/web`. Commit: `feat(agency): worker load across participants with alias-only storage (CON-04, CON-05)`.

---

# Group 5: Coverage Phase 5, PDF parity and completeness (branch `coverage-phase-5`)

Base: `main` after Phase 4 (or Phase 4 minus CP4-9 if skipped) is merged. There is no CSV or XLSX
export in this phase or any other (decision 2).

## Prompt CP5-1: One PDF carries the whole plan; screen, PDF and print agree

Read first: `schedulePdf.ts`, `scheduleSheet.ts`, `planSheet.ts`, `printSchedule.ts`; the
`normalizeEvents` list from CP3-7; APP-SPEC 5.4 Print and 5.8 Print; tests `schedulePdf.test.ts`,
`ui-print.test.tsx`.

This prompt authorizes editing APP-SPEC 5.4 Print and 5.8 Print, and the audit's EXPORT-01 row.

Build:
- The whole-plan printout reads **only** from `normalizeEvents` and the existing sheet models, so
  every occurrence on the screen is in the PDF and the reverse. It adds: a **month calendar page**
  for each month still to come (each service's minutes and each event, marked and labeled in black
  and white as well as color); the **authorization legend** (each service's name, code, PA,
  provider, dates, unit, balance for the month); every **review finding** (Needs review items
  included); every **kept and unknown authorization** with its original rows; the caregiver
  assignments **by label only** ("Caregiver 1"), never names (memory-only rule); start times when
  set.
- The one-service printout still fits one US Letter landscape page (AC-27); the whole-plan printout
  pages grow as needed and each page footer reads "Checked with CarePlan Scheduler under rule pack
  mo-2026-07 on <date>".
- "Print schedule" and "Save as PDF" stay the only two outputs; the file name stays "Care schedule
  <date>.pdf", never with a name or DCN.
- Audit EXPORT-01 now reads "Screen, PDF and print agree": update its row.

Tests: **parity test:** make the PDF for fixture F with events placed, read it back with pdf.js, and
compare its list of occurrences (date, service, kind, quantity) with `normalizeEvents`: equal sets.
Same for fixture G (kept items present) and for a plan with an amendment. No name, DCN or caregiver
name in the PDF text. Existing print tests stay green. Mutation: drop one event from the PDF
builder and confirm the parity test fails.

Finish: standard finish with e2e. Commit: `feat(web): whole-plan PDF reads the same occurrences as the screen (EXPORT-01)`.

## Prompt CP5-2: Coverage line on every view and every printout, and "Review every authorization"

Read first: `ReadSummary.tsx`, `PlanOverview.tsx`, the plan summary sentence ("5 authorizations
read: 3 scheduled in the week, 2 nurse visits by month"), `others.ts`.

Build:
- A coverage line, counted from the plan, on the whole-plan view, on a one-service plan, and at the
  top of every printout: "X service authorizations recognized · Y scheduled · Z need a date · N
  administrative context · U unknown" and, when every worksheet row matched, "All task rows
  recognized". Counts use the Appendix 1 class (AUTO, APPOINTMENT, CONTEXT) the plan already knows.
- A button **Review every authorization** opening a dialog (Radix Dialog, as the app does): each
  authorization with its classification, its source page and rows as read (the CP2-6 raw view), and
  for an unknown one its original text. Nothing in it is editable; keep or map actions already in
  the import flow stay where they are.
- Unknown authorizations appear in the dialog, in the whole-plan view and on every printout, always.

Tests: counts for fixture F ("5 recognized, 3 scheduled, 2 need a date") and G; the line appears on
the screen and in the PDF; unknowns appear in all three places; the dialog is keyboard-operable with
focus returned on close; axe zero violations. Mutation: hide unknowns from the printout and confirm
the test fails.

Finish: standard finish with e2e. Commit: `feat(web): coverage line everywhere and a review-every-authorization dialog`.

## Prompt CP5-3: Completeness wording guard

Read first: `status.ts`, `ruleCopy.ts`, `Landing.tsx`, `schedulePdf.ts`, APP-SPEC 4.3.

Build a test that renders and extracts text from: the status line, the Checks panel, the whole-plan
view, every dialog, the landing and rules pages, and the PDF, for plans in each state (clean, with a
REVIEW, with a BLOCK, with an unknown authorization). Assert none of these phrases appears while a
REVIEW or BLOCK stands: "Missouri-approved", "fully compliant", "compliant", "approved by", "passes
all rules", "no problems found". Assert the status reads "Ready to use" with the review items listed
when only REVIEWs stand. If any copy fails, reword it. This prompt authorizes editing only the copy
the test finds, in the files it appears in.

Mutation: change one string to "Fully compliant" and confirm the guard fails.

Finish: standard finish. Commit: `test(web): no compliance claims while a review stands`.

## Prompt CP5-4: Out-of-scope programs stay visible

Read first: audit "Outside Appendix 1"; `others.ts`, the IMP-19 handling.

Build:
- Any authorization whose code is not in Appendix 1 shows as **Unsupported, kept for review**: its
  original rows as read, the page it came from, and what was recognized (code, dates, provider, units
  as printed). One fixed sentence: "This service is outside what CarePlan Scheduler schedules today.
  It is kept here and on the printout so nothing is lost." (Medically Complex Adult Waiver, Brain
  Injury Waiver, DMH developmental disability waivers, Medicare home health, hospice and private pay
  each need their own manual and rule pack; none is built here.) The app does not guess a program
  from a name.
- It never enters a unit total, the weekly pattern or the calendar; it is in the coverage line's
  "unknown" count and every printout.
- Update `otherReason` wording only as needed for this sentence.

Tests: fixture G's `XYZ H2015` shows the sentence, its rows and page; it is absent from totals; it is
on the PDF. Mutation: add its units to a total and confirm the test fails.

Finish: standard finish. Commit: `feat(web): out-of-scope authorizations kept visible with a fixed explanation`.

## Prompt CP5-5: Accessibility, phone and print pass, then the audit

Read first: `a11y.spec.ts`, `phone.spec.ts`, AC-18, AC-19, AC-27 to AC-30; the audit's matrix.

This prompt authorizes editing `docs/MISSOURI-COVERAGE-AUDIT.md` (section 8 statuses, section 5.1
"Now" column, section 7 phase marks) and adding `docs/COVERAGE-RELEASE-REPORT.md`.

Build:
- Add axe checks (desktop and phone, light and dark) for every view added in Phases 2 to 5: the
  calendar and its list, the balances, the caregivers panel, the amendment dialog, the review dialog,
  the unsupported card. Zero violations. Keyboard-only path through placing a nurse visit, an ADC
  day and a one-day change. The month grid has no horizontal page scroll at 390 x 844.
- PDF legibility: a test reads the generated PDFs and asserts no text smaller than the size the
  existing printouts use for body text, and that every page has the footer.
- Update the audit's matrix: every row proven by a named test becomes PASS; rows waiting on DHSS
  stay EVIDENCE; nothing is marked PASS without a test. Update section 5.1 "Now" for all 21 services.
- Write `docs/COVERAGE-RELEASE-REPORT.md`: the 21-service and 51-row coverage diff, the rule
  traceability table (every rule in `RULE_CATALOG` with its source, status, test), the deterministic
  calculators and their fixtures, fixture F end to end, the open DHSS questions (audit section 9),
  the security review (browser-only Quick Schedule; the BAA decision and what CP4-9 did), the rollback
  plan (Vercel redeploy of the previous production deployment; saved plans open in the old version
  because new fields are optional), and the results of every command in the standard finish.

Finish: standard finish with e2e (all projects), `npm run test:rules -w @careplan/web` if rules
changed. Commit: `docs: coverage release report; audit matrix updated from tests`.

---

# After the last prompt (the owner, not Cline)

1. Merge in order: `pdf-only-import`, `coverage-phase-2`, `coverage-phase-3`, `coverage-phase-4`,
   `coverage-phase-5`. Production changes only when each is merged; check the Vercel preview of
   each branch first.
2. Send the DHSS questions in `docs/DSDS-QUESTIONS.md` plus the audit's questions 8 to 13. Every rule
   that waits on an answer stays `REVIEW`; do not present those as state-certified.
3. Real-case validation: open real care plan PDFs on the live site, in a private window, and compare
   each month's units with Fusion. Do not commit any real plan.
4. Settle the BAA question before any agency puts real participant data in hosted storage.
