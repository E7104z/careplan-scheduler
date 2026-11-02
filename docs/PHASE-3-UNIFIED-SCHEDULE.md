# CarePlan Scheduler: Unified Multi-Service Scheduling

Reviewer direction, Oct 31, 2026, saved as given. The participant's name and DCN, which named
the care plan PDF it cites, are removed: that PDF is a real plan and is never committed. Its
layout, with made-up identifiers, is fixture `docs/fixtures/fusion/F-care-plan-report-multi.txt`.

---

I agree. The app should generate one complete participant schedule, not a separate schedule for every service authorization.

Looking at your screenshot and the seven-page Fusion care plan you uploaded, I can see exactly why the current approach is limiting.

Missouri authorizes services individually, but the participant experiences those services as one coordinated care plan. CarePlan Scheduler should preserve the separate authorizations behind the scenes while combining their tasks and appointments into one calendar.

## 1. What this actual Fusion plan contains

The plan has four distinct service types and five authorization records.

| Service | Authorized amount | Scheduling treatment |
|---|---|---|
| Agency Personal Care | 226 units/month | Eight authorized tasks distributed across the week |
| CDS Essential Transportation | 40 units/month | Transportation appointments scheduled on appropriate dates |
| Homemaker (HC) | 5 units/month | Window/blind cleaning once weekly |
| General Health Evaluation | 1 visit in May 2026 | Nursing appointment |
| General Health Evaluation | 1 visit in August 2026 | Nursing appointment |

The three time-based services total 271 monthly 15-minute units, equivalent to 67 hours 45 minutes, but they remain three separate authorization balances. The GHEs are counted as visits, not hours.

The Fusion document explicitly records each service's monthly authorization and task details on separate pages. That is how the imported data should be stored, not how the user should be forced to view the finished schedule. [the participant's care plan PDF]

## 2. The agency PC mathematics matches Fusion exactly

I independently recalculated all eight agency-PC tasks using Missouri's month-equivalent factors and per-task rounding.

| Task | Minutes/occurrence | Days/week | Derived monthly units |
|---|---|---|---|
| Dietary | 75 | 5 | 115 |
| Clean Bath | 15 | 2 | 10 |
| Clean Kitchen | 15 | 2 | 10 |
| Clean Living Area | 10 | 3 | 10 |
| Make Bed / Change Linens | 10 | 5 | 16 |
| Trash | 5 | 1 | 2 |
| Laundry | 60 | 2 | 40 |
| Dressing / Grooming | 15 | 5 | 23 |
| Total | | | 226 |

Exact match with Fusion's 226 authorized units.

This example is particularly useful because it contains 5-, 10-, 15-, 60-, and 75-minute tasks, including frequencies from one to five days weekly. It gives us a strong real-world test for the authorization parser and calculation engine.

It also confirms that the medically related household tasks on page 3 belong under the agency PC authorization. They must not be mistakenly grouped with the separate Homemaker authorization simply because they involve household chores. [the participant's care plan PDF]

## 3. What the unified schedule should look like

For this participant, the application should create one weekly schedule containing all services, with each task identified by its source authorization.

Here is an illustrative arrangement based on the actual authorized task frequencies:

Participant's master weekly schedule (illustrative arrangement; visit times and transport frequency remain editable)

| Day | Services |
|---|---|
| Mon | Agency PC — 110 min |
| Tue | Agency PC — 190 min |
| Wed | Agency PC — 110 min; CDS Transport — 120 min proposed |
| Thu | Agency PC — 160 min |
| Fri | Agency PC — 145 min |
| Sat | Homemaker — 15 min |
| Sun | No recurring service proposed |

The proposed Wednesday transport duration and Saturday homemaker placement are scheduling choices, not instructions found in Fusion. The transport authorization specifies 40 monthly units but no visit frequency. A GHE would appear as a separate nursing appointment in May or August, not every week.

The agency-PC tasks total 715 minutes per week under this example. The exact date placement can change to accommodate the participant.

Notice that the user never has to switch between Agency PC, CDS, and Homemaker to understand the care schedule.

They can simply click Wednesday and see every scheduled task, including which authorization pays for each service.

## 4. The app should combine the calendar, not combine the authorizations

This is the most important architectural distinction.

One participant → Agency PC (226 units), CDS Transport (40 units), Homemaker (5 units), GHE authorization (one visit in May, one in August) → one master calendar (all tasks, visits, workers, and appointment dates).

Underneath that master calendar, the application still maintains separate unit balances, service identifiers, assigned workers, and eligibility rules.

For example, the CDS transportation attendant may be employed by the participant under the consumer-directed model, while the agency PC aide works for the provider. Even though Fusion names the same provider for both authorizations, we cannot assume they are performed by the same worker. (health.mo.gov)

## 5. Five changes I would make to Quick Schedule

1. Import the entire PDF before deciding what to schedule. Identify all service blocks, authorizations, tasks, dates, providers, and monthly unit limits. Never stop after reading the first recognizable service.
2. Generate a participant-level master calendar. Services can be filtered or viewed individually, but the default is one unified schedule containing every applicable service.
3. Keep service identity attached to every task and visit. Your sample Fusion report actually displays T1019 under both Agency PC and CDS. Therefore, procedure code alone is not a sufficient identifier. Use service type, authorization ID, effective period, and task ID.
4. Provide two views of the same schedule: a simple combined participant calendar and a detailed task/authorization view showing units remaining in each category. A user should be able to move a task without having to reopen another schedule.
5. Handle occasional and date-specific services automatically. GHEs should appear only in authorized months. The monthly calendar must also check the correct authorization dates. This particular plan ends October 31, 2026, so the app must not carry its tasks into November without another valid authorization.

These changes are consistent with Missouri's person-centered scheduling approach: services should be arranged around authorized tasks and the participant's needs, not distributed evenly just to consume an authorization. (health.mo.gov)

## 6. What I would preserve from your current interface

The screenshot already shows a useful foundation: clear participant identification, care-plan dates, recognized tasks, a reconciliation statement, and straightforward print/PDF actions.

I would retain those elements but change the imported-plan summary from a single-service record into a whole-care-plan summary.

For this example, it would say something like:

> Care plan successfully imported
>
> 4 service types identified, 5 authorization records, and 8 agency-PC tasks.
>
> Agency PC: 226 units/month — matches Fusion. CDS Transportation: 40 units/month. Homemaker: 5 units/month. General Health Evaluations: May and August 2026.
>
> One unified schedule generated. Some visit times and transportation allocations require scheduling choices.

That is much more valuable than generating four or five different documents.

My recommendation: Make the participant the primary scheduling entity and the service authorization a secondary layer. This should be the default behavior throughout CarePlan Scheduler, including Quick Schedule, the agency calendar, saved schedules, and printed output.

The uploaded case is an excellent acceptance test: all service blocks should be recognized, the 226-unit agency calculation should reconcile exactly, and the app should create one coordinated, editable schedule without merging the underlying authorizations.

---

## Review decisions (Oct 31, 2026)

Built as APP-SPEC 5.8 and IMPORT-SPEC IMP-11, IMP-17, IMP-18; acceptance AC-28, AC-29 and
IMP-T26 to IMP-T29.

1. **The participant is the scheduling entity; each authorization stays a separate state.**
   `CarePlan.services` holds one `QuickState` per time-based authorization, with its own
   dates, Fusion figures, tasks, guard and checks, so balances never merge. Visits are kept by
   month in `CarePlan.visits`.
2. **Service identity:** label first, then the month table's code only when unambiguous;
   never T1019 alone (the report shows it for CDS too). `HC` → S5130 is added to IMP-11 from
   this real plan.
3. **CDS essential transportation** is read from its one number, units a month (40 → 600
   minutes), and set aside on one day: 120 minutes a week, the reviewer's figure.
4. **Placement (superseded: services no longer spread across the week):** every service
   combines on one shared set of care days, sized to the largest days-per-week across the
   client's services. Agency PC takes Monday to Friday; each later service takes its own days
   from that same set — a service with fewer days takes the lightest subset, and transportation
   takes the quietest weekday. So homemaker lands on Thursday (not Saturday) and transportation
   on Friday. Each is still an editable choice in the service, as the proposal says. Agency PC
   comes to 715 minutes a week, matching the proposal; its days differ from the illustration
   because the composer spreads tasks by its own rules.
5. **Two views:** the whole care plan (default with several services) and each service in
   detail on the same page, one click apart. Moving a task never reopens anything.
6. **Authorization dates:** each service schedules only its own authorized months from this
   month on; nothing is carried past Oct 31, 2026. A service that has ended is left out with a
   note. GHEs show only their authorized months, marked Past, This month or Coming up.
7. **Printed output:** the whole week first, every row naming its service, then each
   service's own page. A day on the combined page is a "Day total", not one visit, since
   different workers may do each service; EVV windows come from each service's page.
8. **Workers:** Quick Schedule has no workers yet. The combined day lists each service
   separately so no one assumes one worker does them all. Workers per service belong to the
   agency calendar (later phase), which should use this same participant-first model, as
   should saved schedules.
