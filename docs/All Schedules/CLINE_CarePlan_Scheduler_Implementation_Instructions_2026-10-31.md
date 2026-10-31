# Cline / VS Code — CarePlan Scheduler comprehensive Missouri scheduling build instructions

**Status:** Implementation instructions prepared for owner review and sign-off. Do not push a major rewrite or alter the live production schedule engine before source-code reconciliation, test fixtures, and explicit authorization.  
**Scope:** Make participant-level unified scheduling recognize **all 21 July 2026 DHSS/DSDS Appendix 1 service entries** and **all 51 3a/3c worksheet task/control rows**. Existing private-payer, DMH, MCAW, BIW, Medicare home-health and hospice programs are handled as explicit **external/unsupported-review programs** until separately verified.

Read and use the accompanying files as hard reference inputs:

- `CarePlan_Missouri_Regulatory_and_Scheduling_Blueprint_2026-10-31.md` — rules, authoritative links, unresolved findings, test cases.
- `CarePlan_Service_Registry_2026-10-31.json` — machine-readable current DHSS service registry.
- `CarePlan_Official_Tasks_3a_3c.csv` — 51 exact workbook source row names/cells, typical times/frequencies.
- Uploaded source worksheets `4.00appendix3da3aform.xlsx`, `4.00appendix4da-3cform_0 (3).xlsx`.
- De-identified participant Fusion PDF fixture showing PC, CDS Transport, Homemaker and two GHE authorizations.

## A. Non-negotiable product requirements

1. A participant has **one master schedule** displaying **all applicable authorized services**. Individual service filters are available but are NOT separate disconnected schedules.
2. All source authorizations remain independent (including monthly counts, code/modifiers, effective dates, provider, service type and approval ID). The master calendar must not merge the authorization ledgers.
3. Services—not participants—set schedule mode. Timed tasks, nurse visits, attendance, meals, daily coverages, administrative monthly authorizations and cost-only supplies can coexist.
4. Recognize all 21 service registry IDs. No unsupported/unknown service may disappear from the parsed source. An unknown record becomes a visible `UNSUPPORTED_REVIEW` card with the original source snippet and confidence.
5. Recognize all 51 source worksheet task/control rows. Do not treat a medically related household task control row as a separately schedulable duplicate task.
6. A task is assigned a stable UUID and attached to its unique authorization UUID; source labels/codes are provenance and cannot serve as unique primary keys.
7. No invented tasks, nursing visit authorizations, delivery visits, or payer units; preserve Fusion's authorized monthly count as the controlling value where available.
8. A complete calendar, PDF/print, CSV/XLSX and caregiver view all derive from the same normalized event list.
9. Unknown regulation is a REVIEW, not a fabricated BLOCK or a false PASS. Confirmed prohibitions produce a publication block; drafts remain editable/savable.
10. The app is *scheduling*, not billing/EVV/payroll. Actual delivery is outside scope; forecasts and funding-transition dates are explicitly projections.

## B. Before touching functional code — repo assessment

- Identify exact source commit/version of `careplan-scheduler.vercel.app/quick`; verify GitHub is in sync with deployed branch and environment configuration. Do not assume current remote or previous Scheduler Lite hotfix branch equals production.
- Inventory parser, units engine, rule packs, task matrix, calendar, GHE handling, import/export pipeline, Firestore/auth, security rules, test runner, CI and deployment environment.
- Record build/test baseline `npx tsc --noEmit`, `npm test`, `npm run build`, lint; failures documented with precise files/lines.
- Save a reversible baseline commit and redacted sample data fixtures. No secrets, participant DCNs, names, DOBs, addresses or phone numbers in tests, logs, screenshots or telemetry.
- Compare existing known service registry mappings to provided 21-entry JSON and 51-row CSV; produce a **Coverage Diff** table with `recognized / scheduled / appointment / context / missing / unknown` for every service.
- Report the code audit, migration plan, security considerations, and test additions **before** replacing core logic. Owner sign-off checkpoint.

## C. Phase 1 — authoritative registry and source parser

- Implement `ServiceRulePack` with `policyId`, `sourceUrl`, `revisedDate`, `effectiveFrom`, `effectiveTo`, `provenance`, `complianceConfidence`, `serviceCode/modifiers`, `program`, `billingUnitType`, `schedulingMode`, `tasks`, `restrictions`, and `tests`.
- Load versioned registry JSON. Normalize modifier syntax but preserve raw source code. Recognize Fusion labels such as `PC - Agency`, `PC - CDS`, `HC`, `GHE` and service-category variants. Never classify by procedure code alone.
- Parse **all pages/sections** of one PDF/text upload, with multiple provider IDs, authorizations, service types, rows and months. Extract start/end dates, report-generated date, authorized units per month, task frequencies/minutes, transportation monthly units and nursing visit counts.
- Create a source-provenance link to page+section for every extracted field. Implement an import review dialog that shows recognized services and unresolved entries.
- Unknown record must always be user-visible and selectable for manual mapping. Empty task frequency on a transport authorization means no auto-generated transport appointment; prompt a nonblocking schedule review.
- Tests INV-01 through INV-04, JOIN-01/02/03, and SOURCE-01 must pass.

## D. Phase 2 — deterministic service-specific calculators

- Port exact HCBS-3a and HCBS-3c worksheet calculations separately to pure TypeScript functions. Reference individual Excel cells in test fixture names.
- Use numerical precision sufficient for 5/10/15-minute tasks, whole authorized units, and per-task `ceil` only at source-specified stages. Avoid floating-point boundary errors by storing minutes as integers and using rational comparisons.
- Three separate ledgers: approved authorization, worksheet-derived estimate, and schedule allocation. Never let derived estimate replace an imported approval.
- Month-specific Fusion authorization records. Calendar actual dates govern occurrences; DSDS 5/10/15/19/23/27/31 factor governs worksheet-style estimates, not literal day counts.
- Agency PC medically related household switch must ensure household tasks appear only once in authorization math, either PC or Homemaker, per official 3a controls.
- Separate CDS transportation raw minutes, authorized whole units and allocated schedule minutes; retain unallocated remainder.
- Maintain ILW + CDS separate authorizations but shared care-task pool. Project State Plan-to-ILW allocation only if actual source and applicable cost/units are known.
- Avoid automatically implementing claims accrual/rounding, reimbursement or FMS billing logic in scheduling module.
- Golden tests CALC-01..08 must pass, including conflicting 10-minute tasks and exact imported 226-unit real Fusion example.

## E. Phase 3 — unified participant calendar

- Generate task-frequency-based **one master participant calendar**, with multiple service bands. Permit one/many visits a day, varied occurrence minutes, caregiver changes, user-defined transport days, nursing appointment windows, meal deliveries and covered-day services.
- Group adjacent tasks into visits only when same service, provider, worker, location, valid authorized time and permitted concurrency. Do not merge separate funding streams merely because tasks are adjacent.
- Use real dates, partial-month effective dates, suspensions, breaks, 29-Feb leap years, overnight visits and DST-safe date-time storage.
- Date-specific exceptions are immutable audit events on top of a versioned recurring template, not silent edits to authorization.
- Show per-service authorization balance and monthly planned minutes, next nursing requirement, remaining respite shared cap, coverage gap and exceptions.
- For GHE: schedule during imported authorized May/August-type months; no recurring 7-day GHE task, and no extra nurse visit solely to satisfy a reminder if existing authorized nurse visit covers it.
- PDF and print show unified participant schedule, with a separate source-coded authorization legend and review findings. Export retains exact same occurrences.
- Tests JOIN, DATES, RN, EXPORT must pass.

## F. Phase 4 — program restrictions and staffing

- Implement verified `ParticipantServiceCompatibility`, `CaregiverEligibility`, `Qualification`, `EnrollmentOverlap` and `TemporalConflict` matrix; include exact policy source and revision in every finding.
- Hard blocks: known expired/excess units, simultaneous same-person CDS attendants for same service, respite HCBS overlap, shared Basic/Advanced respite excess 868/month, verified disallowed caregiver family relationship, verified overlapping incompatible waiver enrollments, SFCW incompatible concurrent state plan/waiver, ADC day/transport caps, HDM >2/day, RN >1/day or >26/six months (subject to exact original authorization period).
- **49 h/week ILW/combined respite:** implement rolling and fixed-week *diagnostics*. Because official measuring-week definition is not established in the checked materials, surface policy review even if diagnostics pass. Do not certify legal weekly limit by choosing Sunday/Saturday unilaterally. When the actual authority is obtained, version the proper rule and upgrade severity.
- Overlapping different service types: use only explicitly verified pair permissions; unknown combinations `REVIEW` rather than automatic permit/block. Different employers may have overlapping event *dates* but actual simultaneous coverage requires applicable rules.
- Agency caregiver double-booking across multiple participants: product safety BLOCK. Potential worker >40 h/week: payroll-law WARN using agency-established workweek, distinct from waiver participant limit.
- Ensure non-time-based context services never create staff shifts. Nurse licensure/task qualification check cannot be replaced by a text-match of role names.
- Tests ADW, STAFF, ILW, SFC, RN and E-series violations must pass.

## G. Phase 5 — UX and completeness standard

- On the Quick Schedule page, change single-service result header to participant-level summary: `X service authorizations recognized / Y scheduled / Z events needing time / N administrative context / U unknown` and `all task rows recognized` where appropriate.
- Include import-review action `Review every authorization`, expandable raw source and classification. Unknowns must remain on the UI and every exported report.
- Provide participant weekly/monthly calendar, per-service authorization ledger, caregiver assignment board, coverage exception panel, required nurse visits/reminders, and non-timed supports panel.
- Allow participant/staff preference changes, one-time date changes, split shifts, nonuniform minutes and printable schedule without modifying original Fusion source.
- Accessible contrast, keyboard navigability, screen reader calendar view, print legibility and copy-safe source labels.
- User interface must never say `Missouri-approved`, `fully compliant` or claim a rule passed when a governing REVIEW remains unresolved.

## H. Security and environment

- Quick mode keeps file/text local by default; browser memory only unless explicit save/upload. Document parsing and PDF generation should be client-side where feasible for no-account mode.
- Agency mode: isolated tenant data, role-based access, least privilege, encrypted transport/rest, immutable audit trail, controlled document retention, no inadvertent PHI in analytics or vendor logs.
- Identify which third-party vendors handle PHI and whether the proposed configuration supports appropriate HIPAA business associate agreements and organization policies before using production patient data. Do not assume Vercel/Firebase deployment alone creates compliance.
- Tests SEC-01, tenant cross-access, export authorization and PII/PHI leakage.

## I. Source gaps and release gates

Do not claim any of the following are closed without evidence:

1. Appendix 14a and 14b XLSX actual formula and dropdown parity; video only is insufficient.
2. Official definition of 49-hour week and cross-month handling.
3. ILW attendant spouse/legal guardian restrictions and any exceptions.
4. Fusion math parity for fractional sub-15-minute tasks and partial-month/suspension cases.
5. Chore `N115` anomalous formula and any older 3a respite subtypes.
6. Service-specific concurrency for every unlisted service pair.
7. Any service outside the 21-entry July 2026 Appendix 1 universe.

The release may proceed with accurately labeled `REVIEW` restrictions when a safe manual scheduling workflow is allowed, but may **not** claim full state compliance or silently suppress a known service. If unresolved matter affects a confirmed legal prohibition and lacks enough data to assess a final schedule, gate publication and require qualified human review.

## J. Required deliverables back to the owner before release

1. Coverage diff for 21/21 Appendix 1 entries and 51/51 worksheet source rows.
2. State-policy traceability matrix: every rule with policy link, effective date, source line/section, applicability, tests and whether verified/partial/product-defined.
3. Deterministic TypeScript calculator with source-formula fixtures and results, not spreadsheet parsing at runtime.
4. Unified participant schedule based on de-identified multi-service fixture (PC 226, CDS transport 40, Homemaker 5, May/August GHE appointments).
5. App-level tests of imports, calendar edits, staffing conflicts, PDF/CSV/print parity, and unknown-preservation.
6. Migration/code audit, security review and deployment rollback.
7. Explicit unresolved state-guidance register and DHSS clarification questions.
8. Results from `npx tsc --noEmit`, `npm test`, `npm run build`, lint, integration and regression runs.

**Definition of Done:** For every July 2026 DHSS Appendix 1 service code, the app can import/recognize it and show one of the four supported classifications; every HCBS-3a/3c worksheet task/control source row is recognized; no service or sub-15-minute task vanishes; verified limits are enforced; unverified rules are visible; one master calendar and all exports agree. Production rollout requires a separate approval.
