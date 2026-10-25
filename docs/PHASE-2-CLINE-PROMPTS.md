# CarePlan Scheduler — Phase 2 Cline Prompts (App shell, accounts, Quick Schedule)

Paste these into Cline **one at a time, in order**. Start the next prompt only after Cline
reports every check in the prompt's "Finish" list passing. Every prompt works on the branch
`phase-2-app`, which already holds the Phase 2 docs.

Read first, in this order: `.clinerules`, `docs/APP-SPEC.md`, `docs/IMPORT-SPEC.md`,
`docs/ENGINE-SPEC.md`, then open `docs/design/quick-schedule-prototype.html` in a browser and
paste one of `docs/fixtures/fusion/*.txt` into it. That page runs the real engine, the Fusion
reader and the guard; it is the look and behavior every Quick Schedule prompt is aiming at.

Order: 1 engine · 2 import package · 3 web scaffold and UI kit · 4 public site ·
5 Quick Schedule logic · 6–7 Quick Schedule screens · 8 sign-in · 9 agencies · 10 team ·
11 accessibility, phones and the pull request · 12 Windows desktop app (after the merge).

**Review decisions (Oct 23, 2026, after Prompt 5).** Already built on `phase-2-app` and written
into APP-SPEC; Prompts 6 and 7 below were adjusted to match.
- Guard: a change is refused only if it adds a **new** Must-fix result (APP-SPEC 5.7). A plan
  that itself breaks a rule can still be edited; the edit can't add a break of its own.
- Every person-made change goes through the guard, including service, plan start and adding or
  removing a task. A plan read from Fusion ignores the by-hand-only actions.
- QS-07 / QS-10: unselecting a task's last day takes it off the week (so a 1-day task can be
  moved); a minute change is dropped when its task moves to another day.
- Public pages are lazy chunks. check-bundle measures the entry and each public page (entry +
  page chunk) against 180 KB, and walks the manifest's real import graph. The header's phone
  navigation is a disclosure, not a Radix menu. The font is preloaded.
- Ready for the screens: `checksumLines` (quick-schedule/checksumText.ts), `cellRefusal`
  (guard.ts), Textarea `onPasteText`, DayToggle `label`, UnitTiles `activeDays` ("Off").
- Landing headline figure = the example plan's Day total row with its computed status.
- The unrequested APP-SPEC edits in the Prompt 4 commit (title separator "|", the landing
  refusal text, the week figure written with commas) are accepted as they are.
- npm audit: vitest 3.2.7 doesn't clear the vitest advisories (fixed in 4.1.12+). Phase 2 stays
  on 3.2.7 (dev only; see APP-SPEC section 1); upgrading is its own change after the merge.

**Review decision (Oct 24, 2026, Prompt 10).** firestore.rules and APP-SPEC section 8: the invites
`read` rule now checks `verified() && resource.data.email == myEmail()` before
`isOwner(resource.data.tenantId)`. The verbatim order denied the "pending invites for me" query
(7.2), so the invite banner couldn't load. Same access either way; rules test R-18 covers it.

**Review decisions (Oct 25, 2026, after Fusion's care plan report).** Built on `phase-2-app`
and written into APP-SPEC, ENGINE-SPEC (Amendment B) and IMPORT-SPEC.
- CON-13 is left out of Quick Schedule. The engine has a second entry point, `validatePlan`,
  that runs only the plan rules (AUTH-*, SCH-02/03/08/11/12); Quick Schedule and the landing
  page call it. CON-13 checks the first visit, and Quick Schedule doesn't schedule visits, so
  agency plans no longer show "Referral date is missing".
- AGENCY_PC gains the household tasks Fusion lists under PC - Agency ("Med Rel HC Tasks"):
  Clean Bath, Clean Kitchen, Clean Living Area, Laundry, Make Bed/Change Linens,
  Shopping/Errands, Trash. They stay Homemaker tasks too. Iron/Mend, Meals/Dishes, Wash
  Windows/Blinds and Essential Correspondence stay Homemaker only (not seen under PC - Agency).
- `/quick` budget: the import reader was not the problem (about 4 KB, and the example plan
  needs it on first paint). luxon was 21 KB gzip on `/` and `/quick`, used only for visit time.
  With `validatePlan` it is gone from public pages: `/quick` 154.5 KB, `/` 125.2 KB.
  check-bundle now fails if luxon reaches a public page.
- The slow grid test: role queries now look inside the weekly grid (named "Weekly schedule")
  instead of the whole page, and QS-10's two scenarios are two tests. The 15 s timeout is gone.
- AUTH-09 (found going through the app): a plan built by hand had no ceiling check. 70 hours
  a week on agency personal care (1,240 units a month; ceiling 412) showed "Ready to use" and
  "Follows every rule we check". A month with no imported figure is now checked on its derived
  units, as WARN "More units than this service allows". Not BLOCK: the same check covers an
  imported plan's partial months, which Fusion authorized, and a standing BLOCK whose numbers
  change refuses every edit. Say if plans built by hand should get a BLOCK instead.
- Also from going through the app: on a phone a plan with 15 tasks put the status about 5,200 px
  down, so one column now has "Skip to the schedule" above the care plan; "Plan starts" says how
  to enter a month when it's left with something else (Safari and Firefox show a text box);
  the Rules page says Quick Schedule doesn't run the visit checks.

---

## Before Prompt 1 (you, once, about 30 minutes)

**GitHub**
1. Settings → Billing: clear the billing lock. Until then GitHub Actions won't start any job,
   so CI shows red without running.
2. Repo Settings → General → Default branch: change `phase-1-engine` to `main`.
3. Repo Settings → General → Danger Zone → Change visibility → **Private** (the product is
   commercial and the repo now holds your spec and Firebase project details).

**Firebase console** (project `care-plan-scheduler`)
4. Build → Authentication → Get started.
   - Sign-in method: enable **Email/Password** (not passwordless) and **Google** (support
     email: info@thecdscloud.com).
   - Settings → Password policy: require at least **12** characters, enforce.
   - Settings → User actions: keep **Email enumeration protection** on.
5. Build → Firestore Database → Create database → **Production mode** → location
   **nam5 (United States)**. The location can't be changed later.

**Vercel** (team "jasonhgriffin-6085's projects")
6. Add New → Project → import `E7104z/careplan-scheduler`. Project name
   `careplan-scheduler`. Leave Root Directory as the repo root and Framework as "Other";
   `vercel.json` (added in Prompt 3) supplies the install, build and output settings.
   The first deploy of `main` fails until Phase 2 is merged. That's expected.
7. Note the production domain Vercel gives you (normally `careplan-scheduler.vercel.app`) and
   the branch domain for `phase-2-app`
   (`careplan-scheduler-git-phase-2-app-jasonhgriffin-6085s-projects.vercel.app`).

**Firebase → Authentication → Settings → Authorized domains**: add both domains from step 7.
Google sign-in only works on listed domains. (`localhost` is listed by default.)

**Google Cloud console → APIs & Services → Credentials** (project `care-plan-scheduler`):
open the "Browser key (auto created by Firebase)" → Application restrictions → Websites:
`https://careplan-scheduler.vercel.app/*`, `https://*-jasonhgriffin-6085s-projects.vercel.app/*`,
`https://care-plan-scheduler.firebaseapp.com/*`, `http://localhost:5173/*`,
`http://127.0.0.1:5173/*`, `http://localhost:4173/*`. Save.

**Your computer**
8. `java -version` must show 21 or later (the Firestore emulator needs it). If not, install
   Eclipse Temurin 21 from adoptium.net and reopen VS Code.
9. `node -v` shows v22.x.
10. In VS Code's terminal:
    ```
    git fetch origin
    git checkout phase-2-app
    git pull
    npm ci
    npx firebase login
    ```
    (`firebase-tools` arrives with Prompt 3; if `npx firebase login` asks to install it,
    run it again after Prompt 3.)

---

## Prompt 1 — Engine: rule catalog and Amendment A

```
Read .clinerules, docs/ENGINE-SPEC.md (Amendment A at the top, section 5 including SCH-17,
section 7 TC-38 to TC-40) and docs/APP-SPEC.md D-12 first.

Task: four engine changes. No app code.

1. RULE_CATALOG. packages/engine/src/rulepacks/catalog.ts exports:
     export type RuleArea = "Authorization" | "Schedule" | "Conflicts and eligibility";
     export type RuleStatus = "VERIFIED" | "VERIFIED (CDS)" | "VERIFIED basis" | "PARTIAL" | "APPROVED" | "OPEN";
     export interface RuleCatalogEntry {
       id: string; area: RuleArea; rule: string; severities: Severity[];
       status: RuleStatus; source: string;
     }
     export const RULE_CATALOG: readonly RuleCatalogEntry[]
     export function ruleById(id: string): RuleCatalogEntry | undefined
   One entry per row of ENGINE-SPEC section 5, in table order, with rule, status and source
   copied character for character. severities from the Severity column ("BLOCK / WARN" →
   ["BLOCK","WARN"]; "per matrix" → ["BLOCK","REVIEW"]; "—" → []).
2. CalendarException gains `kind?: "change" | "fit"` (src/types.ts, exactly as ENGINE-SPEC
   section 2). ruleSCH11RepeatedExceptions skips exceptions with kind "fit".
3. SCH-17. packages/engine/src/rules/fit.ts exports
     fitToAuthorization(template: ScheduleTemplate, auth: ServiceAuthorization,
       monthlyAuthorizations: MonthlyAuthorization[], months: string[]): CalendarException[]
   with JSDoc `@rule SCH-17` and `@source Product decision approved Oct 21, 2026 (schedules
   never exceed SCH-08)`, implementing the SCH-17 row exactly:
   - only months that have a MonthlyAuthorization with source "fusion" for auth.id;
   - budget = max(0, fusion units − monthTransportUnits(auth)) × 15;
   - scheduled = all template minutes on dates inside [auth.start, auth.end] in that month
     (expandMonth with no exceptions);
   - while over > 0, walk the month's dates from last to first; on each date order the
     entries by task daysPerWeek descending, then minutes descending, then taskId
     ascending; cut min(over, entry minutes) from each;
   - each cut → { id: `fit-${date}-${taskId}`, participantId: auth.participantId, date,
     taskId, minutesDelta: −cut, reason: "Units for the month run out",
     author: "CarePlan Scheduler", createdAt: "", kind: "fit" }.
   Export it from src/index.ts. It is not called by validateSchedule (the app passes its
   result as exceptions).
4. Rule pack: add alias "Essential Correspond" to ESSENTIAL_CORRESPONDENCE.

Tests:
- test/catalog.test.ts: parse the three tables under "## 5. Rules" in docs/ENGINE-SPEC.md
  (read the file with node:fs relative to the test file) and assert RULE_CATALOG has the same
  IDs in order and identical rule text, status and source; severities for AUTH-09
  ["BLOCK","REVIEW"], CON-02 ["BLOCK","REVIEW"], SCH-15 [], SCH-17 [], CON-17 ["REVIEW"];
  every ruleId literal in src/rules/*.ts is in RULE_CATALOG.
- test/fit.test.ts: TC-38, TC-39 and TC-40 exactly as ENGINE-SPEC section 7. For TC-38 build
  the 15 tasks and transport of docs/fixtures/fusion/B-tabbed-7day-455.txt by hand in the
  test (do not parse the file here): Assistance with Toileting 10×7, Bathing 45×7, Change
  Linens 10×7, Clean Bath 20×1, Clean Floors 20×1, Clean Kitchen 20×1, Dressing/Grooming 15×7,
  Essential Correspondence 30×1, Laundry (Off Site) 140×1, Meal Prep/Eating 60×7,
  Medications 5×7, Mobility/Transfer 10×7, Tidy and Dust 10×1, Trash 5×7, Wash Dishes 15×7,
  in that order with ids t1…t15; transportMinutesPerMonth 345.
  Also: a month without a Fusion figure is never trimmed; trims never make a minute count
  negative.
- test/sources.test.ts: add "SCH-17": "Product decision approved Oct 21, 2026 (schedules
  never exceed SCH-08)" to SOURCES. Change nothing else in that file.
- docs/RULE-MAP.md: add SCH-17 → rules/fit.ts → fitToAuthorization → test/fit.test.ts →
  TC-38, TC-39; add catalog.ts under a "Catalog" heading.

Do not change any other existing test or rule function.

Finish:
1. In packages/engine: npx tsc --noEmit and npx vitest run. Paste both summary lines.
2. Commit: "feat(engine): RULE_CATALOG, SCH-17 fit to authorization, fit exceptions". Push.
```

---

---

## Prompt 2 — Import package: read Fusion care plans

```
Read .clinerules (Import rules), docs/IMPORT-SPEC.md (all of it), and the reference
implementation docs/design/reference/fusion-parse.js first. Open every file in
docs/fixtures/fusion/.

Task: packages/import (@careplan/import), a pure TypeScript port of fusion-parse.js that
meets IMPORT-SPEC exactly. The reference shows the intended behavior; the spec wins.

1. packages/import/package.json: name "@careplan/import", version "0.1.0", type module,
   main "src/index.ts", scripts test "vitest run" and typecheck "tsc --noEmit".
   dependencies: "@careplan/engine": "0.1.0". devDependencies (exact): typescript 5.9.3,
   vitest 3.2.4, @types/node 22.20.5, pdfjs-dist 4.10.38. tsconfig and vitest config the same
   as packages/engine.
2. src/ (one concept per file, < 300 lines each):
   normalize.ts (IMP-01), banner.ts (IMP-02), paging.ts (IMP-03), serviceHeader.ts (IMP-04),
   rows.ts (IMP-05 to IMP-08), taskMatch.ts (IMP-09, uses the rule pack), services.ts (IMP-11
   label map), parse.ts (parseFusionText), merge.ts (mergeFusionText, IMP-12),
   pdfLines.ts (textItemsToLines, IMP-14; pure, takes PdfTextItem[][]), types.ts (section 3),
   index.ts (exports the public API only).
3. Issues exactly as IMPORT-SPEC 3.1 (codes, levels, message text as in the reference).
4. Tests in packages/import/test/, one file per area, covering IMP-T01 to IMP-T15 and IMP-T19
   exactly. For IMP-T14/T15 load the PDF fixtures with pdfjs-dist's legacy build
   ("pdfjs-dist/legacy/build/pdf.mjs", getDocument({ data, isEvalSupported: false })), map each
   text item to { str, x: transform[4], y: transform[5], width, height: |transform[3]| }, and
   call textItemsToLines. Fixture paths are resolved relative to the test file.
   For IMP-T19 spy on console.* and on globalThis.localStorage/sessionStorage (create stub
   objects if absent) and assert none were called across a full parse of every fixture.
5. Root package.json: the root "test" and "typecheck" scripts run every workspace
   (`npm run test --workspaces --if-present`, same for typecheck), if they don't already.

Finish:
1. From the root: npm install, npm run typecheck, npm test. Paste the summary lines for
   packages/engine and packages/import.
2. Commit: "feat(import): Fusion care plan reader with fixture tests". Push.
```

---

---

## Prompt 3 — Web workspace, design tokens, UI kit, deploy config

```
Read .clinerules and docs/APP-SPEC.md sections 1, 2, 4, 9 and 10 first.

Task: scaffold apps/web and build the UI component kit. No pages except a development-only
component gallery.

0. Security patch first: change vitest from 3.2.4 to 3.2.7 (exact) in packages/engine and
   packages/import, run `npm install --save-exact`, and confirm `npm audit` no longer lists
   vitest's own dependencies. This is the one allowed version change (the pinned list now
   says 3.2.7). Engine and import tests must still pass before you continue.

1. Root package.json: workspaces ["packages/*", "apps/*"]; scripts:
     "typecheck": "npm run typecheck --workspaces --if-present",
     "test": "npm run test --workspaces --if-present",
     "build": "npm run build -w @careplan/web",
     "dev": "npm run dev -w @careplan/web"
   devDependencies (exact): firebase-tools 14.27.0.
2. apps/web/package.json: name "@careplan/web", private, type module. Dependencies and
   devDependencies pinned exactly as in APP-SPEC section 1 (the "web" rows), plus
   "@careplan/engine": "0.1.0" and "@careplan/import": "0.1.0". Scripts:
     "dev": "vite", "build": "tsc --noEmit && vite build && node scripts/check-bundle.mjs",
     "preview": "vite preview", "typecheck": "tsc --noEmit", "test": "vitest run",
     "test:e2e": "playwright test --pass-with-no-tests",
     "test:e2e:emulated": "playwright test --pass-with-no-tests",
     "test:rules": "vitest run --config vitest.rules.config.ts"
   (Prompts 7 and 8 narrow the two e2e scripts to their projects.)
3. apps/web/tsconfig.json: target ES2022, lib [ES2022, DOM, DOM.Iterable], module ESNext,
   moduleResolution Bundler, jsx react-jsx, strict, noUncheckedIndexedAccess, skipLibCheck,
   noEmit, types ["vite/client", "@testing-library/jest-dom"], include ["src", "test",
   "e2e", "rules-test", "scripts", "*.ts"].
4. apps/web/vite.config.ts (import defineConfig from "vitest/config"): plugins react() and
   tailwindcss(); build.manifest true; build.target "es2022"; test: environment "jsdom",
   setupFiles ["./test/setup.ts"], include ["test/**/*.test.{ts,tsx}"].
   test/setup.ts: import "@testing-library/jest-dom/vitest".
5. apps/web/index.html: lang "en", meta viewport (width=device-width, initial-scale=1,
   viewport-fit=cover), meta theme-color for light (#F6F8F7) and dark (#0E1614), title
   "CarePlan Scheduler", favicon = the Logo mark as an inline SVG data URI, div#root,
   script src /src/main.tsx. No inline scripts (the CSP blocks them): main.tsx applies the
   saved theme before the first render.
6. Styles: copy docs/design/tokens.css to apps/web/src/styles/tokens.css VERBATIM.
   apps/web/src/styles/app.css: @import "tailwindcss"; @import "./tokens.css"; plus print
   base rules (@page { size: letter landscape; margin: 0.5in }).
   main.tsx imports "@fontsource-variable/public-sans/wght.css" and "./styles/app.css".
7. apps/web/src/ui: every component in APP-SPEC section 4.2, typed props, no default
   exports, Tailwind classes using only token names. Plus lib/cn.ts (clsx wrapper),
   lib/theme.ts (get/set "system" | "light" | "dark", localStorage key cps.theme, try/catch,
   sets data-theme on <html>), lib/storage.ts (safe sessionStorage/localStorage JSON
   helpers, every call in try/catch).
8. Development gallery: src/dev/Gallery.tsx showing every component in every variant and
   state (including disabled, busy, error), with a light/dark/system switch. main.tsx renders
   it at /dev/ui only when import.meta.env.DEV; production builds must not include it
   (dynamic import inside the DEV branch).
   Until Prompt 4, main.tsx renders the gallery in dev and a plain "CarePlan Scheduler"
   heading in production.
9. Tests (apps/web/test):
   - ui.test.tsx: each component renders with the right role and accessible name;
     DayToggle sets aria-pressed and full day-name labels; SeverityPill renders icon + word
     for all four severities; Button busy sets aria-busy and keeps the label for screen
     readers; Field wires aria-describedby and aria-invalid.
   - no-hex.test.ts: fails if any file under src/ except src/styles/tokens.css contains a
     hex color (/#[0-9a-fA-F]{3,8}\b/ outside import paths) or rgb( / hsl( literals.
10. scripts/check-bundle.mjs: APP-SPEC section 10. Reads dist/.vite/manifest.json, takes the
    entry for index.html plus its static `imports` recursively, gzips each file
    (node:zlib gzipSync), prints a table, exits 1 above 180 KB total or if any of those
    chunks' manifest `src` or file contents reference "firebase" package code
    (search the chunk text for "@firebase/" or "firebase/app").
11. vercel.json at the repo root: APP-SPEC section 9, verbatim.
12. .github/workflows/ci.yml: keep the existing job's steps and add, after `npm test`:
    `npm run build`. Add a second job "e2e" (needs: test) with actions/setup-java@v4
    (distribution temurin, java-version 21), npm ci,
    `npx playwright install --with-deps chromium`, then
    `npx firebase emulators:exec --only auth,firestore --project demo-careplan "npm run test:rules -w @careplan/web && npm run test:e2e -w @careplan/web && npm run test:e2e:emulated -w @careplan/web"`.
    The e2e and rules tests arrive in later prompts. Until then: vitest.rules.config.ts sets
    passWithNoTests, and the two e2e scripts are "playwright test --pass-with-no-tests" with a
    minimal playwright.config.ts (testDir e2e) that Prompt 7 and Prompt 8 extend.
13. .gitignore: add apps/web/dist, apps/web/test-results, apps/web/playwright-report,
    .env.local, firebase-debug.log, firestore-debug.log, ui-debug.log.

Finish:
1. From the repo root: npm install, npm run typecheck, npm test, npm run build. All pass.
   Paste the vitest summary and the check-bundle table.
2. npm run dev and open http://localhost:5173/dev/ui; confirm in your message that the
   gallery shows every component in light and dark.
3. Commit: "feat(web): workspace, design tokens, UI kit, deploy and CI config". Push.
```

---

## Prompt 4 — Public site: layout, landing, rules and sources, privacy

```
Read .clinerules and docs/APP-SPEC.md sections 3, 4 and 12 first.

Task: the public pages and the router. No Firebase.

1. src/router.tsx: createBrowserRouter (react-router 7, library mode) with the public routes
   from APP-SPEC section 3 (/, /rules, /privacy, and *). Public routes use PublicLayout.
   /quick arrives in Prompt 6 and the sign-in and /app routes in Prompt 8; leave them out
   now. Unknown paths render NotFound. The header's "Sign in" and "Create agency account"
   links point at /sign-in and /sign-up and show NotFound until Prompt 8.
2. PublicLayout: SkipLink; header (Logo linking to /, nav "Quick Schedule", "Rules and
   sources", right side "Sign in" (quiet) and "Create agency account" (primary) linking to
   /sign-in and /sign-up); main#main; footer per APP-SPEC section 12. Sticky header with
   safe-area top inset. Under 720px: nav collapses into a menu button (Radix DropdownMenu).
3. Focus and titles: on every navigation, focus the page's h1 (tabIndex -1) and set
   document.title "<Page> | CarePlan Scheduler" (Landing: "CarePlan Scheduler").
4. pages/Landing.tsx: APP-SPEC section 12. The live figure uses the engine: compose the
   TC-01 example week with composeWeek and render the Day total row with UnitTiles
   (create ui/UnitTiles.tsx: one 10px square per whole 15-minute unit, 4 per row, plus a
   partial square filled bottom-up by remainder/15; aria-hidden, with the minutes and units
   as visible text). Section figures 1, 2 and 4 are real output: section 1 parses fixture A
   (`?raw` import; add the resolve alias "@fixtures" → ../../docs/fixtures to vite.config.ts
   and tsconfig paths, and a `declare module "*?raw"` type if vite/client lacks it) with
   @careplan/import and compares
   its derived 30-day units with Fusion's 466 through the engine; section 2 is the composed
   TC-01 week; section 4 is one ruleById card. Section 3 is the static example refusal box
   from APP-SPEC section 12.
5. pages/Rules.tsx: APP-SPEC section 12, generated from RULE_CATALOG and MO_2026_07.
   Tables scroll horizontally inside their own container on phones.
6. pages/Privacy.tsx and pages/NotFound.tsx (h1 "We can't find that page", links to / and
   /quick).
7. Tests:
   - pages.test.tsx: Landing shows the headline, the match line with 466, and the
     engine-computed week "70, 90, 90, 90, 90, 90, 70"; Rules lists every RULE_CATALOG id and every
     15-minute service with its ceiling (AC-21); NotFound renders for /nope.
   - router.test.tsx: title and focus move on navigation.

Finish:
1. npm run typecheck, npm test, npm run build from the root. Paste summaries and the
   check-bundle table (must be under budget, no firebase).
2. Commit: "feat(web): public layout, landing, rules and sources, privacy". Push.
```

---

## Prompt 5 — Quick Schedule logic: model, guard, import flow, state (no UI)

```
Read .clinerules, docs/APP-SPEC.md section 5 (all of it), docs/IMPORT-SPEC.md sections 2–5,
and docs/design/reference/quick-model.js first. buildQuickModel must produce the same
numbers as the reference build().

Task: the pure logic behind Quick Schedule, fully tested. No components.

Files in apps/web/src/features/:
1. quick-schedule/types.ts: QuickState (APP-SPEC 5.6), QuickModel, MonthFigures, CheckGroup.
2. quick-schedule/model.ts: buildQuickModel(state, pack) per APP-SPEC 5.3 steps 1–10, using
   fitToAuthorization from @careplan/engine for step 8; monthFigures(model, ym) per step 11.
3. quick-schedule/guard.ts: tryChange and maxCellMinutes per APP-SPEC 5.7, and
   refusalText(blocks, state, model) with the four sentence forms.
4. quick-schedule/state.ts: reducer + actions for every input in APP-SPEC 5.2 (QS-01 to
   QS-12) in both modes, with their side effects (clearing cell changes, dropping pinned days,
   removing tasks on service change and returning their names, refusing a pinned set larger
   than daysPerWeek with its hint). Person-made actions return either the next state or a
   refusal from the guard; the reducer never commits a refused change.
   manualState(today) and the example states (fixtures A and B imported, isExample true).
5. quick-schedule/persistence.ts: load/save in sessionStorage key cps.quick.v2 without
   `identity`; validate shape; never throw.
6. quick-schedule/grouping.ts and ruleCopy.ts: APP-SPEC 5.5, copy table verbatim.
7. import/fromFusion.ts: IMPORT-SPEC section 4 (care days, transport day, weekly hint, view
   month) → QuickState with source "fusion". The import package returns taskCode null for a
   task not in the rule pack; fromFusion sets taskCode to `FUSION:<name>` for those (IMP-09).
8. import/importFlow.ts: a small pure state machine for the import panel: pages[] (IMP-12),
   choices { acceptPartial, serviceCode, serviceIndex, plan }, and next(): either
   { kind: "needs", issues } (hard stops from IMPORT-SPEC 3.1 still open) or
   { kind: "ready", state } (built through fromFusion, notes = the non-stopping issues plus
   "incomplete" when accepted). Duplicate tasks are dropped, keeping the first.
9. lib/format.ts: formatUnits, monthName, shortMonth, niceDate ("Dec 31, 2025").

Example fixtures A and B are imported as text with Vite's `?raw` import through the
"@fixtures" alias from Prompt 4. They are de-identified; they are the only built-in plans.

Tests (apps/web/test/quick/), clock fixed at 2026-10-21T12:00:00-05:00:
- model.test.ts: IMP-T16, IMP-T17, IMP-T18 from IMPORT-SPEC; AC-13 (TC-01 by hand: day
  totals Sun..Sat [70,90,90,90,90,90,70]; 181 / 177 / 169 for 31-, 30-, 28-day months);
  fixture C checksum does not match; timing: buildQuickModel for fixture B under 50 ms.
- guard.test.ts: with fixture B, Bathing Monday 45→60 refused with "That would put Bathing over
  its 93 units in October 2026." and maxCellMinutes = 45; Monday 45→30 accepted, then Tuesday
  45→60 refused and maxCellMinutes = 55; Clean Bath second day refused by the pin limit;
  every accepted change in these tests leaves zero BLOCK.
- state.test.ts: each QS rule's side effect; service change removes tasks (AC-12 data part).
- importFlow.test.ts: fixture D needs "incomplete"; accepting builds with the note; B-page1
  then B-page2 builds 15 tasks; table-only text needs "no-plan-dates" then builds after dates;
  junk needs "no-rows"; an unknown service label needs "unknown-service" then builds after a
  choice.
- persistence.test.ts: round trip drops identity; corrupt JSON → null; throwing storage → null.
- grouping.test.ts and ruleCopy.test.ts: grouping, order, context strings ("8 of 11 months");
  every RULE_CATALOG id × severity has copy except AUTH-13, SCH-15 and SCH-17.

Finish:
1. npm run typecheck and npm test from the root. Paste summaries.
2. Commit: "feat(web): Quick Schedule model, guard, import flow and state". Push.
```

---

---

## Prompt 6 — Quick Schedule UI: import panel, read summary, care plan pane

```
Read .clinerules and docs/APP-SPEC.md sections 4 and 5 first. Use
docs/design/quick-schedule-prototype.html as the visual and behavioral reference (open it in a
browser and paste a fixture into it).

Task: the /quick page with the import panel, read summary, care plan pane (both modes) and
the Status panel, wired to the logic from Prompt 5. Prompt 7 adds the week, month and checks.

1. features/import/ImportPanel.tsx: APP-SPEC 5.1 import panel. The Textarea's onPasteText builds
   immediately (no button press); "Build schedule" reads typed text (empty → "Paste the care
   plan first" with how). Examples buttons. FileDrop for PDFs. Issues rendered from
   importFlow (IMPORT-SPEC 3.1) with their controls; "Build with the N rows I have"; next-page
   pasting relabels the box "Care plan text, page 2" and its placeholder "Paste page 2 here".
2. features/import/readPdf.ts: loaded with import() only when a file is chosen. Uses
   pdfjs-dist 4.10.38: `import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"`,
   GlobalWorkerOptions.workerSrc = workerUrl, getDocument({ data, isEvalSupported: false }),
   maps items to PdfTextItem and calls textItemsToLines. Messages: not a PDF → "That isn't a
   PDF" / "Choose the care plan PDF you saved from Fusion."; no text → "This PDF has no
   readable text" / "It may be a scan or a photo. Paste the care plan from Fusion instead.";
   any other failure → "We couldn't read that PDF" / "Check that it's the care plan PDF from
   Fusion and not password-protected. You can also paste the care plan instead." While
   reading: spinner + "Reading the PDF…".
3. features/import/ReadSummary.tsx: APP-SPEC 5.1 read summary with the checksum line (from
   checksumLines in quick-schedule/checksumText.ts; lead in bold), notes, "Review what we
   read" table and "New care plan". Focus its h2 after a real import.
4. Care plan pane components: FusionPlanSection (locked), ServiceSection (by hand), TaskList,
   TaskRow (locked values or inputs; its DayToggle has label "<task> days"), TaskPicker
   (ARIA 1.2 combobox), CareDaysSection, TransportSection (Fusion or by hand). Every
   person-made change dispatches through the reducer, which applies the guard; a refused
   task-day change shows its sentence in that task's hint line. A task with an empty pinned
   set (QS-07) shows no days and the "Your days · Let us choose" hint.
5. StatusPanel: APP-SPEC 5.4 Status (aria-live polite).
6. QuickSchedule.tsx: page intro, ImportPanel, ReadSummary, notice, two-pane layout; useReducer
   with persistence (restore on mount, save debounced 300 ms). First visit: example A built
   under an open import panel.
7. Route /quick in router.tsx renders QuickSchedule in PublicLayout, lazily like the other
   public pages (React.lazy), and scripts/check-bundle.mjs gets "/quick" in PUBLIC_PAGES with
   the page's source file. Toasts (QS-02) mount inside the Quick Schedule page, not the layout,
   so Radix Toast stays out of the other public pages.

Tests (apps/web/test/quick/ui-*.test.tsx, Testing Library + user-event; mock readPdf):
- First render: import panel visible, read summary "Example care plan", Status "Ready to use".
- Pasting fixture B text into the Textarea (user.paste) shows "SAMPLE PARTICIPANT B" and hides
  the import panel; "New care plan" brings it back.
- Fixture D: incomplete message and "Build with the 10 rows I have".
- Mocked PDF text without dates shows the date fields; entering dates builds.
- Pin limit hint (AC-10); refused task-day change shows its sentence.
- By hand: picker "dress" + Enter adds Dressing/Grooming and focuses its minutes.
- The participant's name never appears in sessionStorage after a paste (AC-15 unit part).

Finish:
1. npm run typecheck, npm test, npm run build. Paste summaries and the check-bundle table
   (entry and every public page, /quick included, under 180 KB; no firebase and no pdfjs).
2. Commit: "feat(web): Quick Schedule import panel, read summary and care plan pane". Push.
```

---

---

## Prompt 7 — Quick Schedule UI: week, month, checks, print, e2e

```
Read .clinerules and docs/APP-SPEC.md sections 4, 5 and 11 first. Use the prototype as the
visual reference.

Task: the rest of the schedule pane and the Quick Schedule end-to-end tests.

1. WeeklyPanel: APP-SPEC 5.4 and QS-10. Cell editing dispatches through the reducer (guard);
   a refusal renders the refusal box (APP-SPEC 5.7) under the table from cellRefusal in
   guard.ts, with "Use N minutes" when it returns a value. Transportation row, Day total footer
   with UnitTiles (ui/UnitTiles.tsx; pass activeDays so non-care days show "Off"), legend,
   header meta, horizontal scroll inside the panel.
2. MonthPanel: navigation limited to the plan's months; meter with source chip, transport,
   trim sentence and over message; Fusion units field only by hand (QS-11); calendar with
   trimmed dates marked ("−95 min", warn border, aria-label naming the trim).
3. ChecksPanel: APP-SPEC 5.5 (grouped cards, counts, Good to know collapsed, details with
   months, rule, source from ruleById, rule pack; "Show in week").
4. Footnote with the /rules link. Print per APP-SPEC 5.4 (including name, DCN and PA when read,
   and trimmed dates).
5. Playwright: apps/web/playwright.config.ts (webServer: npm run build && npx vite preview
   --port 4173; projects "desktop" 1280×800 and "phone" 390×844, both testDir e2e/public,
   baseURL http://127.0.0.1:4173; use page.clock.setFixedTime for 2026-10-21 12:00 CT).
   Script "test:e2e": "playwright test --project=desktop --project=phone".
   e2e/public/quick-schedule.spec.ts: AC-01 to AC-09, AC-11, AC-14 (record every request;
   none to Google domains; no firebase or pdfjs chunk before a PDF is chosen; only same-origin
   requests after), AC-15 (read sessionStorage, localStorage and captured console messages and
   assert neither "10000002" nor "SAMPLE PARTICIPANT" appears), AC-19 for /quick.
   Paste by focusing the textarea and using page.keyboard.insertText + dispatching a paste
   event, or Playwright's clipboard permission and Control+V; choose whichever works in
   Chromium and keep it in one helper. PDF fixtures via setInputFiles on the hidden input.
   e2e/public/a11y.spec.ts: axe (@axe-core/playwright, tags wcag2a, wcag2aa, wcag21aa,
   wcag22aa) on /, /quick (example; fixture D's issue showing; fixture B built), /rules, in
   light and dark (set data-theme), zero violations.

Finish:
1. npm run typecheck, npm test, npm run build; then in apps/web: npx playwright install
   chromium (first time) and npm run test:e2e. Paste all summaries.
2. Commit: "feat(web): Quick Schedule week, month, checks, print and e2e". Push.
```

---

## Prompt 8 — Firebase, sign-in, account pages, session timeout

```
Read .clinerules and docs/APP-SPEC.md sections 3, 6 and 7 first.

Task: Firebase Auth and everything around signing in. Firestore is used only for
users/{uid} in this prompt.

1. apps/web/.env and apps/web/.env.emulator: APP-SPEC 7.1 verbatim (both committed).
   .env.local is gitignored. Add scripts "dev:emulated": "vite --mode emulator" and
   "build:emulated": "vite build --mode emulator --outDir dist-emulated" (add dist-emulated
   to .gitignore).
2. firebase.json at the repo root: firestore { rules "firestore.rules", indexes
   "firestore.indexes.json" }, emulators { auth { port 9099 }, firestore { port 8080 },
   ui { enabled false }, singleProjectMode true }. .firebaserc default
   "care-plan-scheduler". firestore.indexes.json: { "indexes": [], "fieldOverrides": [] }.
   firestore.rules: APP-SPEC section 8 verbatim (rules tests arrive in Prompt 9).
3. features/auth/firebase.ts: APP-SPEC 6.1. When VITE_USE_EMULATORS is "true", connect to
   the emulators. Never import firebase/analytics.
4. AuthProvider (onAuthStateChanged; exposes user, loading, emailVerified, signOut),
   RequireAuth and RequireVerified guards implementing the redirects in APP-SPEC section 3
   (validate `next`). AuthLayout: centered single column, Logo, max width 420px.
5. Pages: SignIn, SignUp, ResetPassword, VerifyEmail exactly as APP-SPEC 6.2, with the
   error copy from 6.6 (features/auth/errors.ts). /app/account: name (editable, "Save
   changes"), email (read-only), "Send password reset email" (email accounts), Appearance
   (System / Light / Dark from lib/theme.ts), "Sign out".
6. users/{uid} doc: create on sign-up and on first Google sign-in (if missing) with
   serverTimestamp createdAt; update displayName with serverTimestamp updatedAt.
7. Session timeout: APP-SPEC 6.5 (features/auth/useIdleTimeout.ts + IdleDialog).
8. Temporary /app route (until Prompt 9): AppLayout shell with header (Logo, account menu
   with name, email, "Your account", "Sign out") and a Home page that says
   "Signed in as <email>". Prompt 9 replaces Home's body.
9. Routes added lazily so the public bundle stays Firebase-free (check-bundle must pass).

Tests:
- errors.test.ts: every code in 6.6 maps to its sentence.
- guards.test.tsx: signed-out → /sign-in?next=…; unverified → /verify-email; bad `next`
  values (https://evil.example, //evil, /sign-in) go to /app.
- idle.test.tsx (fake timers): warning at 28 min, sign-out at 30, activity resets, storage
  event from another tab resets (AC-20).
- e2e/auth.spec.ts (emulated): sign up → verify by reading the link from
  GET http://127.0.0.1:9099/emulator/v1/projects/demo-careplan/oobCodes and opening it →
  reaches /app; sign out; sign in again; reset password shows the neutral message.
  playwright.config.ts gets a second webServer and project (the config holds an array of
  webServers, so both previews start together):
    webServer[1]: "npm run build:emulated && npx vite preview --outDir dist-emulated --port 4174",
    url http://127.0.0.1:4174;
    project "emulated": testDir e2e/emulated, baseURL http://127.0.0.1:4174, desktop 1280×800.
  Script "test:e2e:emulated": "playwright test --project=emulated". It runs only inside
  `firebase emulators:exec` (the commands in Finish do that). No environment variables are
  needed, so the same commands work on Windows, macOS and Linux.

Finish:
1. npm run typecheck, npm test, npm run build (check-bundle table: public entry unchanged,
   no firebase). Then from the root:
   npx firebase emulators:exec --only auth,firestore --project demo-careplan "npm run test:e2e:emulated -w @careplan/web"
   Paste all summaries.
2. Commit: "feat(web): Firebase auth, account pages and session timeout". Push.
```

---

## Prompt 9 — Agencies: rules tests, set-up, shell, home, agency details

```
Read .clinerules and docs/APP-SPEC.md sections 3, 6.3, 7 and 8 first.

Task: Firestore rules tests, agency set-up and the signed-in app shell.

1. apps/web/rules-test/firestore.rules.test.ts with @firebase/rules-unit-testing against the
   emulator (projectId "demo-careplan", rules read from ../../firestore.rules):
   R-01 to R-17 from APP-SPEC section 8, one `it` per row and per expectation. Use
   withSecurityRulesDisabled for fixtures. vitest.rules.config.ts includes only
   rules-test/**/*.test.ts, environment node, no setup file.
   If a rule in firestore.rules makes a listed case fail, STOP and report the case and the
   failing rule; do not edit firestore.rules on your own.
2. features/agency/: tenants.ts (createAgency batched write per 6.3, updateAgency),
   memberships.ts (my memberships via collection-group query, current agency selection via
   users/{uid}.lastTenantId), AgencyProvider (current agency, role, list, switchAgency),
   RequireMembership guard (no membership and no pending invite → /app/new-agency).
3. Pages: NewAgency (/app/new-agency), AgencyDetails (/app/agency) per 6.3, Home (/app):
   greeting with first name, agency name, primary action "Start a Quick Schedule" (/app/quick),
   and a "Get your agency ready" checklist with two items that tick from real data:
   "Invite your team" (done when the agency has another member or a pending invite; links to
   Team) and "Try Quick Schedule" (done when sessionStorage has cps.quick.v2; links to
   /app/quick). No "coming soon" content.
4. AppLayout: left navigation on ≥ 1024px (Home, Quick Schedule, Team, Agency), top bar with
   agency name (switcher menu when more than one agency) and the account menu; under 1024px
   the navigation moves into a menu button. /app/quick renders QuickSchedule inside
   AppLayout (no public header).
5. RequireMembership in this prompt: no membership → /app/new-agency. Prompt 10 adds the
   invite banner to that page; nothing about invites is built here.

Tests:
- npm run test:rules inside emulators:exec: all R-xx pass (AC-17).
- agency.test.tsx (mock the agency service module): NewAgency validation messages; owner vs
  scheduler view of AgencyDetails; Home checklist states.
- e2e/emulated/agency.spec.ts: new verified user → /app/new-agency → "Set up agency" →
  Home shows the agency name; Agency details save shows toast "Changes saved".

Finish:
1. npm run typecheck, npm test, npm run build; then
   npx firebase emulators:exec --only auth,firestore --project demo-careplan "npm run test:rules -w @careplan/web && npm run test:e2e:emulated -w @careplan/web"
   Paste all summaries.
2. Deploy the rules: npx firebase deploy --only firestore:rules --project care-plan-scheduler
   and paste the result.
3. Commit: "feat(web): agencies, app shell, home and Firestore rules tests". Push.
```

---

## Prompt 10 — Team and invites

```
Read .clinerules and docs/APP-SPEC.md sections 6.4 and 8 first.

Task: the Team page, invites, joining, and the invite banner.

1. features/agency/invites.ts: createInvite (14-day expiry via Timestamp.fromMillis,
   lowercase email, tenantName from the current agency), revokeInvite, listAgencyInvites,
   listMyInvites, acceptInvite (one batch: member doc with inviteId + invite accepted fields).
   members.ts: listMembers, changeRole, removeMember.
2. Team page (/app/agency/members) per 6.4: members table, pending invites table,
   "Invite someone" dialog, link display with "Copy invite link" (navigator.clipboard with a
   select-text fallback) and "Open in my email app" (mailto), role change menu and
   "Remove from team" confirmation dialog. Non-owners see the tables without actions and
   the line "Only an owner can invite or remove people."
3. Join page (/join/:inviteId) per 6.4 with every state (valid, wrong email with masked
   address, expired with date, revoked/used, not found). Signed-out visitors go to
   /sign-in?next=/join/<id>; after joining, go to /app with toast "Joined <agency>".
4. Invite banner on /app and /app/new-agency listing pending invites with "Review invite".
   Fill the pending-invite check from Prompt 9 so a person with an invite and no agency sees
   the banner on /app/new-agency instead of only the set-up form.

Tests:
- team.test.tsx (mocked services): owner and scheduler views; invite dialog validation
  ("Enter an email address like name@agency.com"); remove confirmation text.
- join.test.tsx: each Join state's copy.
- e2e/emulated/team.spec.ts: AC-16 end to end with two browser contexts: owner signs up,
  verifies, sets up the agency, invites scheduler@example.com, copies the link; second user
  signs up as scheduler@example.com, verifies, opens the link, joins; both see each other on
  Team; owner changes the scheduler to Viewer; owner removes them; they land on
  /app/new-agency.

Finish:
1. npm run typecheck, npm test, npm run build, then the emulators:exec command from Prompt 9.
   Paste all summaries.
2. Commit: "feat(web): team, invites and joining". Push.
```

---

## Prompt 11 — Accessibility, phones, budgets, pull request

```
Read .clinerules and docs/APP-SPEC.md sections 4.4, 10 and 11 first.

Task: verify every acceptance check, fix what fails, and open the pull request.

1. Accessibility: extend e2e/public/a11y.spec.ts to the public routes in AC-18 and add
   e2e/emulated/a11y.spec.ts for the signed-in routes; light and dark; zero violations.
2. e2e/public/phone.spec.ts and e2e/emulated/phone.spec.ts (viewport 390×844): AC-19 for every route in AC-18 at 390×844; touch targets ≥ 44px for
   buttons and toggles under 640px (measure boundingBox).
3. Confirm check-bundle passes with the final code and paste its table.
4. Go through APP-SPEC section 11 AC-01 to AC-23 and make a table: ID, test file and test
   name, result. Any AC without an automated test: add one.
5. Fix anything that fails. Do not change APP-SPEC, IMPORT-SPEC, ENGINE-SPEC, docs/fixtures, tokens.css
   or firestore.rules; if one of them is wrong, stop and report it.

Finish:
1. npm run typecheck, npm test, npm run build, and the emulators:exec command. Paste all
   summaries.
2. Commit: "test(web): accessibility, phone layout and acceptance coverage". Push.
3. Open a pull request from phase-2-app to main titled "Phase 2: app shell, accounts and
   Quick Schedule". Body: the AC table from step 4, the check-bundle table, and the Vercel
   preview link once it appears on the pull request. Do not merge.
```

---

## After Prompt 11 (you)

1. Open the Vercel preview link on the pull request. Paste a real care plan from Fusion into
   Quick Schedule on your computer and phone, and open a real Fusion PDF; then sign up with a real email, set up a test agency, and invite a second email of
   yours.
2. Send Claude the pull request link. Claude reviews it against APP-SPEC before you merge.
3. Merge after that review. Then point a domain at the Vercel project if you want one for
   pitching (add it to Firebase authorized domains and the API key's website list too).
4. Phase 3 (care plan import, saved participants, caregivers and visits) starts after the
   merge. Before any real participant data goes in: Google Cloud BAA signed, App Check on,
   audit log in place (APP-SPEC section 13).

---

## Prompt 12 — Windows desktop app (.exe installer)

Do this only after Phase 2 is merged to `main` and the production site works on Vercel.
Create the branch first: `git checkout main && git pull && git checkout -b phase-2-desktop`.

```
Read .clinerules (desktop rules D-1 to D-5) and docs/APP-SPEC.md sections 2 and 9 first.

Task: a Windows installer for CarePlan Scheduler. The desktop app is a thin shell around the
live site: one window that loads the production URL. It adds no schedule logic, no storage and
no second copy of the app, so every Vercel deploy updates it and sign-in, rules and Quick
Schedule behave exactly as on the web.

1. apps/desktop/package.json: name "@careplan/desktop", private, version "0.1.0", main
   "dist/main.js", description "CarePlan Scheduler", author "Golden Care Alliance, LLC".
   devDependencies (exact; run `npm view <name>@<version> version` first and report if a
   version is missing): electron 44.6.0, electron-builder 26.17.0, typescript 5.9.3,
   @types/node 22.20.5, vitest 3.2.7. Scripts: "build": "tsc", "typecheck": "tsc --noEmit",
   "test": "vitest run", "dist": "npm run build && electron-builder --win nsis --x64 --publish never".
   Do not add the `electron` package to apps/web or the root.
2. apps/desktop/src/config.ts: exports APP_URL = "https://careplan-scheduler.vercel.app"
   (ask me if the domain differs) and a pure function isAllowedNavigation(url: string):
   boolean that returns true only for https URLs whose host is the APP_URL host or one of
   accounts.google.com, care-plan-scheduler.firebaseapp.com (Google sign-in), and false for
   everything else. Unit-tested: allowed hosts, lookalike hosts (e.g.
   careplan-scheduler.vercel.app.evil.com), http, file:, javascript:, malformed input.
3. apps/desktop/src/main.ts, strict TypeScript:
   - One BrowserWindow 1280x860, min 900x640, title "CarePlan Scheduler". Set show: false and
     call win.show() on ready-to-show so there is no white flash; the page paints its own theme.
   - webPreferences: contextIsolation true, nodeIntegration false, sandbox true,
     webSecurity true, no preload script.
   - Load APP_URL. setWindowOpenHandler and will-navigate: allowed URLs per
     isAllowedNavigation open in the window (Google sign-in opens in a child window that closes
     itself); every other URL goes to shell.openExternal only if it is https, then is denied.
   - Block all permission requests (session.setPermissionRequestHandler returns false).
   - Single instance lock; second launch focuses the existing window.
   - If the page fails to load (did-fail-load, offline), show apps/desktop/assets/offline.html:
     plain page, "You're offline", "CarePlan Scheduler needs an internet connection to open.
     Check your connection, then try again.", and a "Try again" button that reloads APP_URL.
     Use only system fonts and inline CSS with no new color values beyond black, white and
     the Signature blue (--brand) already in tokens.css (copy those three values; this file is the one
     allowed exception to the hex rule, because it can't load the web bundle).
   - Menu: File (Print, Quit), Edit, View (Reload, Actual size, Zoom in, Zoom out, Full
     screen), Help (Open privacy page, which loads APP_URL + "/privacy" in the window). No
     DevTools in the packaged build.
   - Print works through the page's own Print button (window.print), so printed schedules
     match the web version.
4. electron-builder config (apps/desktop/electron-builder.yml): appId
   "com.goldencarealliance.careplan", productName "CarePlan Scheduler", NSIS one-click false,
   allowToChangeInstallationDirectory true, perMachine false, desktop and start-menu
   shortcuts, artifactName "CarePlan-Scheduler-Setup-${version}.exe", output "release". Icon:
   convert the existing logo to apps/desktop/assets/icon.ico (256x256, plus smaller sizes);
   if you can't, stop and tell me instead of using a placeholder.
5. .github/workflows/desktop.yml: runs on workflow_dispatch and on tags "desktop-v*", on
   windows-latest, Node 22, npm ci, npm run typecheck, npm test, then `npm run dist -w
   @careplan/desktop`, then uploads release/*.exe as a workflow artifact "windows-installer".
   On a tag, also attach the .exe to a GitHub Release for that tag. Unsigned for now.
6. apps/desktop/README.md: how to build locally on Windows (`npm ci`, `npm run dist -w
   @careplan/desktop`), where the .exe lands, the SmartScreen "Windows protected your PC"
   screen (More info, then Run anyway) until the installer is code-signed, and one paragraph
   on signing (an OV or EV certificate and electron-builder's win.signtoolOptions, as a
   later step; do not add any signing config now).
7. Add .clinerules desktop rules only if I told you to; they are already there (D-1 to D-5).

Finish:
1. npm run typecheck, npm test (all workspaces). Paste the summaries.
2. `npm run build -w @careplan/desktop` succeeds. If you are on Windows, also run
   `npm run dist -w @careplan/desktop` and report the installer's file size; if not,
   say that CI builds it.
3. Commit: "feat(desktop): Windows installer shell for CarePlan Scheduler". Push, open a pull
   request from phase-2-desktop to main, do not merge.
4. Tell me the exact steps to run the workflow and download the .exe.
```

---

## After Prompt 12 (you)

1. GitHub → Actions → Desktop → Run workflow on `phase-2-desktop` (or push a tag
   `desktop-v0.1.0` after merging). Download `windows-installer` and run it on a Windows PC.
2. Check: it opens the live site, Quick Schedule imports a pasted care plan, Google sign-in
   completes, Print opens the Windows print dialog, and unplugging the network shows the
   offline page.
3. Windows will warn "Windows protected your PC" until the installer is signed. For agency
   pitches, buy a code-signing certificate before sending the .exe to anyone outside GCA.
