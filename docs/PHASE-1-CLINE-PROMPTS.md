# CarePlan Scheduler — Phase 1 Cline Prompts (Rules Engine)

Paste these into Cline **one at a time, in order**. Start the next prompt only after Cline
reports `tsc` clean and all tests passing for the current one. Every prompt works on the
branch `phase-1-engine`.

---

## Before Prompt 1 (you, once)

1. On GitHub create an empty **private** repo named `careplan-scheduler` (no README).
2. In VS Code: `git clone https://github.com/<your-account>/careplan-scheduler.git` and open the folder.
3. Unzip careplan-scheduler-cline-pack.zip into the repo root so it looks like:
   ```
   careplan-scheduler/
     .clinerules
     docs/ENGINE-SPEC.md
     docs/PHASE-1-CLINE-PROMPTS.md   (this file)
   ```
4. In the VS Code terminal:
   ```
   git add -A
   git commit -m "docs: add engine spec, Cline rules and phase 1 prompts"
   git push -u origin main
   git checkout -b phase-1-engine
   ```
5. Check `node -v` shows v22.x.

---

## Prompt 1 — Workspace scaffold and CI

```
Read .clinerules and docs/ENGINE-SPEC.md first.

Task: scaffold the npm workspace and the engine package. No engine logic yet.

Create exactly:
1. Root package.json: name "careplan-scheduler", private true, "workspaces": ["packages/*"],
   scripts: "test": "npm run test -w @careplan/engine", "typecheck": "npm run typecheck -w @careplan/engine".
2. packages/engine/package.json: name "@careplan/engine", version "0.1.0", type "module",
   main "src/index.ts", scripts: "test": "vitest run", "typecheck": "tsc --noEmit".
   devDependencies pinned exactly: typescript 5.9.3, vitest 3.2.4, @types/luxon 3.4.2.
   dependencies pinned exactly: luxon 3.5.0.
3. packages/engine/tsconfig.json: target ES2022, module ESNext, moduleResolution Bundler,
   strict true, noUncheckedIndexedAccess true, exactOptionalPropertyTypes false,
   include ["src", "test"].
4. packages/engine/vitest.config.ts: test.include ["test/**/*.test.ts"].
5. packages/engine/src/index.ts exporting nothing yet except `export const ENGINE_VERSION = "0.1.0";`
6. packages/engine/test/smoke.test.ts asserting ENGINE_VERSION === "0.1.0".
7. .gitignore: node_modules, dist, coverage, .DS_Store.
8. .github/workflows/ci.yml: on push and pull_request; ubuntu-latest; actions/setup-node@v4
   with node-version 22; steps: npm ci, npm run typecheck, npm test.

Run: npm install (root), then in packages/engine: npx tsc --noEmit and npx vitest run.
Commit on branch phase-1-engine: "chore(engine): scaffold workspace, engine package and CI".
Push the branch. Report the tsc and vitest summary lines.
```

---

## Prompt 2 — Types and the Missouri rule pack

```
Read .clinerules and docs/ENGINE-SPEC.md sections 2 and 3.

Task: add the domain types and the July 2026 Missouri rule pack. No calculations yet.

1. packages/engine/src/types.ts: copy the types from spec section 2 exactly.
2. packages/engine/src/rulepacks/types.ts: interfaces
   - ServiceDef { code: ServiceCode; program: ProgramCode; name: string; unit: "15min" | "visit";
     monthlyCeiling: number | null; combinedCeilingGroup?: "RESPITE"; weeklyHourLimit?: number;
     perDayMax?: number; perSixMonthMax?: number; requiresApproval?: boolean; source: string }
   - TaskDef { taskCode: string; name: string; aliases: string[]; programs: ProgramCode[];
     isTransport?: boolean }
   - OverlapRule = "allowed" | "prohibited" | "unknown"
   - RulePack { id: string; effectiveDate: string; daysPerMonthFactor: Record<1|2|3|4|5|6|7, number>;
     services: ServiceDef[]; tasks: TaskDef[]; overlap(a: ProgramCode, b: ProgramCode): OverlapRule; sources: string[] }
3. packages/engine/src/rulepacks/mo-2026-07.ts: export const MO_2026_07: RulePack with
   id "mo-2026-07", effectiveDate "2026-07-01", the factor table, every service row from the
   spec table, and every task from the spec task library with its aliases and programs.
   taskCode format: UPPER_SNAKE of the main name (e.g. "MEAL_PREP_EATING"). When the same
   task name exists for CDS and for the agency model, use ONE taskCode with both programs.
   overlap(): CDS+NURSE "allowed"; any pair including RESPITE (other than RESPITE itself)
   "prohibited"; identical programs "prohibited"; everything else "unknown". Order-insensitive.
4. packages/engine/src/rulepacks/lookup.ts: findTaskByName(pack, name) (case-insensitive,
   matches name or any alias, returns TaskDef | undefined) and serviceByCode(pack, code).
5. Tests in packages/engine/test/rulepack.test.ts:
   - factor table equals {1:5,2:10,3:15,4:19,5:23,6:27,7:31}
   - ceilings: T1019U2 641, T1019 412, T1019U6 868, S5150 and S5150TF in group RESPITE with 868
   - findTaskByName("Asstance with Toileting") and ("Asst. with Toileting") return the same taskCode
   - overlap("CDS","NURSE") = "allowed"; overlap("RESPITE","CDS") = "prohibited";
     overlap("AGENCY_PC","HOMEMAKER") = "unknown"; overlap is symmetric
6. Export everything from src/index.ts.

Run tsc and vitest. Commit: "feat(engine): domain types and MO 2026-07 rule pack". Push.
```

---

## Prompt 3 — Unit math (F-1 to F-6)

```
Read docs/ENGINE-SPEC.md section 4.

Task: implement the unit math as pure functions in packages/engine/src/math/.

1. factors.ts: factorFor(dpw); maxWeekdayOccurrences(year, month, k) = the largest sum of
   the k highest weekday counts in that month.
2. units.ts:
   - hcbs3cTaskUnits(minPerDay, dpw) → F-2a, integer math, ceil.
   - workbookTaskUnits(weeklyMinutes, timesPerWeek) → F-2b using the integer guard in spec
     section 4 (num = weeklyMinutes*factor, den = timesPerWeek*15, trunc((num + 0.99*den)/den)).
   - monthTaskUnits(weeklyMinutes, timesPerWeek, daysInMonth) → F-3.
   - daysInMonth(year, month).
   Each returns { units, source: "derived", method } where method is
   "hcbs3c-roundup" | "workbook-trunc099" | "short-month".
3. transport.ts: transportAllowance(minPerTrip, tripsPerWeek) → { minutesPerMonth, units,
   unallocatedMinutes } (F-4).
4. display.ts: dayUnits(minutes) → { units, remainder } (F-5).
5. Tests (packages/engine/test/math.test.ts), one describe block per TC, exact values from
   spec section 7: TC-02, TC-03, TC-04 (assert F-2a = 474 only), TC-05, TC-06, TC-12
   (loop every month 2026-01..2036-12, k = 1..7), TC-20, TC-37 (F-2b 18, F-2a 19), and the
   TC-01 authorization numbers: 181 / 177 / 169 / 173 and the 12-month total 2,144 for
   Sep 2025–Aug 2026 (sum of monthTaskUnits over the five TC-01 tasks per month).

Run tsc and vitest. Commit: "feat(engine): authorization unit math F-1..F-6 with acceptance tests". Push.
```

---

## Prompt 4 — Calendar expansion and time handling

```
Read docs/ENGINE-SPEC.md sections 4 (F-6, F-7, F-9) and 5 (SCH-15).

Task: packages/engine/src/calendar/.

1. expand.ts:
   - weekdayCounts(year, month) → number[7] (Sunday index 0).
   - expandMonth(template, exceptions, year, month, validFrom, validTo) →
     Record<date, Record<taskId, minutes>> for every date in the month inside
     [validFrom, validTo], applying exceptions (minutesDelta, never below 0).
   - monthTaskMinutes(expanded) → Record<taskId, minutes>.
2. usage.ts: usageMeasures(template, months: string[]) → { weeklyBaselineUnits,
   calendarMinutes, monthlyWholeUnits, monthEndRemainderMinutes } (F-6), each separate.
3. time.ts (the ONLY file allowed to import luxon):
   - elapsedMinutes(startLocal, endLocal) in zone America/Chicago.
   - splitByDate(startLocal, endLocal) → Record<date, minutes> using real elapsed time.
4. weeks.ts: sundayWeeks(dailyMinutes: Record<date, number>) → { weekStart, minutes }[];
   rollingWindows(dailyMinutes) → { start, end, minutes }[] for every 7-day window.
   Neither resets at a month or year boundary.
5. Tests (packages/engine/test/calendar.test.ts): TC-01 day totals [70,90,90,90,90,90,70],
   590 weekly, weekly baseline 2,028, calendar minutes 30,770, monthly whole units 2,047,
   remainders 65, Sep 2025 = 169 units + 5; TC-27; TC-28; TC-11 week = 2,940 min;
   TC-25 week = 3,150 min; TC-26 Sunday weeks 2,940 and 2,940, max rolling window 4,200.

Run tsc and vitest. Commit: "feat(engine): calendar expansion, DST-safe time and week windows". Push.
```

---

## Prompt 5 — Composer port

```
Read docs/ENGINE-SPEC.md section 6.

Reference implementation (read only, do not copy files across repos wholesale):
https://github.com/E7104z/cds-cloud/blob/master/scheduler-lite/scheduler-lite/src/features/careplan/carePlan.person.ts
If you cannot open it, implement section 6 exactly as written.

Task: packages/engine/src/compose/composeWeek.ts exporting composeWeek(input) per spec
section 6, keyed by task id (never task name).

Tests (packages/engine/test/compose.test.ts):
- TC-09: active [true,false,true,false,true,false,true], tasks Toileting 15×7, Meal
  Prep/Eating 45×7, Bathing 30×3, Laundry (Home) 30×2; override Bathing → [0,2,4].
  Entries only on weekdays 0,2,4,6; Bathing exactly on 0,2,4.
- Auto placement never exceeds daysPerWeek for any task.
- dayTotals equal the sum of each day's entries.
- TC-31: two tasks named "Bathing" with different ids (CDS and AGENCY_PC); an override for
  the CDS id leaves the agency task's days unchanged.

Run tsc and vitest. Commit: "feat(engine): task-id composer ported from Scheduler Lite". Push.
```

---

## Prompt 6 — Authorization and schedule rules

```
Read docs/ENGINE-SPEC.md section 5 (Authorization and Schedule tables).

Task: packages/engine/src/rules/auth.ts and sch.ts. Each rule is its own exported function
named ruleAUTHxx... / ruleSCHxx... returning ValidationResult[], with @rule and @source JSDoc.

Implement: AUTH-03, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-11 (F-8 projection),
AUTH-12, SCH-02, SCH-03, SCH-08, SCH-11, SCH-12, SCH-14.

Tests (packages/engine/test/rules-auth-sch.test.ts) with expected severities from spec
section 7: TC-10 (projection day 18, 24 SP + 4 ILW; none when ILW missing), TC-16
(SCH-08 BLOCK and SCH-03 WARN), TC-17 (AUTH-09 BLOCK), TC-21 (SCH-12 REVIEW), TC-22 and
TC-24 (SCH-14 BLOCK), TC-37 (AUTH-03 REVIEW), plus: SCH-02 BLOCK when Bathing authorized
3×/wk is on 4 template days, WARN when on 2; AUTH-07 REVIEW when derived 181 vs imported 180;
AUTH-12 BLOCK for ILW units with state "pending_approval".

Run tsc and vitest. Commit: "feat(engine): authorization and schedule rules". Push.
```

---

## Prompt 7 — Conflict and eligibility rules

```
Read docs/ENGINE-SPEC.md section 5 (Conflicts and eligibility table).

Task: packages/engine/src/rules/con.ts with CON-01, 02, 03, 04, 05, 06, 07, 09, 10, 13,
16, 17 as separate exported functions with @rule and @source JSDoc. Overlap tests use
visit time ranges (end exclusive). CON-05 takes the tenant workweek start day as a parameter.

Tests (packages/engine/test/rules-con.test.ts): TC-07, TC-08 (a, b, c), TC-11 (no result),
TC-13, TC-14, TC-15, TC-18, TC-25 (REVIEW), TC-26 (WARN only), TC-29, TC-30, TC-32, TC-33,
TC-35, and CON-13: first AGENCY_PC visit 12 days after receivedDate → WARN; no receivedDate → REVIEW.

Run tsc and vitest. Commit: "feat(engine): conflict and eligibility rules". Push.
```

---

## Prompt 8 — Validate entry point, traceability and pull request

```
Task:
1. packages/engine/src/validate.ts: validateSchedule(input) that runs every rule, attaches
   rulePackVersion to each result (AUTH-13), and returns results sorted BLOCK, REVIEW, WARN, INFO.
   Input type: { pack, authorizations, monthlyAuthorizations, template, exceptions, visits,
   caregivers, enrollments, months, tenantWorkweekStart }.
2. packages/engine/src/index.ts exports the public API only: types, MO_2026_07, math,
   calendar, composeWeek, rule functions, validateSchedule.
3. docs/RULE-MAP.md: table of every rule ID → file → function → test file → TC IDs.
   Every rule in ENGINE-SPEC section 5 must appear; list any TC from section 7 without a test.
4. packages/engine/test/validate.test.ts: TC-01 plan with a matching template returns no
   BLOCK and no REVIEW for September 2025 when Fusion units equal derived units.
5. Run npx tsc --noEmit and npx vitest run; paste both summaries.
6. Commit: "feat(engine): validateSchedule, rule map". Push.
7. Open a pull request from phase-1-engine to main titled "Phase 1: rules engine" whose
   body lists every TC with pass/fail and links docs/RULE-MAP.md. Do not merge.
```

---

## After Prompt 8 (you)

1. Check the CI run on the pull request is green.
2. Send Claude the pull request link. Claude reviews it against the spec before you merge.
3. Merge only after that review. Phase 2 prompts (app shell, login, Quick Schedule) follow.
