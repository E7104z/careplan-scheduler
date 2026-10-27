# Questions for DSDS

Questions CarePlan Scheduler needs DSDS (Division of Senior and Disability Services) to answer
before its behavior is presented to the state as DSDS's rule. Each lists what the app does
until then and where that is written down. Send to **LTSS@health.mo.gov** (the contact INFO
09-25-02 gives for questions about it).

## 1. Months whose authorized units don't cover the care plan's tasks (asked: not yet)

**What the app does now (decided Oct 25, 2026):**
- Each month is checked against Fusion's figure for that month. From the care plan report
  that's the month's own row. From the care plan screen, which shows one figure, it's that
  figure prorated the way the Fusion FAQ (Jun 4, 2025) describes: tasks done every day count
  the days in the month, other tasks a set number of days (IMPORT-SPEC 1.2, IMP-10). For a plan
  whose tasks add up to Fusion's figure, no month is ever cut.
- When a month's figure is still lower than the tasks need on that month's calendar (the tasks
  read don't add up to Fusion's figure, or the report gives a lower figure for one month), the
  schedule stops when the month's units run out: the last days are cut, daily tasks first
  (ENGINE-SPEC SCH-17, a product decision of Oct 21, 2026, not a DSDS rule). The month view lists
  every task cut on every date, and says that a consistent need to change a task should prompt a
  request to the care plan change team (INFO 09-25-02).

**Email (ready to send):**

> Subject: Scheduling question: a month whose authorized units don't cover the care plan's tasks
>
> Hello,
>
> We're building a scheduling tool for in-home services providers that follows the
> Person-Centered Care Plan Scheduler (HCBS Manual 4.00, Appendix 14a and 14b) and INFO 09-25-02.
> Two questions:
>
> 1. The Fusion FAQ (June 4, 2025) says Fusion pro-rates units monthly for care plans with
>    tasks done 7 days a week. Is it right that a care plan's authorized units in Fusion differ
>    by month (for example 469 units in a 31-day month, 455 in a 30-day month and 434 in a
>    28-day month for the same tasks), and that the "Total Units" on the care plan screen is the
>    figure for one month length?
> 2. When a month's authorized units are lower than the care plan's tasks need on that month's
>    calendar, how does DSDS expect the schedule to be reduced: by ending the month's visits
>    early when the units run out, by reducing tasks across the month, or another way? And should
>    the provider ask the care plan change team for a change each time this happens, or only when
>    it happens repeatedly?
>
> Thank you,
>
> (name, agency, phone)

**When DSDS answers:** record the answer here with its date, then update SCH-17 (ENGINE-SPEC
section 5, status and source), IMP-10 and APP-SPEC 5.4's month view to match.

## 2. Rounding a task's monthly units: HCBS-3c or the Appendix 14a/14b scheduler (asked: not yet)

**What the app does now (decided Oct 27, 2026, Phase 3):**
- The Worksheet view gives the HCBS-3c's own numbers: `ROUNDUP(Min/Day ÷ 15 × MaxDays)` (ENGINE-SPEC
  F-2a, `calculate3c`), checked against DSDS's 3c workbook for every whole minute 1–1,440 × 1–7 days.
- The schedule uses the Person-Centered Care Plan Scheduler's (4.00 Appendix 14a/14b) `TRUNC(x + 0.99)`
  (F-2b). For whole minutes a day the two always agree. They differ only when a task's weekly minutes
  don't divide evenly by its days, e.g. 61 minutes a week over 7 days: 14a/14b gives 18 units and the
  3c's rounding 19. The app then shows both and marks the task REVIEW (AUTH-03, PARTIAL).

**Email (ready to send):**

> Subject: Question: rounding a task's monthly units (HCBS-3c vs. Appendix 14a/14b)
>
> Hello,
>
> We're building a scheduling tool for in-home services providers that follows the HCBS-3c worksheet
> (HCBS Manual 4.00 Appendix 4) and the Person-Centered Care Plan Scheduler (4.00 Appendix 14a and 14b).
> The HCBS-3c rounds a task's monthly units up (`ROUNDUP`); the scheduler workbooks add 0.99 and drop
> the fraction (`TRUNC(x + 0.99)`). They agree for whole minutes a day. For a task whose weekly minutes
> don't divide evenly by its days (for example 61 minutes a week over 7 days), the 3c's rounding gives
> 19 units and the scheduler's 18. Which one does Fusion use when it calculates a task's units?
>
> Thank you,
>
> (name, agency, phone)

**When DSDS answers:** record the answer here with its date, then set AUTH-03's status and source
(ENGINE-SPEC section 5) and the Worksheet view's reconcile line (APP-SPEC) to match.

## 3. Nurse visits in Advanced Personal Care's first month (asked: not yet)

**What the app does now (decided Oct 27, 2026, Phase 3):** on the HCBS-3a Worksheet view, a plan with
Advanced Personal Care, no ongoing nurse visits, and fewer than 2 nurse visits entered for APC's first month
gets REVIEW (WS-R05, PARTIAL). The manual (4.00 Appendix 3) says: "Two (2) nurse visits are required in the
first month of authorization … A care plan with ongoing nurse visits will not require the additional nurse
visit for the first full month of the PCCP." We read "ongoing" as at least one nurse visit a month.

**Email (ready to send):**

> Subject: Question: nurse visits in the first month of Advanced Personal Care (HCBS-3a)
>
> Hello,
>
> We're building a scheduling tool for in-home services providers that follows the In-Home Services Worksheet
> (HCBS-3a, HCBS Manual 4.00 Appendix 3). The instructions say two nurse visits are required in the first month
> of an Advanced Personal Care authorization, and that a care plan with ongoing nurse visits will not require
> "the additional nurse visit" for the first full month. Two questions:
>
> 1. Does a care plan with ongoing nurse visits of at least one a month meet the first-month requirement with
>    that one visit, or does it still need two in the first month?
> 2. Is "the first month of authorization" the first calendar month, or the first full month of the PCCP?
>
> Thank you,
>
> (name, agency, phone)

**When DSDS answers:** record the answer here with its date, then set WS-R05's rule text and status
(ENGINE-SPEC Amendment C.2) to match.

## 3b. Home Delivered Meals: at most 2 a day? (asked: not yet)

**What the app does now (decided Oct 27, 2026, Phase 3):** more than 2 meals a day on the HCBS-3a Worksheet view
gets REVIEW (WS-R09, PARTIAL). The only source is the note "Max 2/day" printed beside the meals rate on the 3a
workbook's rate sheet (Sheet2 G14). The manual page only says "Enter the units per day and the number of days
per week the meals are received", and the workbook doesn't enforce any limit.

**Email (ready to send):**

> Subject: Question: Home Delivered Meals per day on the HCBS-3a
>
> Hello,
>
> The HCBS-3a workbook's rate sheet notes "Max 2/day" beside the Home Delivered Meals rate ($10.99). The manual
> page (4.00 Appendix 3) doesn't mention a limit. Is two meals a day the maximum DSDS authorizes, and where is
> that limit written in policy?
>
> Thank you,
>
> (name, agency, phone)

**When DSDS answers:** record the answer here with its date, then set WS-R09's status and source (ENGINE-SPEC
Amendment C.2) to match.
