# CarePlan Scheduler — Missouri DHSS/DSDS comprehensive scheduling blueprint

**Research baseline:** October 31, 2026  
**Document status:** Research-backed engineering blueprint, **NOT** a government certification or an attestation that every disputed rule has been resolved.  
**Implementation status:** This document instructs the development team how to implement **verified behavior** and explicitly quarantine evidence gaps. It does not authorize declaring the software fully legally compliant before state clarification, actual Fusion tests, and Appendix 14a/14b formula parity.

## 0. Scope and truthfulness

**The July 2026 DHSS 3.00 Appendix 1 table contains 21 service-code entries.** This document and the accompanying JSON registry require 100% **recognition** of those entries and correct mode classification. It does **not** imply that the 21 cover all Missouri home health: DMH developmental disabilities waivers, the Brain Injury Waiver, Medically Complex Adult Waiver (previously MFAW), Medicare-certified home health, hospice, and private-pay services have different authorities, codes and manuals. Their program rule packs must be separately researched and validated. Never silently misidentify one of these as a July Appendix 1 service.

Four canonical service classifications for end users:

- `AUTO`: automatically schedulable from authorized tasks/frequency/durations; may still require preferred day/time and attendant details.
- `APPOINTMENT`: schedules only when a date, scheduling window or human-confirmed appointment details are supplied. Subtypes: nursing, adult day attendance, delivered meals, service coordinator, installations.
- `CONTEXT`: a legitimate non-time-based authorization displayed with no invented shift; may support optional nonbillable event/reminder.
- `UNSUPPORTED_REVIEW`: unrecognized or externally governed authorization, always retained in the parsed plan and surfaced for manual classification and policy review.

Internal modes add `TASK_VISIT`, `VISIT_COUNT`, `COVERAGE_SHIFT`, `ATTENDANCE`, `DELIVERY_COUNT`, `DAY_COVERAGE`, `COST_CONTEXT`, `ADMIN_MONTH`, `ONE_TIME_INTERMITTENT`, `EXTERNAL_UNKNOWN`. These are **software designations** and must not be presented as DHSS terminology.

## 1. Authoritative sources and revision

| Source | Purpose | URL |
|---|---|---|
| 3.00 Appendix 1, **July 2026** | 21 service lines, units, codes, rates and certain unit limits | https://health.mo.gov/book/export/html/3116 |
| 3.00 Appendix 2, **July 2026** | 60%/$3,355.99 and 100%/$5,593.32 cost maximum, additional combined service limits | https://health.mo.gov/book/export/html/3106 |
| HCBS 06-26-01, **June 30, 2026** | Changed caps; 49-hour weekly ILW and combined ADW respite limits | https://health.mo.gov/partners-providers/home-community-based-services-provider-information/memos/hcbs-06-26-01-fy-27 |
| 3.05 Basic PC, **June 2025** | Agency PC task, caregiver and cost rules | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-based-0 |
| 3.10 APC, **March 2025** | Approved advanced tasks, qualifications, 15-minute units | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-based-1 |
| 3.15 Nurse Visits, **July 2026** | Visit counts, GHE, APC training/evaluation, nurse task types | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-based-2 |
| HCBS 08-26-01, **August 3, 2026** | Completed GHE upload due 15th of next month | https://health.mo.gov/partners-providers/home-community-based-services-provider-information/memos/hcbs-08-26-01-updated |
| INFO 08-26-01, **August 4, 2026** | GHE missed visits; completion rules | https://health.mo.gov/partners-providers/home-community-based-services-provider-information/memos/info-08-26-01-general |
| 3.20 RCF/ALF, **March 2026** | Facility-specific additional-care limitations, task descriptions | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-based-3 |
| 3.25 CDS, **January 2026** | CDS tasks, attendant restrictions, monthly essential transportation | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-based-4 |
| INFO 05-25-01, **May 2025** | State Plan CDS and ILW deliver-all-tasks / switch funding sequence | https://health.mo.gov/partners-providers/home-community-based-services-provider-information/memos/info-05-25-01-hcbs |
| 3.31 ADCW | Adult Day Care Waiver age and setting | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-11 |
| 3.35 Chore, **April 2011** | Short-term/intermittent ADW Chore | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-12 |
| 3.40 HDM | Meals and restriction of no more than two/day | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-19 |
| 3.45 Homemaker, **November 2021** | Household task authorizations; priority of PC medically related household work | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-20 |
| 3.50 Respite, **July 2026** | 49 h/week and 868 units/month combined, overlap restrictions | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-based-5 |
| 3.51 ADC (ADW) | Daily attendance maximum, up to 120 min/day within ADC allocation for transport | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-based-6 |
| 3.55 ILW, **July 2026** | ILW personal care, BFP approval and ancillary services | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-based-7 |
| 3.60 SFCW, **March 2025** | One caregiver, day unit, exclusive service regime and backup | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-based-8 |
| 3.70 SSBG/GR | Exceptional non-Medicaid funded protective service authorizations | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/300-available-home-and-community-based-9 |
| HCBS-3a (uploaded XLSX) | Exact agency service worksheet tasks and formulas | File `4.00appendix3da3aform.xlsx` |
| HCBS-3c (uploaded XLSX) | Exact CDS/ILW worksheet tasks and formulas | File `4.00appendix4da-3cform_0 (3).xlsx` |
| INFO 09-25-02, **Sept 23, 2025** | Person-centered scheduling tool Appendix 14a/14b and encouragement to follow similar process | https://health.mo.gov/seniors/hcbs/info-docs/info-09-25-02.pdf |
| Appendix 14a / 14b | Agency/CDS person-centered scheduling reference workbooks — **their actual XLSX bytes not yet obtained/verified** | https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/400-home-and-community-based-services-32 and https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/400-home-and-community-based-services-33 |
| INFO 05-25-02, May 2025 | Fusion moved from highest-frequency rounding to per-task frequency calculation | https://health.mo.gov/partners-providers/home-community-based-services-provider-information/memos/info-05-25-02-hcbs |
| INFO 05-25-03, May 2025 | Fusion month-length adjustments and legacy Web Tool migration issue | https://health.mo.gov/partners-providers/home-community-based-services-provider-information/memos/info-05-25-03-hcbs |
| Fusion/PCCP notifications, April 2026 | New automated authorization notifications and queue behavior | https://health.mo.gov/partners-providers/home-community-based-services-provider-information/memos/info-04-26-01-care-plan |
| DHSS HCBS Manual index | Monitor later updates | https://health.mo.gov/partners-providers/home-community-based-services-provider-information/home-and-community-based-services-manual |
| DHSS HCBS memos index | Monitor new October/November and later memos | https://health.mo.gov/partners-providers/home-community-based-services-provider-information/memos |

**Authority hierarchy:** Participant's actual *approved* Fusion authorization and effective dates control the schedule; binding regulation/current DHSS policy controls restrictions; official worksheet formulas provide derivations when an authorization is unavailable; DHSS scheduling tools provide process/parity reference; internal defaults are never represented as policy. Imported source conflicts produce `REVIEW` and preserve all competing values.

## 2. Service registry and handling, all 21 state entries

The companion `CarePlan_Service_Registry_2026-10-31.json` contains structured keys, normalized codes, service categories, units, and source URLs. The matrix below is the implementation requirement. Classes `AUTO_FACILITY` and `AUTO_INTERMITTENT` are subdivisions of `AUTO`.

| ID | Program | Service | Code | Base unit | Scheduling behavior |
|---|---|---|---|---|---|
| MO_PC_AGENCY | STATE_PLAN | Basic Personal Care — Agency Model | `T1019` | 15_minutes | AUTO |
| MO_APC_AGENCY | STATE_PLAN | Advanced Personal Care — Agency Model | `T1019TF` | 15_minutes | AUTO |
| MO_RN_AGENCY | STATE_PLAN | Authorized Nurse Visits — Agency Model | `T1001` | visit | APPOINTMENT |
| MO_PC_RCF | STATE_PLAN | Basic Personal Care — RCF/ALF | `T1019U3` | 15_minutes | AUTO_FACILITY |
| MO_APC_RCF | STATE_PLAN | Advanced Personal Care — RCF/ALF | `T1019U3 TF` | 15_minutes | AUTO_FACILITY |
| MO_RN_RCF | STATE_PLAN | Authorized Nurse Visits — RCF/ALF | `T1001U3` | visit | APPOINTMENT |
| MO_CDS | STATE_PLAN | Personal Care Assistance — Consumer Directed | `T1019U2` | 15_minutes | AUTO |
| MO_ADW_ADC | ADW | Adult Day Care — ADW | `S5100HC` | 15_minutes | ATTENDANCE |
| MO_ADW_HC | ADW | Homemaker — ADW | `S5130` | 15_minutes | AUTO |
| MO_ADW_CHORE | ADW | Chore — ADW | `S5120` | 15_minutes | AUTO_INTERMITTENT |
| MO_ADW_HDM | ADW | Home Delivered Meals — ADW | `S5170` | meal | DELIVERY |
| MO_ADW_RESP_BASIC | ADW | Basic Respite — ADW | `S5150` | 15_minutes | SHIFT |
| MO_ADW_RESP_ADV | ADW | Advanced Respite — ADW | `S5150TF` | 15_minutes | SHIFT |
| MO_ILW_PCA | ILW | Personal Care Assistance — ILW | `T1019U6` | 15_minutes | AUTO |
| MO_ILW_CM | ILW | Case Management — ILW | `T2024U6` | month | CONTEXT_APPOINTMENT |
| MO_ILW_FMS | ILW | Financial Management Services — ILW | `T2040U6` | month | CONTEXT |
| MO_ILW_SME | ILW | Specialized Medical Equipment — ILW | `T2029U6` | actual_cost | CONTEXT_EVENT |
| MO_ILW_SMS | ILW | Specialized Medical Supplies — ILW | `T2028U6` | actual_cost | CONTEXT_EVENT |
| MO_ILW_EAA | ILW | Environmental Accessibility Adaptations — ILW | `S5165U6` | actual_cost | CONTEXT_EVENT |
| MO_ADCW_ADC | ADCW | Adult Day Care — ADCW | `S5100HB` | 15_minutes | ATTENDANCE |
| MO_SFC | SFCW | Structured Family Caregiving | `S5126HB` | day | DAY_COVERAGE |

**Unrecognized alias policy:** The official table lists `T1019U2` for CDS, but the uploaded *real Fusion care plan* presents both agency PC and a CDS transportation authorization under display code `T1019`. Do **not** key identity by code alone. Preserve verbatim Fusion code and service-type label, provider, authorization ID, enrollment program, date range, and task associations. Treat inconsistent codes as a reviewable display/normalization discrepancy, never as a reason to drop a service.

**Special subtype detection:** GHE, Eval APC, Train APC, RN-medication setup, skin check, nurse nail care, other nursing (injectables other than insulin, venipuncture, catheter change, wound dressing, central line), medically related household tasks under PC, essential transportation, and non-time ILW services must be explicitly recognized as *subtypes* or tasks of a listed service. They do not necessarily have their own Appendix 1 code.

## 3. Detailed rule packs (DHSS-verified requirements versus product conventions)

### R01 — State Plan Agency Basic PC (3.05)

- Unit 15 minutes; participant approved monthly authorization governs; July 2026 program ceiling 412 units/month.
- Recognize bathing, dietary, dressing/grooming, mobility/transfer, self-administration of medications, toileting/continence and medically related household tasks. **The latter is a parent/control row:** its selected Homemaker tasks are charged under PC, not simultaneously counted under standalone ADW Homemaker.
- Typical times are guidance, not unilateral restrictions. Task frequencies and minutes in the actual PCCP supersede suggestions. More than one visit/day can be needed; visit length is the sum of assigned task minutes plus only separately authorized legitimate travel segments.
- Agency aide must be employed by provider; immediate-family disqualification in policy. Do not apply CDS family exception to agency aide.
- Agency PC + CDS together subject to 60% cost maximum; APC/RN cost governed separately. Scheduler may show an authorization-cost `REVIEW` diagnostic but is not a claims/billing calculator.
- No mandatory universal equal-minutes-per-day scheduling.

### R02 — Agency APC (3.10)

- Use separate 15-minute monthly authorization and task family: Aseptic Dressings; Assistance with Transfer Device; Bowel/Bladder Program; Catheter Hygiene; Non-Injectable Medications; Ostomy Hygiene; Passive Range of Motion.
- Required skills/training/authorized nursing tasks are stored on worker assignment and care-plan provenance; do not infer an unlicensed caregiver may do a medical procedure.
- Link the monthly APC nursing evaluation; initial/special training can need additional visits; schedule from its actual RN authorizations and preserve the first-full-month training / 2-visit conditions in 3.15.
- Immediate-family restrictions as agency model. APC is not simply basic PC with a different code.

### R03 — Authorized Nurse Visits and GHE (3.15 + 08-26-01)

- One *visit*, never 15-minute billing units. Actual appointment length is editable; policy does not impose a minimum or maximum duration to constitute a visit.
- Maximum one authorized nurse visit per day and 26 visits in a six-month authorization period. Nurse provider change must account for the visits remaining in the original period.
- Recognize assessment/supervision, medication setup, insulin syringe fills, skin monitoring, nail care, other approved nursing tasks, APC evaluations, Train APC and GHE. Multiple nursing tasks can be combined into one visit unless separately necessary.
- Agency PC/APC need GHE in fourth and tenth month of assessment cycle; **do not create two extra visits** when GHE is performed during regular authorized nursing visit. RCF/ALF, CDS-only, ILW-only, ADW-only, ADCW-only, SFCW-only are excluded from universal semiannual GHE rule.
- Calendar offset: DHSS table maps January assessment to April and October. Therefore 4th/10th means the assessment month **counts as month 1**; do not add four and ten full months.
- GHE completion by RN or LPN with RN oversight, uploaded by next month 15th. If missed, alert to arrange next-month completion and necessary authorization correction; do not declare it reimbursable by default. Auto-generated reminders must not themselves create an approved nursing visit.
- APC: monthly RN evaluation; first full month of initial APC/added task and provider change can require Train APC; policy has distinct scheduling when weekly nurse visits already exist. Never create duplicate same-date overlapping nurse authorizations.

### R04 — RCF/ALF PC/APC/Nursing (3.20)

- Separate State Plan variants T1019U3, T1019U3 TF, T1001U3. Basic PC maximum 438/month.
- Only schedule assessed care **above** facility's already-required room/board, protective oversight, basic meal service and housekeeping. Different suggested times/criteria from home-based PC (e.g., special-diet dietary, enhanced medically related housekeeping).
- In-facility context must be explicit, not silently assigned a home visit; RCF/ALF ordinary GHE is not automatically required.
- Preserve distinct facility personnel and service authorization. Unsupported overlapping routine facility services → `REVIEW`.

### R05 — State Plan CDS (3.25)

- 15-minute units; 641/month published program cap; participant's imported authorization wins. Self-directed model permits many family attendants but not spouse/legal guardian; avoid general agency-family exclusion.
- Recognize all 25 tasks in HCBS-3c (including medically oriented but non-skilled permitted tasks) and distinct monthly Essential Transportation. Skilled nursing/therapies requiring licensed provider are not automatically CDS tasks.
- Transportation: estimate minutes/month by `minutes per occurrence × DSDS frequency factor`; HCBS-3c transport cells use `ROUNDDOWN(monthly_minutes/15,0)`; retain both raw authorized minutes and integer authorization units. Exclude waiting at appointments and NEMT-covered transport. Schedule only real transport task segments; never fabricate a 40-unit monthly appointment schedule when the frequency is missing.
- Do not schedule two CDS attendants against one code/participant at overlapping clock times. Distinct CDS and RN visit can overlap where explicitly permitted; do not infer all different services may overlap.
- Include temporary documented one-time schedule changes, but preserve approved monthly service authorization.

### R06 — ILW Personal Care and ancillary authorizations (3.55 + 05-25-01 + 06-26-01)

- ILW PCA `T1019U6` is 15-minute task-based, maximum 868 monthly units, plus the 49-hour/week legislative limitation. Full regulatory definition of the measuring *week* is not located in checked publications; show `REVIEW` for legal week certification, and calculate both standard fixed-week and rolling-seven-day diagnostic totals as **product protections**.
- ILW BFP approval and waiver enrollment/effective period should be tracked; do not infer ILW eligibility from a CDS task list.
- CDS and ILW share tasks for service delivery. Preserve separate source auth records, plus the mandated State Plan-first / ILW-later **funding sequence**. Compute a *proposed* switch only if imported authorization and cost thresholds support it; never label projected service delivery as actual delivered/billed service.
- Additional listed services: monthly Case Management and monthly Financial Management Services = `CONTEXT` with optional meetings; Specialized Medical Equipment / Supplies / Environmental Accessibility Adaptations = cost authorizations with optional delivery/installation events, never multiplied into caregiver hours.
- An ILW participant must not be simultaneously enrolled in another HCBS waiver over overlapping effective date ranges. Spouse/guardian rule applicability under ILW should be verified rather than copied from State Plan CDS without documenting source.

### R07 — ADW Homemaker (3.45)

- 15-minute units, task-based. Current sheet lists Clean Bath, Clean Kitchen, Clean Living Area, Essential Correspondence, Iron/Mend, Laundry, Make Bed/Change Linens, Meals/Dishes, Shopping/Errands, Trash and Wash Windows/Blinds.
- Homemaker authorization **does not equal** medically related household task authorization under agency Basic PC. A participant can have both as separate services when authorized, but prevent accidental duplicate assignment/counting of the same task instance.
- Priority of appropriate State Plan PC medically related household tasks before comparable ADW Homemaker. Household composition and facility exclusions matter in authorization; show review when unknown. Worker must satisfy agency restrictions.

### R08 — ADW Chore (3.35)

- 15-minute units; short-term/intermittent critical tasks, not automatically a repeating weekday care shift. Support requested calendar dates, appointment windows, task descriptions and task durations.
- The uploaded HCBS-3a contains an anomalous Chore formula on `N115` using `G115*L115/15`, while row 119 uses ordinary task frequency calculation. Preserve the actual imported authorization and mark worksheet-parity issue until formula intent clarified. Never make up a generic chore 7-day schedule.

### R09 — ADW Basic + Advanced Respite (3.50)

- Service is in-home short-duration relief for regularly involved informal caregivers; distinct from ordinary Personal Care or Homemaker.
- Basic `S5150` and Advanced `S5150TF`: each 15-minute based, but **shared aggregate** maximum 868 units/month and 49 hours/week across both (not 868 each). Both may appear in one participant plan; authorize/check combined caps.
- **Hard conflict:** respite intervals cannot overlap any other HCBS service for same participant; other HCBS can occur earlier or later *on the same day*. Validation must use exact intervals, not blanket same-day bans.
- Advanced respite care needs closer supervision / appropriate capability; caregiver of respite must meet agency restrictions. Do not mistake the family caregiver receiving relief for the paid respite aide.

### R10 — Adult Day Care via ADW and ADCW (3.51 / 3.31)

- Variants `S5100HC` (ADW) and `S5100HB` (ADCW); 15-minute attendance; at most 40 units = 10 hours/day, and at most five attendance days/week; cap of 920 monthly units noted by July Appendix 2.
- **Transport sublimit:** ≤120 minutes (8 × 15-minute units) per day may be associated with the ADC transportation component; included within authorized day allocation rather than treating transport as extra 10 hours.
- Distinguish eligibility/waiver type and attendance-setting location. Do not automatically import transportation as CDS Essential Transportation. Avoid duplicate overlapping attendance and personal care where coverage is not verified.
- Adult Day Care 3a validation permits wider input in some versions than the governing 5-day policy: implement the policy restriction, flag inconsistent sheet validation.

### R11 — Home Delivered Meals (3.40)

- `S5170` is **per meal**, max two meals/day; schedule recurring delivery dates, meal quantity, optional delivery time window and delivery route if supported. Never convert one meal to 15 min or force a visit-length calculation. Participant may receive other HCBS on same dates where authorized.
- Preserve ADW waiver rules and restrict double waiver enrollment. Optional delivery alerts do not claim service completed.

### R12 — SFCW (3.60)

- `S5126HB` one unit equals one 24-hour covered day; model as covered calendar days, **not** recurring 24-hour employee payroll shifts. Max one primary caregiver and named qualified substitute/backup plan.
- SFCW restriction is **more restrictive** than a generic one-waiver rule: Policy 3.60 says participant must not be receiving other HCBS State Plan **or** waiver services. Do not simultaneously schedule separate PC/CDS tasks within an active SFCW coverage interval and declare the schedule compliant.
- SFC primary/backup can be family or legal guardian; do not inherit CDS spouse/guardian prohibition or agency immediate-family prohibition.

### R13 — Non-Medicaid SSBG/GR protective services (3.70)

- Exceptional paper authorizations for protective-service situations; separately identify funding source and documents. Do not manufacture a Medicaid procedure code or assume Fusion monthly unit behavior. Schedule only the authorized service/time in the paper document, otherwise `UNSUPPORTED_REVIEW`. Track urgent verbally approved care distinctly from subsequently completed paper authorization.

## 4. Source-workbook formula engine (separate from actual schedule)

**HCBS-3a uploaded workbook actual formulas:** task rows `L11=G11*J11` (weekly minutes); `M11=L11/15` (weekly units); `I11=IF(J11="","",M11/J11)` (daily unit equivalent); `K11` lookup 1→5,2→10,3→15,4→19,5→23,6→27,7→31; `N11=IF(I11="","",ROUNDUP(I11*K11,0))` (monthly task units); `N30=SUM(N11,N14,N17,N20,N23,N26,N29)` (PC total); `N90=SUM(N69,N72,N75,N78,N81,N84,N87)` (APC total). When Household Tasks is checked, `N29=IF(Sheet2!L2=TRUE,SUM('HCBS-3a'!N33:N63),0)` and standalone Homemaker `N66=IF(Sheet2!L2=FALSE,SUM(N33:N63),0)`; the same tasks cannot land in both totals. Nurse visits `N96` are visit counts and `O96` applies visit rate. Home Delivered Meals `N106=IF(I106="","",ROUNDUP(I106*K106,0))`; **meal counts remain meals**, not time units. Chore `N115` anomaly requires a separate fixture.

**HCBS-3c uploaded workbook actual formulas:** `P11=(L11*N11)/15`; `M11=IF(N11="","",P11/N11)`; `Q11=IF(M11="","",ROUNDUP(M11*O11,0))`; transport `L88=ROUNDDOWN(F88/15,0)`; total `L93=SUM(...)`. CDS and ILW task formulas are structurally aligned; ILW includes additional cost-only lines. The 10 min daily × 31 day example gives 21 monthly units in these worksheets, not 31. Always compare derived with imported Fusion approved amounts and retain both if they differ.

**Calendar rule:** the DSDS factor represents a monthly authorization methodology, *not* the actual number of Mondays/Tuesdays in a calendar month. Generate actual dated occurrences, and check cumulative scheduled service minutes against the imported **month-specific** authorization. Fusion may prorate 7-day tasks in 28-, 29-, 30-day months; old Web Tool-migrated plans may only display a longest-month amount. Never silently assume the worksheet's 31-day estimate is an imported effective authorization for every month.

**Unit granularity:** Tasks of 5 or 10 minutes exist. Store integer minutes for each occurrence and independent whole authorized 15-minute units. Do not round up each task occurrence just to make it fit a billing unit. Within-month accumulated leftover minutes can be displayed using the official scheduling workbooks *once their formula parity is confirmed*; do not implement claims processing here.

## 5. Unified participant schedule data architecture

**Root:** `Participant` → many `CarePlans` → many `AuthorizationRecord`s (source service type, exact code+modifiers, issuer, authorization_id, provider, effective start/end, month buckets, program, waiver enrollment) → many `AuthorizedTask`s (stable ID, original Fusion label, normalized catalog ID, min/day, days/week, task notes, source anchor) → many `ScheduleOccurrences` (date, start/end, user changes, original task ID, authorization attribution, assigned caregiver, location, generation method). Additional `NurseVisit`, `DayCoverage`, `DeliveryEvent`, `NonTimeAuthorization`, `ComplianceFinding`, `RulePackVersion`, `SourceDocument`, and `SourceSnapshot` entities.

**Non-negotiable identity:** `service_code` alone is not unique (real Fusion care plan showed T1019 under both Agency and CDS-transport headers). Use composite authorization identity or a UUID with source provenance. `task_name` is never unique either. Different services may share `Bathing` or `Laundry`; they are different authorized tasks and may have different applicable policy.

**One participant, one calendar** with optional colored service bands; distinct ledgers are always preserved. Assigning a caregiver never changes a state authorization. A GHE must appear on the same participant calendar in its approved month (and with its nurse assignment) rather than the app showing a note saying GHE is excluded.

**Date and timezone:** use civil Missouri local dates for authorization validity and actual local start/end instants for assignment/time conflicts. Overnight visits span dates; preserve DST transition behavior; no use of `24 hours=96 Medicaid units` for SFC daily units. Validate unknown time zone/location as review.

**Enforcement levels:** `BLOCK` only when confirmed violation and required facts are known, `WARN` for uncommon but potentially valid scheduling, `REVIEW` where a key source, enrollment, staff qualification, or date definition is unresolved, `INFO` purely contextual. Drafts can always be saved; publication requires handling critical findings. Never show blanket compliant status with unresolved findings. A human override cannot authorize more state service units.

**Source audit fields:** extracted text/PDF page and confidence; original payer & codes; actual report month units; source document sha256; state policy URL/revision; task allocation; edit reason; and generation version. Never send participant identifiers to AI telemetry or log lines without a valid agreement and access policy.

## 6. Fully specified program behavior / inference precedence

1. Parse **whole** care plan and collect all sections, not just first `PC - CDS` or `PC - Agency` block.
2. Preserve raw authorization record and exact monthly record from Fusion; no rewrite.
3. Identify service by provider + source header + program + full code/modifiers + task context. Ambiguous mapping → `REVIEW` with original text visible.
4. For all known tasks, use exact worksheet label as canonical display; alternative Fusion names should map via versioned aliases and retain original label.
5. Resolve participant’s multiple same-program authorizations by unique approval IDs and overlapping effective dates; revisions should retire superseded time spans only when source confirms.
6. Build one schedule with two layers: a participant calendar of **tasks/visits** and a separate monthly **service authorization ledger**.
7. Recurring template is a scheduling aid; exceptions such as changing days, urgent illness, holidays, hospitalization, temporary support, unavailable staff and revised tasks are explicit date-specific variants.
8. Timed visits must reconcile task minutes, staffing qualifications, site, allowed concurrency, funding attribution and service code. No automatic blending of minutes across service codes.
9. Keep administrative/actual-cost authorizations in an “Other Authorized Supports” panel with optional events; they must not generate false shifts.
10. Exports must include the unified schedule and a per-service ledger/legend; do not print an unverified legal compliance seal.
11. Parser cannot drop a recognized but unschedulable service: user should see **recognized 21/21 service types; scheduled x; appointment needed y; context z; unrecognized n**.
12. Unknown payer/program codes must be preserved in a separate review list, never mapped heuristically to 'CDS' just because they reference personal care.

## 7. Blocking / warnings / unresolved facts to maintain in policy registry

| ID | Rule | How software responds | Evidence state |
|---|---|---|---|
| E-01 | Monthly authorized service units and effective period | BLOCK verified excess/expired proposed final visit | VERIFIED if imported monthly source known |
| E-02 | 49-hour ILW / respite week definition | Show fixed-week + rolling-7 diagnostics; never claim state-certified measuring week | WEEK DEFINITION UNRESOLVED |
| E-03 | Respite combined Basic/Advanced ≤868 units/month | BLOCK exceeding sum | VERIFIED |
| E-04 | Respite cannot overlap other same-person HCBS interval | BLOCK confirmed overlap | VERIFIED |
| E-05 | CDS attendants, same code/participant simultaneous visits | BLOCK | VERIFIED for CDS |
| E-06 | Different service types simultaneous | Confirmed service-pair matrix, unknown pairs REVIEW | MIXED |
| E-07 | One HCBS waiver at one time | BLOCK overlapping enrollment effective periods; not simply same month | VERIFIED rule, requires actual enrollment evidence |
| E-08 | SFCW no simultaneous other HCBS State Plan/waiver | BLOCK if matching actual verified enrollment/delivery | VERIFIED rule |
| E-09 | GHE authorized month, missed visit/correction | WARN followup; never fabricate nurse authorization | VERIFIED |
| E-10 | 3a/3c rounding vs Fusion | Store Fusion as source; flag discrepancy and source math | PARTIAL until actual Fusion equivalence validated |
| E-11 | Adult Day Care transportation component ≤120 min/day | BLOCK if authorized attendance breakdown known | VERIFIED |
| E-12 | 14a/b Excel scheduling parity | Leave as required acceptance gate | WORKBOOK BYTES NOT INSPECTED |
| E-13 | Agency receipt-to-first-service 10 calendar days | WARN if receipt date known; do not manufacture receipt date | REGULATION NEEDS LIVE CROSS-CHECK |
| E-14 | ILW spouse/legal guardian attendant eligibility | REVIEW until official source explicitly resolved | OPEN |
| E-15 | ADW respite service subtypes and legacy 3a `Nurse respite` label | Preserve, REVIEW if outside 2026 21-entry service list | OPEN (legacy worksheet metadata) |
| E-16 | Staff overtime >40h | WARN across employer's established payroll workweek; separate from participant Medicaid limits | PRODUCT RULE + federal law applicability |
| E-17 | Partial month / suspension / backdating | Valid-date filtering; imported monthly Fusion value; derived estimate flagged REVIEW | PARTIAL |
| E-18 | 3a Chore N115 / N119 inconsistency | Golden parity fixture / REVIEW | OPEN worksheet anomaly |

**Formal clarification topics to DHSS LTSS@health.mo.gov:** definition of 49-hour 'week'; week crossing month boundary; ILW attendant relation restrictions and delegation; Fusion/worksheet rounding for sub-15-minute daily tasks; partial-month/suspension proration; transport remainder and scheduling convention; official 14a/14b edition and formula behavior. These questions are not resolved just by choosing conservative software defaults.

## 8. Acceptance test plan, minimum scenarios

All tests carry real source fixture or synthetic label, expected outputs, policy ID(s), and version. Add the following at minimum:

- **INV-01**: All 21 service registry IDs recognized and mapped to exactly one allowed mode; each appears exactly once in the coverage report; none silently omitted.
- **INV-02**: All 51 worksheet source rows match the extracted label, cell, section, suggested duration and suggested frequency in the CSV; cross-reference each to service/task type; import both 3a and 3c.
- **INV-03**: Unknown provider code survives import verbatim and becomes `UNSUPPORTED_REVIEW`, not dropped.
- **INV-04**: `T1019` in Agency PC and CDS Transportation display headers yields two different authorization IDs. Prevent aggregate code-only merge.
- **CALC-01**: 3a 10 minutes × 7 days (31-month) → 21 units, worksheet-derived; show real month variants only if month-specific projection selected.
- **CALC-02**: 3a medically related household tasks under PC roll into PC amount exactly once; not also into ADW Homemaker.
- **CALC-03**: 3a APC 7-task total equal to sum of each task's rounded monthly units.
- **CALC-04**: 3c transport 90 min once a week → 450 min → 30 units; 14-minute monthly remainder → 0 whole units but preserve raw minutes.
- **CALC-05**: Derived task rounding `ceil((10/15)*31)=21` vs a known alternative `31` must be labeled source-specific; imported Fusion number always persists.
- **CALC-06**: February 28/29, 30-day and 31-day task expansion, 7-day daily frequency vs fewer-weekdays; no assumed 31 actual service days in February.
- **CALC-07**: Recurring weekly template with varied durations where weekly sum matches but one 31-day month exceeds authorization → BLOCK calendar excess.
- **CALC-08**: Show scheduled minutes and 15-minute authorized units separately, not per-task-round-up minutes.
- **JOIN-01**: De-identified multi-service real Fusion example: Agency PC 226 units/month, CDS Transportation 40, ADW Homemaker 5; GHE 1 in May and 1 in August. All five authorization records appear on one unified calendar; no source confusion.
- **JOIN-02**: Multiple providers and caregivers remain distinct even in one participant schedule.
- **JOIN-03**: Duplicate task label across two authorizations retains two unique task IDs.
- **JOIN-04**: Nurse visit may overlap CDS in a confirmed permitted case; respite overlap with any HCBS → BLOCK; unknown pairs → REVIEW.
- **RN-01**: GHE January assessment → April and October; no automatic GHE for RCF, CDS-only, ILW-only, ADW-only, SFCW-only.
- **RN-02**: Nurse visit is counted by visit and not minutes; max one/day and 26/6-month authorization.
- **RN-03**: Monthly APC Eval plus initial Train APC according to verified task and nurse authorization; do not generate two visits solely because same task label appears twice.
- **RN-04**: Missed authorized GHE generates follow-up/remediation warning; no automatic reimbursable replacement visit.
- **ADW-01**: Basic respite 500 + Advanced respite 500 = 1,000 units/month → BLOCK versus 868 shared.
- **ADW-02**: Respite 13:00–17:00 and PC 16:30–17:30 = BLOCK; PC at 12:00–13:00 = allowed same date.
- **ADW-03**: ADC 40 units/day and 5 days/week passes; 41/day or six days/week fails; transport 121 min/day fails.
- **ADW-04**: HDM 1–2 per day passes; 3 fails; convert no meal to work minutes.
- **ADW-05**: Chore one-time service date approved; no imposed 5-day recurring template.
- **SFC-01**: One SFC day = one covered day, not 96 time-based units; overlapping State Plan CDS authorization triggers incompatible-service issue based on verified effective periods.
- **ILW-01**: Separate CDS and ILW pools with common task set; project transition by imported State Plan source, avoid splitting/losing task instances; no made-up combined 868 ceiling.
- **ILW-02**: 49-hour tests spanning Sunday/Saturday, month end and year end; unknown official week → REVIEW status even when product diagnostic passes.
- **DATES-01**: Start/stop mid-month, suspended date spans, provider change, concurrent revision, expired authorization, future effective date, DST boundary, overnight cross-midnight visit.
- **STAFF-01**: Assigned caregiver cannot be simultaneously in two participants' homes; warn overtime above 40 hours across all clients.
- **SEC-01**: Browser quick mode does not upload personal plan without user action; PDF parsing/exports redact sensitive IDs in diagnostics; tenant isolation proof; no PHI in telemetry.
- **EXPORT-01**: PDF, CSV, spreadsheet, print render the **same** participant-level schedule, maintain source/authorization traceability, 21/21 coverage counts and review warnings.
- **SOURCE-01**: Rules cite effective dated source; if state updates policy, revalidate proposed schedules while preserving historical approved snapshot version.
- **WORKBOOK-01**: Appendix 14a/14b parity tests run only after genuine source XLSX files are acquired; no fabricated pass.

No real participant names, DCNs, phone numbers, or addresses belong in golden tests. Use anonymized realistic fixture data.

## 9. Future programs beyond DHSS Appendix 1 (separately scoped)

A complete claim for the **entire Missouri homecare industry** additionally needs:

- **Medically Complex Adult Waiver (MCAW; renamed from Medically Fragile Adult Waiver)**: specialized authorization for Private Duty Nursing, waiver attendant care, supplies/equipment, and some State Plan agency services. Administered under DHSS Special Health Care Needs, not simply DSDS Appendix 1. https://health.mo.gov/senior-disability-services/special-health-care-needs/medically-complex-adult-waiver-program
- **Brain Injury Waiver**: therapy, rehabilitation, assistive technology, home modifications and related services. Separate BIW manuals and authorization workflows. https://health.mo.gov/book/export/html/4761
- **DMH developmental disabilities waivers**: different authorizations and service definitions (e.g., Personal Assistant, Independent Supported Living, Day Habilitation, Community Networking, Employment). The current DD Waiver Manual is dated April 9, 2026. https://dmh.mo.gov/dev-disabilities/programs/waiver/manuals
- **Missouri licensed Medicare home health**: skilled nursing, PT, OT, speech, medical social work, home health aide; federal Conditions of Participation and clinical plan-of-care visit frequencies, not a DSDS 15-minute unit policy. https://health.mo.gov/providers/home-care/three-types-care-home and https://health.mo.gov/providers/home-care/laws-regulations-manuals
- **Hospice and private-pay nonmedical home care**: separate service agreements, duration/frequency, caregiver qualifications, on-call and staffing requirements; do not claim Medicaid waiver certification for them.

These must be acknowledged by `EXTERNAL_UNKNOWN` recognition and a visible program message in release 1. Do not silently repurpose DSDS rules for them. Only add their enforcement after reading their own current manuals.

## 10. Publication standard / what 100% means

An initial production release can truthfully claim **100% recognition of all 21 July 2026 DHSS Appendix 1 service-code entries** only when INV-01 passes. It can claim **complete 3a/3c source task catalog coverage** only when INV-02 passes. It **cannot** claim all possible cases are legally compliant until 14a/14b workbooks, Fusion parity, relevant ambiguities and integration tests have been reconciled.

The software must show a coverage result similar to: `21/21 known Missouri Appendix 1 services recognized | 10 time-scheduled | 4 date-specific appointments/events | 7 administrative / non-time authorizations | 0 unrecognized | 2 policy reviews required`. The numbers here are **illustrative**, never hardcode these values: compute them from the actual imported document and registry.
