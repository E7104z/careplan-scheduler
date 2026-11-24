# Spec follow-ups (stale spec items)

DSDS answered the scheduling questions on Nov 24, 2026 (LTSS email). This file records what
changed and which spec documents still describe the old behavior, so the team can fold them in
later without having to re-derive the answers.

## DSDS answers (Nov 24, 2026)

- "Total Units" on the care plan screen are "the total units authorized for the month." Fusion
  calculates "the maximum case scenario" based on days in the month, assuming extra weekday
  occurrences are delivered; actual units used depend on the weekly schedule. Time should not be
  equally distributed across days unless all tasks are authorized for the same number of days
  per week.
- When authorized units don't align with the care plan's tasks and frequency, "providers should
  make reasonable scheduling adjustments to stay within the authorized units while continuing to
  address the participant's needs. Providers should not simply stop visits when units are
  exhausted if doing so would leave needs unmet."
- If units are "consistently insufficient," notify DSDS and request a review. A care plan change
  request is appropriate when the issue is "ongoing or recurring, rather than for isolated
  scheduling variances."

## Changed in this pass

- Engine SCH-17 (fit a month to its authorization by cutting the last days) is removed
  (`packages/engine/src/rules/fit.ts` deleted; `ENGINE-SPEC.md` and `rulepacks/catalog.ts` updated).
- Engine SCH-08 overage is a WARN instead of a BLOCK (`ENGINE-SPEC.md`, `catalog.ts`, `sch.ts`).
- Web: the care plan screen's one "Total Units" figure is validation-only (the IMP-15 checksum),
  never a month's authorization. Monthly figures come from the report's own per-month rows
  (IMP-17) or the derived task formula; there is no more end-of-month trimming.
- Web: the month view, month table and printouts show "over" as a warning and drop "Cut at month
  end".

## Our decisions, not DSDS's

- **Header "Total Units" is validation-only.** DSDS did not say what the header represents or
  that header-derived proration is wrong. We kept the month-length detection by matching derived
  totals (so fixture B stays a 30-day figure: 455, 469, 434 — IMP-T16).
- **Overage is a warning, not a BLOCK.** DSDS said "adjust, don't stop"; the severity choice is
  ours.
- **Consecutive-shortfall threshold is 2 months, our default.** DSDS gave no number. It is a
  named constant (`SHORTFALL_CONSECUTIVE_MONTHS` in
  `apps/web/src/features/quick-schedule/shortfall.ts`) and the UI labels it "our default".

## Spec documents still stale (frozen on purpose)

These were left unchanged per the split decision; each needs a later edit.

- `docs/IMPORT-SPEC.md` IMP-10 and section 1.2: still describes prorating the care plan screen's
  one figure and lowering it in shorter months. That proration is gone; the header is a check
  only.
- `docs/APP-SPEC.md` 5.4 (month view): still describes "cut at the end of the month" and the
  trimmed-date marks. Replaced by the over-authorization warning.
- `docs/APP-SPEC.md` 12.3 (landing example): still describes the refusal box for raising Bathing
  over its month. The landing now shows the SCH-08 overage warning.
- `docs/DSDS-QUESTIONS.md` question 1 "What the app does now": still describes the Oct 2026
  behavior (schedule stops when units run out). See the "answered" note added there.
