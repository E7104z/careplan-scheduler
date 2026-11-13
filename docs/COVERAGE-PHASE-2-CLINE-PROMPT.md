# CarePlan Scheduler — Coverage Phase 2 Cline prompts (service-specific calculators and import detail)

**Read this header before pasting anything.**

"Coverage Phase 2" means **section 7, Phase 2 of `docs/MISSOURI-COVERAGE-AUDIT.md`** — the
service-specific calculators and import detail. It is **not** the app-shell "Phase 2" in
`docs/PHASE-2-CLINE-PROMPTS.md` (that phase shipped the public site, accounts and Quick
Schedule). Same word, different numbering. Everything below is the coverage roadmap.

Base: `main` at the merge of PR #9 and PR #10 (Oct 31, 2026). The audit's Phase 1 is done
(21 of 21 services recognized, 51 of 51 worksheet rows, fixture F passing). Phases 2–5 are
approved as written in the audit, with PR #10's two clarifications. The worksheet tab, print,
export and the old `/conformance` were dropped (PR #5 closed, Oct 29 decision): keep only the
state-parity **engine math and tests** (`packages/engine/src/stateparity/*`, already on main).
Do not re-add a worksheet view, worksheet print/export, or a workbook-parity `/conformance`
page in this phase.

Paste these prompts into Cline **one at a time, in order**. Start the next only after Cline
reports every check in the prompt's "Finish" list passing. All work is on a new branch
`coverage-phase-2` cut from `main`; never commit to `main`, never `--force`.

Read first, every prompt, in this order: `.clinerules`; `docs/MISSOURI-COVERAGE-AUDIT.md`
sections 5, 7 and 8; `docs/ENGINE-SPEC.md`; `docs/IMPORT-SPEC.md`; `docs/APP-SPEC.md` section
5.8; the fixtures in `docs/fixtures/fusion/` and `docs/fixtures/state/`.

Phase-wide rules (these restate `.clinerules`; they are not optional):
- **Tests first, then a mutation check.** For every behavior, write the failing test first,
  make it pass, then break the behavior on purpose once and confirm the test fails. Name the
  mutation and its caught test in the commit body.
- **Never fabricate a BLOCK or a PASS.** A rule whose authority isn't settled emits `REVIEW`
  with its source and the open question. The two evidence items in this phase (3a row 115
  intent, 3c ILW case-management amount) stay `REVIEW`; do not pick a value.
- **Never turn a non-hourly service into 15-minute units.** Meals stay meals, days stay days,
  monthly/cost authorizations stay as kept records. This is already true at import (IMP-19);
  keep it true as each calculator is added.
- **Never overwrite an imported Fusion figure.** Derived values are `source: "derived"` with a
  `method`; Fusion's number is the controlling value where present (engine rule 9).
- Integer-minute arithmetic only; round only where a spec names the function.
- Files under 300 lines, one concept per file, no `any`, no default exports, no `TODO`/stubs.

---

## Prompt CP2-1 — Chore as one-time or intermittent work (ADW-05)

Read first: the phase header above; `docs/MISSOURI-COVERAGE-AUDIT.md` §5.1 (row `MO_ADW_CHORE`,
S5120) and §7 Phase 2; `docs/ENGINE-SPEC.md` (the compose/SCH rules); `packages/engine/src/compose/`.

Build:
- Chore (`MO_ADW_CHORE`, S5120) must be placed as **dated one-time or intermittent occurrences**
  with their own minutes, never as a weekly recurring template. Today it is partially scheduled
  as a weekly pattern (audit §5.1); that is the defect to fix.
- Add a chore occurrence shape that carries a date and minutes and is independent of
  `ScheduleTemplate`'s weekly entries. A chore authorization with no frequency produces **no**
  automatic placement — it is set aside as an editable record, the same way CDS transportation
  with no frequency is (APP-SPEC 5.8 decision 3). Do not invent a frequency.
- The engine keeps the chore authorization's monthly units as a balance; placing occasional
  occurrences draws down that balance and never exceeds it (emit `REVIEW` if a user later tries).
- In Quick Schedule, chore appears in the plan's detail with its placed occurrences and its
  remaining balance; it is not forced onto the weekly grid.

Tests: the audit's ADW-05. A chore authorization with a frequency places intermittent dated
occurrences, not a weekly template; a chore authorization without a frequency places nothing and
is kept as an editable record; the monthly balance is respected. Mutation: make chore fall back
to the weekly composer and confirm the test fails.

Finish (all must pass, paste the summary lines): `npx tsc --noEmit`; `npm test`;
`npm run build`; `scripts/check-bundle.mjs`; Playwright public if any UI changed.
Commit on `coverage-phase-2`: `feat(engine): chore as one-time/intermittent occurrences (ADW-05)`.

---

## Prompt CP2-2 — Agency PC by hand: 11 household rows under MED REL HC TASKS, with the PC/homemaker switch (correction 5)

Read first: `docs/MISSOURI-COVERAGE-AUDIT.md` §4 correction 5 and §5.2 (HCBS-3a B29 control row
and B33–B63 household rows); `packages/engine/src/stateparity/calc3a.ts` (N29/N66 already match);
the rule-pack task library in `packages/engine/src/rulepacks/`.

Build:
- When a user builds an **agency PC** authorization by hand, offer all **11** household rows
  (the 3a `CLEAN BATH … WASH WINDOWS/BLINDS` set) under the `MED REL HC TASKS` control row,
  matching 3a `N29`. Imports are unaffected — any `Med Rel HC Tasks: <task>` row already matches.
- Implement the switch so a household task counts under **either** agency PC **or** homemaker,
  **never both** (3a `N29`/`N66`). The state-parity math already enforces this (CALC-02 PASS);
  this prompt wires it into the by-hand builder so the engine totals and the worksheet-estimate
  math agree.
- Do not change `calc3a.ts` or `docs/fixtures/` (rule 20). If they look wrong, stop and report.

Tests: a by-hand agency PC plan offering all 11 rows; a task assigned under PC is excluded from
homemaker and vice versa; the engine total equals the 3a N29 estimate for the same inputs.
Mutation: let a task count under both PC and homemaker and confirm the test fails.

Finish: same list as CP2-1. Commit: `feat(engine): agency PC household rows and PC/homemaker switch (3a N29/N66)`.

---

## Prompt CP2-3 — Respite as coverage blocks; combined Basic+Advanced figure shown on both

Read first: `docs/MISSOURI-COVERAGE-AUDIT.md` §5.1 (`MO_ADW_RESP_BASIC`, `MO_ADW_RESP_ADV`) and
§4 correction 3; the respite rule `AUTH-09` and `CON-03` in `packages/engine/src/rules/` and
`docs/RULE-MAP.md`.

Build:
- Schedule respite as **coverage blocks** (a start/end span of care) rather than as 15-minute
  task units.
- Show the **combined** monthly figure across Basic and Advanced on **both** services, with the
  shared 868-unit cap (Policy 3.50). The engine rule exists (`AUTH-09` BLOCK on the combined
  total, `CON-03` overlap BLOCK); this prompt surfaces the combined figure in the plan detail
  and calls `AUTH-09`/`CON-03` rather than re-implementing the cap.

Tests: Basic 500 + Advanced 500 over 868 → BLOCK (AUTH-09, existing); the combined figure is
shown on both services; a respite block overlapping another respite block → BLOCK (CON-03).
Mutation: compute the cap against one service only and confirm the test fails.

Finish: same list. Commit: `feat(engine): respite coverage blocks and combined 868 figure (AUTH-09, CON-03)`.

---

## Prompt CP2-4 — Adult Day Care attendance and Home Delivered Meals (reuse WS-R08, WS-R09)

Read first: `docs/MISSOURI-COVERAGE-AUDIT.md` §5.1 (`MO_ADW_ADC`/`MO_ADCW_ADC` S5100,
`MO_ADW_HDM` S5170) and acceptance ADW-03, ADW-04; the worksheet math `WS-R08` (ADC) and
`WS-R09` (HDM) in `packages/engine/src/stateparity/`.

Build:
- **ADC attendance**: minutes a day in 15-minute steps, **≤ 600 minutes (40 units) a day**,
  **≤ 5 days a week**, and the transport part **≤ 120 minutes a day**. Reuse WS-R08; do not
  re-derive the caps. Attendance is recorded as dated events (full calendar placement is Phase
  3 — in this phase the calculator and caps are built and tested, and attendance is kept as
  dated records, not weekly task units).
- **HDM**: meals a day, **≤ 2 a day**, counted as **meals, never minutes or hours** (IMP-T30
  already holds for import). Reuse WS-R09.

Tests: the audit's ADW-03 (ADC 40 units/day, 5 days/week, transport ≤ 120 min) and ADW-04 (HDM
≤ 2/day; never minutes — IMP-T30 stays green). Mutation: lift the 600-minute or 2-meal cap and
confirm the test fails.

Finish: same list. Commit: `feat(engine): ADC attendance caps and HDM meal counts (WS-R08, WS-R09)`.

---

## Prompt CP2-5 — RCF/ALF variants as facility services

Read first: `docs/MISSOURI-COVERAGE-AUDIT.md` §5.1 (`MO_PC_RCF` T1019U3, `MO_APC_RCF` T1019U3 TF,
`MO_RN_RCF` T1001U3); `packages/engine/src/rulepacks/appendix1.ts`.

Build:
- Treat the RCF/ALF variants as **facility services**: scheduled without assuming an in-home
  visit. They are recognized and kept today (Phase 1); this prompt gives them their facility
  scheduling treatment (the task set that applies in a facility; no household/home-visit tasks
  auto-assumed).
- Preserve the code distinction: T1019U3 (Basic RCF/ALF) and T1019U3 TF (Advanced RCF/ALF) are
  separate from the home T1019/T1019TF; never collapse by code (INV-04).

Tests: an RCF/ALF authorization schedules its facility tasks without a home visit; the RCF/ALF
code stays distinct from the home code. Mutation: map an RCF/ALF code to the home service and
confirm the test fails.

Finish: same list. Commit: `feat(engine): RCF/ALF variants as facility services`.

---

## Prompt CP2-6 — Global task IDs and source-field provenance (JOIN-03, SOURCE-01 detail)

Read first: `docs/MISSOURI-COVERAGE-AUDIT.md` §7 Phase 2 (global task IDs; source page and
line) and acceptance JOIN-03; `packages/engine/src/types.ts` (`AuthorizedTask.id`, today stable
only within its authorization); `docs/IMPORT-SPEC.md`.

Build:
- Give every task a **global UUID** attached to its authorization's UUID, so the same label in
  two authorizations is never confused when occurrences are stored (JOIN-03). Source labels and
  codes are provenance only and are never used as a primary key.
- For each field the importer reads, record its **source page and line** (provenance), and add
  an **expandable raw view** of the authorization's rows as read, in the import read summary.
- Old saved plans must keep loading: provenance and UUIDs are additive and optional in storage.

Tests: the same task label in two authorizations resolves to two distinct UUIDs when occurrences
are stored (JOIN-03); each extracted field carries a page+line; a plan saved before this change
still loads. Mutation: key occurrences by label and confirm the two-authorization test fails.

Finish: same list. Commit: `feat(import): global task UUIDs and source-field provenance (JOIN-03)`.

---

## Prompt CP2-7 — Effective-dated authorization and schedule groundwork (AMEND-01)

This is the one architectural change placed early on purpose (Oct 31 review). It lays the data
model now so Phase 3's dated events and amendment behaviors have something to version against.
The amendment **behaviors** (mid-month increase, first-of-next-month decrease, immediate
participant-requested reduction) are Phase 3; this prompt builds only the model and leaves the
behavior decisions at `REVIEW`.

Read first: Manual 4.20 (care-plan amendments: decreases effective the first of a later month,
increases may take effect mid-month, some participant-requested reductions immediate);
`packages/engine/src/types.ts` (`ServiceAuthorization.revision`, `MonthlyAuthorization.revision`,
`ScheduleTemplate`, `CalendarException`).

Build:
- Add an **effective period** and an **amendment record** to the model: a `ServiceAuthorization`
  (and its `ScheduleTemplate`) can carry a chain of effective-dated versions, each with an
  `amendmentId`, an `effectiveFrom`, an optional `effectiveTo`, and a `direction`
  (`increase` | `decrease` | `reduction-immediate`). Occurrences reference the version that was
  in effect on their date, so historic records are never rewritten when a later amendment lands
  (the request's "recalculate scheduled occurrences … without rewriting historic records").
- Do **not** implement the effective-date rules yet. Store the direction and effective date; a
  schedule that spans an amendment emits `REVIEW` ("amendment effective date needs confirmation,
  Manual 4.20") until Phase 3 wires the behavior. Cite Manual 4.20 on the rule.
- Keep it additive: a plan with no amendments behaves exactly as today, and old saved plans load.

Tests: a two-version authorization keeps occurrences before the effective date on the old
version and after it on the new; a plan with no amendment is unchanged; the spanning `REVIEW`
fires with its source. Mutation: let a new version rewrite a pre-effective-date occurrence and
confirm the test fails.

Finish: same list. Commit: `feat(engine): effective-dated authorization/amendment model groundwork (AMEND-01, Manual 4.20)`.

---

## Prompt CP2-8 — Permanent regression: the DHSS agency-model October example (CALC-09)

Read first: `docs/MISSOURI-COVERAGE-AUDIT.md` §8 (CALC-08, the "461 + 5 min" separation) and the
elapsed-minute accounting `SCH-15`; `packages/engine/test/scheduleSheet.test.ts`.

Build:
- Add a permanent regression fixture from the DHSS Agency Model workbook demonstration: a weekly
  task pattern totaling **590 minutes/week**, a worksheet monthly-unit estimate of **181 units**,
  and a calendar month (the October example) of **2,630 scheduled minutes = 175 whole 15-minute
  units + 5 remaining minutes**. Assert all three as separate values: the weekly pattern, the
  worksheet estimate, and the calendar-expanded whole units with the 5-minute remainder shown,
  not dropped (this is why the three numbers are kept separate).
- Use a constructed `P-TEST` task set that reproduces 590 weekly minutes and the 181-unit
  estimate; the per-task arrangement is a test fixture, not real participant data (rule 4). If a
  task set that reproduces **all three** numbers exactly cannot be constructed from the known
  totals alone, assert the three totals against a documented fixture and mark the calendar-minute
  assertion to be tightened in Phase 3 when dated placement is complete — do not weaken the
  remainder-visible requirement.

Tests: CALC-09 — 590 weekly minutes, 181-unit worksheet estimate, 2,630 October minutes → 175
units + 5 minutes, remainder shown. Mutation: silently drop the 5-minute remainder and confirm
the test fails.

Finish: same list. Commit: `test(engine): DHSS agency-model October regression — 590/181/2630 (CALC-09)`.

---

## Evidence that stays REVIEW in this phase (do not resolve)

- **3a row 115 (chore `N115`)**: `ROUNDUP(G115*L115/15,0)`, unlike rows 112 and 119 — intent
  unconfirmed (audit §9 Q11, E-18). Keep chore's placement safe and mark the formula `REVIEW`.
- **3c ILW case-management amount**: Appendix 1 lists $38.17/month; the 3c ILW tab shows
  $458.09 (audit §4, §9 Q12). The scheduler uses no costs; leave both recorded, resolve neither.

---

## Appendix — where the Oct 31 review's new items land

The Oct 31 document review (combined PC/CDS cost cap, PACE/DMH/BIW, Policy 3.25 CDS task rules,
APC nursing triggers, backup/COOP coverage) raised items beyond the audit's §7. They are folded
into the existing phases as additions — no new phase. This Coverage Phase 2 covers only the
items above plus the amendment groundwork (CP2-7) and the agency regression (CP2-8). The rest:

**Phase 3 (unified calendar with dated events) — additions:**
- APC nursing triggers (Appendix 3): two nurse visits in the **first month** of a new APC
  authorization unless an ongoing nurse visit covers it; visits less often than weekly entered
  in **days per month**, not days per week; GHE only for the semiannual visit.
- Amendment **behaviors** on the CP2-7 model: decrease effective the first of a later month;
  increase may take effect mid-month; participant-requested reduction/closure immediate
  (Manual 4.20). Recalculate occurrences forward only; never rewrite history.

**Phase 4 (restrictions and staffing) — additions:**
- **Combined Agency PC + CDS 60% State Plan cost cap** (Manual 4.20): a cross-service validator
  that checks the two authorizations together, with the APC/RN path to 100% and the Bureau of
  Federal Programs over-cap note. `REVIEW` with source; the scheduler holds no costs, so this is
  a care-plan-level flag, not a per-service balance.
- **Policy 3.25 CDS task rules**: no standalone prompting/cueing/standby as CDS; waiting time is
  not CDS time; skilled/physician-ordered therapy excluded; NEMT-covered medical trips excluded
  from CDS transportation; spouse/legal guardian cannot be a paid CDS attendant (CON-06 exists);
  RCF/ALF/nursing-facility residents ineligible for CDS where the setting is known.
- **Program compatibility**: PACE excludes DSDS HCBS; DMH residential (Shared Living, Res Hab,
  ISL) limits with State Plan PC; funding sequence (State Plan PC before comparable waiver PA).
  Verified pairs permit; unknown pairs `REVIEW`; confirmed prohibitions BLOCK (CON-16 exists for
  waiver overlap).
- **Backup and emergency coverage** (Manual 4.15, COOP): when a worker is unavailable, identify
  uncovered tasks, offer eligible replacements, order by COOP risk priority; never silently
  change the approved authorization. Depends on caregivers (Phase 4), so it lands after them.

**Phase 5 (exports and completeness) — additions:**
- Brain Injury Waiver and other non-Appendix-1 programs (Medically Complex Adult Waiver, DMH
  DD waivers): kept as `UNSUPPORTED_REVIEW` until each has its own researched rule pack; a
  separate BIW rule pack (Oct–Sep waiver year, $32,000 annual limit) is its own future phase,
  not folded into DSDS scheduling. This keeps "full DSDS coverage" distinct from "full Missouri
  home-health coverage."

**Deployment checks (unchanged from audit §4, carry into the release):** repository
reconciliation (now: #7/#8/#9/#10 merged, main green); regression testing (existing schedules
open, no composer bug, manual edits stay placed); real-case validation (fixture F end to end);
security and privacy (tenant isolation, no PHI in diagnostics, BAA decision before real data).

---

## Review decisions

**CP2-5 follow-up (Nov 1, 2026).** Settled from primary sources after the CP2-5 review:

1. **Facility task set (Policy 3.20, rev. Mar 2026).** Basic RCF/ALF PC offers 3.20's tasks:
   Bathing, Dressing/Grooming, Essential Correspondence, Dietary, Mobility/Transfer/Position,
   Self-Admin of Medications, Toileting, and of the 3a's household rows only Clean Living Area and
   Laundry. 3.20's Medically Related Household Tasks "clean the resident's living area and
   launder the resident's clothes and linens"; the facility covers the rest. Nothing is
   auto-assumed: a by-hand plan adds tasks itself. RCF/ALF APC keeps the home APC set, including
   the transfer device (Policy 3.10 covers RCF/ALF; 3.20 omits it, audit §9 Q15).
2. **CON-07 on RCF_PC/RCF_APC → REVIEW**, and CON-17 asks for missing relationship data. 3.05's
   aide restrictions aren't restated in 3.20, so neither a BLOCK nor a silent pass (audit §9 Q14).
3. **AUTH-05 prorates RCF_PC/RCF_APC.** INFO 05-25-03 says RCF/ALF care plans get prorated
   monthly units once reauthorized in Fusion.
4. **Import.** A care plan report's T1019U3 or T1019U3 TF block is scheduled, not kept. The
   month row reads a spaced modifier ("T1019U3 TF", as Appendix 1 prints it) and the code is
   resolved through Appendix 1; before this, the advanced code asked "which service" and could be
   picked as home APC (INV-04). The RCF/ALF nurse visit (T1001U3) is still kept.
