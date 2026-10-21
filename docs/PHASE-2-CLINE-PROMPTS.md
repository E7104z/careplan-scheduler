# CarePlan Scheduler — Phase 2 Cline Prompts (App shell, accounts, Quick Schedule)

Paste these into Cline **one at a time, in order**. Start the next prompt only after Cline
reports every check in the prompt's "Finish" list passing. Every prompt works on the branch
`phase-2-app`, which already holds the Phase 2 docs.

Read first, in this order: `.clinerules`, `docs/APP-SPEC.md`, `docs/ENGINE-SPEC.md`, then
open `docs/design/quick-schedule-prototype.html` in a browser. That page runs the real
engine and is the look and behavior every Quick Schedule prompt is aiming at.

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
   `vercel.json` (added in Prompt 2) supplies the install, build and output settings.
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
    (`firebase-tools` arrives with Prompt 2; if `npx firebase login` asks to install it,
    run it again after Prompt 2.)

---

## Prompt 1 — Engine: rule catalog

```
Read .clinerules, docs/APP-SPEC.md (D-12, section 12 "Rules and sources") and
docs/ENGINE-SPEC.md section 5 first.

Task: add RULE_CATALOG to the engine. No app code yet.

1. packages/engine/src/rulepacks/catalog.ts exports:
     export type RuleArea = "Authorization" | "Schedule" | "Conflicts and eligibility";
     export type RuleStatus = "VERIFIED" | "VERIFIED (CDS)" | "VERIFIED basis" | "PARTIAL" | "APPROVED" | "OPEN";
     export interface RuleCatalogEntry {
       id: string; area: RuleArea; rule: string; severities: Severity[];
       status: RuleStatus; source: string;
     }
     export const RULE_CATALOG: readonly RuleCatalogEntry[]
   One entry per row of ENGINE-SPEC section 5, in table order, with `rule`, `status` and
   `source` copied character for character. `severities` comes from the Severity column
   ("BLOCK / WARN" → ["BLOCK", "WARN"]; "per matrix" → ["BLOCK", "REVIEW"]; "—" → []).
   Also export ruleById(id): RuleCatalogEntry | undefined.
2. Export both from packages/engine/src/index.ts.
3. packages/engine/test/catalog.test.ts:
   - Parse the three tables under "## 5. Rules" in docs/ENGINE-SPEC.md (read the file with
     node:fs relative to the test file) and assert RULE_CATALOG has the same IDs in the same
     order, and identical rule text, status and source for each.
   - Assert severities for: AUTH-09 ["BLOCK","REVIEW"], CON-02 ["BLOCK","REVIEW"],
     SCH-15 [], CON-17 ["REVIEW"].
   - Assert every ruleId that appears in a `ruleId: "..."` literal in src/rules/*.ts is in
     RULE_CATALOG.
4. Add catalog.ts to docs/RULE-MAP.md under a new "Catalog" heading (one line).

Do not change any existing test or any rule function.

Finish:
1. In packages/engine: npx tsc --noEmit and npx vitest run. Paste both summary lines.
2. Commit: "feat(engine): RULE_CATALOG with spec-parity test". Push.
```

---

## Prompt 2 — Web workspace, design tokens, UI kit, deploy config

```
Read .clinerules and docs/APP-SPEC.md sections 1, 2, 4, 9 and 10 first.

Task: scaffold apps/web and build the UI component kit. No pages except a development-only
component gallery.

1. Root package.json: workspaces ["packages/*", "apps/*"]; scripts:
     "typecheck": "npm run typecheck --workspaces --if-present",
     "test": "npm run test --workspaces --if-present",
     "build": "npm run build -w @careplan/web",
     "dev": "npm run dev -w @careplan/web"
   devDependencies (exact): firebase-tools 14.27.0.
2. apps/web/package.json: name "@careplan/web", private, type module. Dependencies and
   devDependencies pinned exactly as in APP-SPEC section 1 (the "web" rows), plus
   "@careplan/engine": "0.1.0". Scripts:
     "dev": "vite", "build": "tsc --noEmit && vite build && node scripts/check-bundle.mjs",
     "preview": "vite preview", "typecheck": "tsc --noEmit", "test": "vitest run",
     "test:e2e": "playwright test --pass-with-no-tests",
     "test:e2e:emulated": "playwright test --pass-with-no-tests",
     "test:rules": "vitest run --config vitest.rules.config.ts"
   (Prompts 6 and 7 narrow the two e2e scripts to their projects.)
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
   Until Prompt 3, main.tsx renders the gallery in dev and a plain "CarePlan Scheduler"
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
    minimal playwright.config.ts (testDir e2e) that Prompt 6 and Prompt 7 extend.
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

## Prompt 3 — Public site: layout, landing, rules and sources, privacy

```
Read .clinerules and docs/APP-SPEC.md sections 3, 4 and 12 first.

Task: the public pages and the router. No Firebase.

1. src/router.tsx: createBrowserRouter (react-router 7, library mode) with the public routes
   from APP-SPEC section 3 (/, /rules, /privacy, and *). Public routes use PublicLayout.
   /quick arrives in Prompt 5 and the sign-in and /app routes in Prompt 7; leave them out
   now. Unknown paths render NotFound. The header's "Sign in" and "Create agency account"
   links point at /sign-in and /sign-up and show NotFound until Prompt 7.
2. PublicLayout: SkipLink; header (Logo linking to /, nav "Quick Schedule", "Rules and
   sources", right side "Sign in" (quiet) and "Create agency account" (primary) linking to
   /sign-in and /sign-up); main#main; footer per APP-SPEC section 12. Sticky header with
   safe-area top inset. Under 720px: nav collapses into a menu button (Radix DropdownMenu).
3. Focus and titles: on every navigation, focus the page's h1 (tabIndex -1) and set
   document.title "<Page> · CarePlan Scheduler" (Landing: "CarePlan Scheduler").
4. pages/Landing.tsx: APP-SPEC section 12. The live figure uses the engine: compose the
   TC-01 example week with composeWeek and render the Day total row with UnitTiles
   (create ui/UnitTiles.tsx: one 10px square per whole 15-minute unit, 4 per row, plus a
   partial square filled bottom-up by remainder/15; aria-hidden, with the minutes and units
   as visible text). The three sections' figures are real engine output, not typed numbers.
5. pages/Rules.tsx: APP-SPEC section 12, generated from RULE_CATALOG and MO_2026_07.
   Tables scroll horizontally inside their own container on phones.
6. pages/Privacy.tsx and pages/NotFound.tsx (h1 "We can't find that page", links to / and
   /quick).
7. Tests:
   - pages.test.tsx: Landing shows the headline and the engine-computed week
     "70 · 90 · 90 · 90 · 90 · 90 · 70"; Rules lists every RULE_CATALOG id and every
     15-minute service with its ceiling (AC-17); NotFound renders for /nope.
   - router.test.tsx: title and focus move on navigation.

Finish:
1. npm run typecheck, npm test, npm run build from the root. Paste summaries and the
   check-bundle table (must be under budget, no firebase).
2. Commit: "feat(web): public layout, landing, rules and sources, privacy". Push.
```

---

## Prompt 4 — Quick Schedule: model, state, checks grouping and copy (no UI)

```
Read .clinerules and docs/APP-SPEC.md section 5 (all of it) first. Open
docs/design/quick-schedule-prototype.html and read its script: buildQuickModel must
produce the same numbers as its model() function.

Task: the pure logic behind Quick Schedule, fully tested. No components.

Files in apps/web/src/features/quick-schedule/:
1. types.ts: QuickState, QuickTask, QuickModel, CheckGroup.
2. model.ts: buildQuickModel(state, pack) exactly as APP-SPEC 5.3 steps 1–8, and
   monthFigures(model, month) for step 9 returning { expanded, authorizedUnits,
   authorizedSource: "fusion" | "calculated", calculatedUnits, transportUnits,
   taskBudgetMinutes, scheduledTaskMinutes, over }.
3. state.ts: reducer + action types for every input in APP-SPEC 5.2 (QS-01 to QS-12),
   including the side effects listed there (clearing cell changes, dropping pinned days,
   removing tasks on service change and returning their names for the toast, refusing a
   pinned set larger than daysPerWeek and returning a hint). exampleState(today: Date) and
   blankState(from: QuickState). Ids from a counter in state.
4. persistence.ts: load/save QuickState in sessionStorage key cps.quick.v1 with a shape
   validator (reject anything that doesn't validate; never throw).
5. grouping.ts: groupResults(results, taskNames) per APP-SPEC 5.5, returning groups
   ordered BLOCK, REVIEW, WARN, INFO with months in order and a context string
   ("Bathing, every month of the plan", "November 2026", "9 of 12 months").
6. ruleCopy.ts: RULE_COPY from the APP-SPEC 5.5 table, verbatim, and copyFor(group).
7. format.ts (src/lib): formatUnits(minutes) → "6 units" / "4 units + 10 min" / "1 unit";
   monthName("2026-11") → "November 2026"; shortMonth → "Nov 2026".

Tests (apps/web/test/quick/), with numbers from ENGINE-SPEC and the prototype:
- model.test.ts (build the example with exampleState(new Date("2026-10-20T12:00:00")), so the
  plan runs Nov 2026 – Oct 2027): example plan → day totals [70,90,90,90,90,90,70], week 590; month units
  181 / 177 / 169 for a 31-day, 30-day and 28-day month (pick months inside the plan);
  results contain no BLOCK, REVIEW or WARN. Bathing Monday edited to 60 → SCH-08 BLOCK
  groups: one without taskId (9 months for a plan starting Nov 2026) and one for Bathing
  (12 months), plus SCH-03 WARN. Fusion 150 for the first month → monthFigures over with
  scheduled − budget = 270 minutes, SCH-08 BLOCK for that month, AUTH-07 REVIEW.
  Sunday off → three SCH-02 WARN groups. Transport 60 × 1 → allowance 300 / 20 units and
  calculated units for Nov 2026 = 197 (177 + 20). Empty/invalid minutes → task left out.
  Timing: buildQuickModel for the example plan runs in under 50 ms.
- state.test.ts: every QS rule's side effect, including the pin limit (AC-09) and
  service change removing tasks (AC-08 data part).
- grouping.test.ts and ruleCopy.test.ts: grouping/order/context; every
  RULE_CATALOG id × severity has copy except AUTH-13 and SCH-15.
- persistence.test.ts: round trip; corrupt JSON → null; storage throwing → null.

Finish:
1. npm run typecheck and npm test from the root. Paste summaries.
2. Commit: "feat(web): Quick Schedule model, state, checks grouping and copy". Push.
```

---

## Prompt 5 — Quick Schedule UI: page frame and care plan pane

```
Read .clinerules and docs/APP-SPEC.md sections 4 and 5 first. Use
docs/design/quick-schedule-prototype.html as the visual reference for spacing, sizes,
colors and copy.

Task: the /quick page with the care plan pane wired to the reducer from Prompt 4. The
schedule pane in this prompt is ONLY the Status panel (APP-SPEC 5.4 "Status"); Prompt 6
adds the rest.

1. features/quick-schedule/QuickSchedule.tsx: page intro (h1, description, "Print schedule",
   "Load example plan", "Start blank"), the notice from APP-SPEC 5.1 plus the example
   sentence while isExample, the two-pane layout and breakpoints from APP-SPEC 5.1.
   useReducer + persistence (restore on mount, save debounced 300 ms).
   Model via useMemo(buildQuickModel).
2. Care plan pane components (one file each): ServiceSection, TaskList, TaskRow,
   TaskPicker (ARIA 1.2 combobox: role combobox on the input, listbox, aria-activedescendant,
   arrow keys, Enter, Escape, mouse; matches name and aliases), CareDaysSection,
   TransportSection. Every rule in APP-SPEC 5.2 QS-01 to QS-09 and QS-12. Focus moves exactly
   as the spec says (new task → its minutes field selected; remove → the picker).
   Removal toast for service change (QS-02).
3. StatusPanel: APP-SPEC 5.4 Status, aria-live polite.
4. Route /quick in router.tsx renders QuickSchedule in PublicLayout.

Tests (apps/web/test/quick/ui-*.test.tsx, Testing Library + user-event):
- Example loads and Status reads "Ready to use" with 590 minutes a week.
- Picker: typing "dress" + Enter adds Dressing/Grooming and focuses its minutes (AC-06).
- Pin limit hint (AC-09). Care day off disables that day's task toggles.
- Minutes field: "abc"/empty shows the error and Status reflects the task being left out.
- Service change to S5130 shows the toast and keeps only Clean Kitchen (AC-08).

Finish:
1. npm run typecheck, npm test, npm run build. Paste summaries and the check-bundle table.
2. Commit: "feat(web): Quick Schedule page and care plan inputs". Push.
```

---

## Prompt 6 — Quick Schedule UI: week, month, checks, print, e2e

```
Read .clinerules and docs/APP-SPEC.md sections 4, 5 and 11 first. Use the prototype as the
visual reference.

Task: the rest of the schedule pane and the Quick Schedule end-to-end tests.

1. WeeklyPanel: APP-SPEC 5.4 Weekly schedule and QS-10 (cell editing, underline, warn
   background, "Undo my minute changes"), transportation row, Day total footer with
   UnitTiles, legend, header meta, horizontal scroll inside the panel.
2. MonthPanel: month navigation limited to the plan, the meter (bar, source chip,
   transportation, over message), Fusion units field (QS-11), calendar.
3. ChecksPanel: APP-SPEC 5.5 (grouped cards, headings with counts, Good to know collapsed,
   details with months, rule, source from ruleById, rule pack), "Show in week" scrolls to
   and highlights the task row for 2 s (respect reduced motion: no smooth scroll).
4. Footnote with the /rules link.
5. Print: "Print schedule" → window.print(); print CSS per APP-SPEC 5.4 Print, including the
   "Checked with CarePlan Scheduler under rule pack mo-2026-07 on <date>" footer.
6. Playwright: apps/web/playwright.config.ts (webServer: npm run build && npx vite preview
   --port 4173; projects "desktop" 1280×800 and "phone" 390×844, both testDir e2e/public,
   baseURL http://127.0.0.1:4173). Script "test:e2e": "playwright test --project=desktop
   --project=phone". e2e/public/quick-schedule.spec.ts covering AC-01 to AC-08, AC-10,
   AC-11 (record every request; assert none goes to a Google domain and none loads a
   firebase chunk) and AC-15 for /quick (document.scrollingElement.scrollWidth <=
   innerWidth). e2e/public/a11y.spec.ts: axe (@axe-core/playwright, tags wcag2a, wcag2aa,
   wcag21aa, wcag22aa) on /, /quick, /rules in light and dark (set data-theme), zero
   violations.

Finish:
1. npm run typecheck, npm test, npm run build; then in apps/web: npx playwright install
   chromium (first time) and npm run test:e2e. Paste all summaries.
2. Commit: "feat(web): Quick Schedule week, month, checks, print and e2e". Push.
```

---

## Prompt 7 — Firebase, sign-in, account pages, session timeout

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
   firestore.rules: APP-SPEC section 8 verbatim (rules tests arrive in Prompt 8).
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
8. Temporary /app route (until Prompt 8): AppLayout shell with header (Logo, account menu
   with name, email, "Your account", "Sign out") and a Home page that says
   "Signed in as <email>". Prompt 8 replaces Home's body.
9. Routes added lazily so the public bundle stays Firebase-free (check-bundle must pass).

Tests:
- errors.test.ts: every code in 6.6 maps to its sentence.
- guards.test.tsx: signed-out → /sign-in?next=…; unverified → /verify-email; bad `next`
  values (https://evil.example, //evil, /sign-in) go to /app.
- idle.test.tsx (fake timers): warning at 28 min, sign-out at 30, activity resets, storage
  event from another tab resets (AC-16).
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

## Prompt 8 — Agencies: rules tests, set-up, shell, home, agency details

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
   Team) and "Try Quick Schedule" (done when sessionStorage has cps.quick.v1; links to
   /app/quick). No "coming soon" content.
4. AppLayout: left navigation on ≥ 1024px (Home, Quick Schedule, Team, Agency), top bar with
   agency name (switcher menu when more than one agency) and the account menu; under 1024px
   the navigation moves into a menu button. /app/quick renders QuickSchedule inside
   AppLayout (no public header).
5. RequireMembership in this prompt: no membership → /app/new-agency. Prompt 9 adds the
   invite banner to that page; nothing about invites is built here.

Tests:
- npm run test:rules inside emulators:exec: all R-xx pass (AC-13).
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

## Prompt 9 — Team and invites

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
   Fill the pending-invite check from Prompt 8 so a person with an invite and no agency sees
   the banner on /app/new-agency instead of only the set-up form.

Tests:
- team.test.tsx (mocked services): owner and scheduler views; invite dialog validation
  ("Enter an email address like name@agency.com"); remove confirmation text.
- join.test.tsx: each Join state's copy.
- e2e/emulated/team.spec.ts: AC-12 end to end with two browser contexts: owner signs up,
  verifies, sets up the agency, invites scheduler@example.com, copies the link; second user
  signs up as scheduler@example.com, verifies, opens the link, joins; both see each other on
  Team; owner changes the scheduler to Viewer; owner removes them; they land on
  /app/new-agency.

Finish:
1. npm run typecheck, npm test, npm run build, then the emulators:exec command from Prompt 8.
   Paste all summaries.
2. Commit: "feat(web): team, invites and joining". Push.
```

---

## Prompt 10 — Accessibility, phones, budgets, pull request

```
Read .clinerules and docs/APP-SPEC.md sections 4.4, 10 and 11 first.

Task: verify every acceptance check, fix what fails, and open the pull request.

1. Accessibility: extend e2e/public/a11y.spec.ts to the public routes in AC-14 and add
   e2e/emulated/a11y.spec.ts for the signed-in routes; light and dark; zero violations.
2. e2e/public/phone.spec.ts and e2e/emulated/phone.spec.ts (viewport 390×844): AC-15 for every route in AC-14 at 390×844; touch targets ≥ 44px for
   buttons and toggles under 640px (measure boundingBox).
3. Confirm check-bundle passes with the final code and paste its table.
4. Go through APP-SPEC section 11 AC-01 to AC-19 and make a table: ID, test file and test
   name, result. Any AC without an automated test: add one.
5. Fix anything that fails. Do not change APP-SPEC, ENGINE-SPEC, tokens.css or
   firestore.rules; if one of them is wrong, stop and report it.

Finish:
1. npm run typecheck, npm test, npm run build, and the emulators:exec command. Paste all
   summaries.
2. Commit: "test(web): accessibility, phone layout and acceptance coverage". Push.
3. Open a pull request from phase-2-app to main titled "Phase 2: app shell, accounts and
   Quick Schedule". Body: the AC table from step 4, the check-bundle table, and the Vercel
   preview link once it appears on the pull request. Do not merge.
```

---

## After Prompt 10 (you)

1. Open the Vercel preview link on the pull request. Try Quick Schedule on your phone and
   computer, sign up with a real email, set up a test agency, and invite a second email of
   yours.
2. Send Claude the pull request link. Claude reviews it against APP-SPEC before you merge.
3. Merge after that review. Then point a domain at the Vercel project if you want one for
   pitching (add it to Firebase authorized domains and the API key's website list too).
4. Phase 3 (care plan import, saved participants, caregivers and visits) starts after the
   merge. Before any real participant data goes in: Google Cloud BAA signed, App Check on,
   audit log in place (APP-SPEC section 13).
