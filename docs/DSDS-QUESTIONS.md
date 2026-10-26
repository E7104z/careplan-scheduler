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
