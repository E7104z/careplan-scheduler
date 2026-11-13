# CarePlan Scheduler — App Specification (Phase 2)

Phase 2 puts the Phase 1 rules engine in front of people: a public site, sign-in, agency
accounts, and **Quick Schedule**: open a care plan PDF from Fusion and get a
ready schedule that can't be edited outside Missouri's rules. Nothing about a participant is
stored in Phase 2.

This file is the source of truth for everything under `apps/web`, `firestore.rules`,
`firebase.json` and `vercel.json`. `docs/IMPORT-SPEC.md` is the source of truth for reading
Fusion care plans (`packages/import`), and `docs/ENGINE-SPEC.md` for `packages/engine`.
If a prompt and a spec disagree, stop and ask.

Visual and behavioral target: `docs/design/quick-schedule-prototype.html` (open it in a
browser; it runs the real engine). Tokens: `docs/design/tokens.css`.

**Done when:** the Vercel preview of the `phase-2-app` pull request works end to end: a
visitor opens a Fusion care plan PDF in Quick Schedule without an account and gets a ready
schedule; an agency owner signs up,
verifies their email, creates the agency, invites a scheduler, and the scheduler joins; every
acceptance check in section 11 passes.

---

## 1. Decisions

| # | Decision | Why |
|---|---|---|
| D-01 | React 19 + Vite 7 single-page app in `apps/web`, npm workspace next to `packages/engine`. | The engine is pure TypeScript and runs in the browser; no server is needed for Phase 2. |
| D-02 | Tailwind CSS 4 with the tokens in `docs/design/tokens.css`; Radix primitives for dialogs, menus, popovers, tooltips and toasts; lucide icons. | Accessible behavior (focus traps, keyboard, ARIA) comes from Radix, so the team only owns the look. |
| D-03 | Public Sans, self-hosted through `@fontsource-variable/public-sans`. | The US Web Design System typeface reads as government-grade to the state; self-hosting means no request to Google Fonts. |
| D-04 | Firebase project `care-plan-scheduler`: Authentication (email + password, Google) and Firestore. | Separate from Scheduler Pro's project, as planned. |
| D-05 | **No Google Analytics.** `measurementId` is kept in config but `getAnalytics` is never called. | The product will hold Medicaid participant data from Phase 3. "No third-party tracking" is a selling point to the state, and Analytics isn't covered by a healthcare business associate agreement. |
| D-06 | Public pages (`/`, `/quick`, `/rules`, `/privacy`) never import Firebase. Firebase loads only on sign-in pages and inside `/app`. | Fast first load for agencies trying the tool; no network calls from Quick Schedule. |
| D-07 | Quick Schedule keeps its working state in `sessionStorage` (this tab only) and nothing else. | Survives an accidental refresh; disappears when the tab closes; never leaves the browser. |
| D-08 | Agency data model is multi-tenant from day one: `tenants/{tenantId}`, membership docs, roles `owner`, `scheduler`, `viewer`. | Matches the release-1 data model; Phase 3 adds participants under the tenant. |
| D-09 | Invites are links, not emails. The owner copies the link (or opens their own mail app with it filled in). | No server or email provider is needed in Phase 2; nothing is sent on the agency's behalf. |
| D-10 | Signed-in sessions end after 30 minutes without activity, with a 2-minute warning. | Expected by agencies and the state for any system that will hold participant data. |
| D-11 | Deployed on Vercel from the repo root (`vercel.json`), with strict security headers. Firebase is used only for Auth and Firestore, not Hosting. | Every pull request gets a preview link. |
| D-12 | The engine gains one export, `RULE_CATALOG` (rule ID, area, rule text, severities, status, source), tested against ENGINE-SPEC section 5. | The public "Rules and sources" page and the check copy are generated from the engine, not retyped. |
| D-13 | **Import is the front door.** Quick Schedule opens on "Open the care plan PDF from Fusion"; building by hand is the fallback. **Nov 13, 2026: paste removed, PDF only** (the owner's decision; the paste box, its "Build schedule" button and every paste message are gone, and the care plan PDF is the only way a plan comes in). Reading the PDF's text is a pure package, `packages/import` (`@careplan/import`), tested against de-identified fixtures of real plans. | This is what made Scheduler Lite special. A pure package can be tested exactly, like the engine. |
| D-14 | **No edit can break a rule.** Every change a person makes is applied to a copy, validated with the engine, and accepted only if it leaves zero Must-fix (BLOCK) results. A refused change explains the limit and offers the largest value that fits. Months that need more units than Fusion's figure are trimmed at month end automatically (ENGINE-SPEC SCH-17). | The schedule on screen is always one an agency can use. |
| D-15 | PDFs are read in the browser with `pdfjs-dist` 4.10.38, loaded only when a PDF is opened (its own chunk and worker file). Nothing is uploaded. | Keeps public pages fast; keeps participant data on the person's computer. |
| D-16 | Participant name and DCN from an import live only in memory: never in storage, the URL, logs or Firestore. | Quick Schedule stays a no-data tool even when real plans are opened in it. |
| D-17 | **The printout is a one-page PDF** (US Letter landscape), drawn in the browser with `pdf-lib` 1.17.1 and `@pdf-lib/fontkit` 1.1.1 in Public Sans (`@fontsource/public-sans` 5.3.0, static weights), loaded only when someone prints (5.4). Nothing is uploaded. | Decided Oct 26, 2026, at the user's request: the page sent to the print dialog came out on several pages, and each browser and the Windows app split, turned and captioned it its own way. A PDF is the same one page everywhere. |

### Pinned versions (verified to install, typecheck, test and build together on Node 22)

| Package | Version | Where |
|---|---|---|
| react, react-dom | 19.3.1 | web |
| react-router | 7.18.4 | web |
| vite | 7.3.7 | web (dev) |
| @vitejs/plugin-react | 5.2.0 | web (dev) |
| tailwindcss, @tailwindcss/vite | 4.3.3 | web (dev) |
| firebase | 12.19.0 | web |
| @radix-ui/react-dialog | 1.3.1 | web |
| @radix-ui/react-dropdown-menu | 2.2.1 | web |
| @radix-ui/react-popover | 1.3.1 | web |
| @radix-ui/react-tooltip | 1.4.1 | web |
| @radix-ui/react-toast | 1.3.1 | web |
| lucide-react | 1.60.0 | web |
| clsx | 2.1.1 | web |
| @fontsource-variable/public-sans | 5.3.0 | web |
| typescript | 5.9.3 | web (dev), same as engine |
| vitest | 3.2.7 | web (dev), same as engine |
| jsdom | 26.1.0 | web (dev) |
| @testing-library/react | 16.3.3 | web (dev) |
| @testing-library/user-event | 14.6.8 | web (dev) |
| @testing-library/jest-dom | 6.10.0 | web (dev) |
| @types/react, @types/react-dom | 19.3.0 | web (dev) |
| @playwright/test | 1.64.1 | web (dev) |
| @axe-core/playwright | 4.14.0 | web (dev) |
| @firebase/rules-unit-testing | 5.0.2 | web (dev) |
| pdfjs-dist | 4.10.38 | web; import (dev, for the PDF fixture tests) |
| pdf-lib | 1.17.1 | web (the printout, D-17) |
| @pdf-lib/fontkit | 1.1.1 | web (the printout's fonts) |
| @fontsource/public-sans | 5.3.0 | web (the printout's static weights) |
| firebase-tools | 14.27.0 | root (dev) |

Do not use newer majors (Vite 8, React Router 8, Vitest 5, TypeScript 7, Firebase 13). They
were not verified with the engine.

Known advisories (decided in the Oct 23, 2026 review): `npm audit` reports vitest 3.x
(`@vitest/mocker`, `tinypool`; fixed only in vitest 4.1.12+), firebase-tools' own dependencies,
and `@grpc/grpc-js` under firebase (Node only; the browser build doesn't use it). None of it is
in the browser bundle. Phase 2 stays on these versions. Never run vitest with `--ui`, `--api`
or browser mode, and never expose a vitest or Vite dev server beyond localhost. Moving to
vitest 4 is its own change after Phase 2 merges, before Phase 3 stores participant data.

---

## 2. Repository layout (end of Phase 2)

```
careplan-scheduler/
  .clinerules
  firebase.json                 Firestore rules + emulator config (no Hosting)
  firestore.rules               section 8, verbatim
  firestore.indexes.json        { "indexes": [], "fieldOverrides": [] }
  .firebaserc                   { "projects": { "default": "care-plan-scheduler" } }
  vercel.json                   section 9
  package.json                  workspaces ["packages/*", "apps/*"]
  docs/  APP-SPEC.md  ENGINE-SPEC.md  IMPORT-SPEC.md  RULE-MAP.md  PHASE-2-CLINE-PROMPTS.md
         design/ (tokens, prototype, reference/)  fixtures/fusion/
  packages/engine/              Phase 1 + Amendment A (RULE_CATALOG, SCH-17)
  packages/import/              @careplan/import: Fusion text reader (IMPORT-SPEC)
  apps/web/
    .env                        public Firebase web config (section 7.1)
    index.html
    package.json  tsconfig.json  vite.config.ts  playwright.config.ts
    scripts/check-bundle.mjs
    src/
      main.tsx  router.tsx
      styles/  tokens.css  app.css
      lib/     format.ts  storage.ts  cn.ts
      ui/      Button.tsx  Field.tsx  NumberField.tsx  Select.tsx  DayToggle.tsx
               Panel.tsx  SeverityPill.tsx  Dialog.tsx  Toast.tsx  Menu.tsx  Tooltip.tsx
               Spinner.tsx  EmptyState.tsx  SkipLink.tsx  Logo.tsx  ...
      layouts/ PublicLayout.tsx  AppLayout.tsx  AuthLayout.tsx
      pages/   Landing.tsx  Rules.tsx  Privacy.tsx  NotFound.tsx
      features/
        quick-schedule/   model.ts  guard.ts  grouping.ts  ruleCopy.ts  state.ts  QuickSchedule.tsx  ...
        import/           ImportPanel.tsx  ReadSummary.tsx  readPdf.ts  importFlow.ts  ...
        auth/             firebase.ts  AuthProvider.tsx  SignIn.tsx  SignUp.tsx  ...
        agency/           tenants.ts  members.ts  invites.ts  AgencyProvider.tsx  ...
    test/        unit + component tests (*.test.ts, *.test.tsx)
    e2e/         Playwright specs
    rules-test/  Firestore rules tests (emulator)
```

One concept per file, files under 300 lines (same as the engine).

---

## 3. Routes and access

| Path | Page | Access | Loads Firebase |
|---|---|---|---|
| `/` | Landing | public | no |
| `/quick` | Quick Schedule | public | no |
| `/rules` | Rules and sources | public | no |
| `/privacy` | Privacy | public | no |
| `/sign-in` | Sign in | public | Auth |
| `/sign-up` | Create account | public | Auth |
| `/reset-password` | Reset password | public | Auth |
| `/verify-email` | Check your email | signed in | Auth |
| `/join/:inviteId` | Accept invite | signed in, verified | Auth + Firestore |
| `/app` | Home | member | Auth + Firestore |
| `/app/quick` | Quick Schedule (inside the app) | member | Auth + Firestore (shell only) |
| `/app/agency` | Agency details | member (owner edits) | Auth + Firestore |
| `/app/agency/members` | Team | member (owner edits) | Auth + Firestore |
| `/app/account` | Your account | signed in | Auth + Firestore |
| `/app/new-agency` | Set up your agency | signed in, verified, no membership | Auth + Firestore |
| `*` | Not found | public | no |

Routing rules:
- Signed-out visitor opens an `/app` path → `/sign-in?next=<path>`; after sign-in, go to `next`
  (only if it starts with `/app` or `/join/`; anything else goes to `/app`).
- Signed in, email not verified → `/verify-email` for every `/app` and `/join` path.
  Google accounts arrive verified.
- Signed in, verified, no membership and no pending invite → `/app/new-agency`.
- Signed in with a pending invite for their email → `/app` shows the invite banner (section 6.4).
- `/app` routes, `/sign-in`, `/sign-up` and `/join` are code-split (`React.lazy`) so the public
  bundle never contains Firebase (D-06, budget in section 10). The public pages (`/`, `/quick`,
  `/rules`, `/privacy`) are lazy too, so the entry is only the shell (section 10); Not found is
  not.
- On every route change, move focus to the page's `<h1>` and update `document.title` to
  `<Page> | CarePlan Scheduler`.

---

## 4. Design system

### 4.1 Foundations
- Tokens: copy `docs/design/tokens.css` to `apps/web/src/styles/tokens.css` verbatim. No hex
  values anywhere else in `apps/web/src`. A unit test fails the build if one appears (P2-2).
- Type scale (px): 13 caption · 15 body · 17 section heading · 22 figure · 28 page title ·
  40 landing headline (32 on phones). Weights 400/500/600/700 as in the tokens file.
- Sentence case everywhere. No all-caps labels. No `→` in buttons. No emoji.
- Spacing: 4px grid. Panels pad 20px (16px under 640px). Page gutter
  `max(16px, env(safe-area-inset-left))`. Content max width 1440px.
- Radius: 6px controls, 10px panels and dialogs, pill for status pills only.
- Panels: `bg-surface border border-line rounded-md`.
- Panels have a border and no shadow; only dialogs, menus and toasts float (shadow-pop).
- Not everything is a panel:
  page intros, notices and inline lists sit on the paper background.
- Motion: only in answer to an action (dialog open, toast, meter change), 150–250ms, and none
  under `prefers-reduced-motion`.
- Dark mode: system by default; Account → Appearance offers System, Light, Dark and stores
  the choice in `localStorage` key `cps.theme` (wrap reads/writes in try/catch).

### 4.2 Components (`apps/web/src/ui`)
Each component has a test that renders it and runs axe (`vitest-axe` is **not** used; use
`@axe-core/playwright` in e2e for full pages, and in unit tests assert roles and names).

| Component | Spec |
|---|---|
| Button | Variants `primary` (brand), `secondary` (surface + line-2 border), `quiet` (no border), `danger` (block). Sizes `md` 40px, `sm` 32px; 44px min height under 640px. Shows a spinner and keeps its width while `busy`; `aria-busy` set. |
| Field | Label above input, hint below, error below hint in `text-block` with `aria-describedby` and `aria-invalid`. Required fields say "Required" in the hint, not an asterisk. |
| NumberField | `inputmode="numeric"`, integer only, `min`/`max`/`step`; never coerces an empty field to 0. |
| Select | Native `<select>` styled with tokens (best for mobile and screen readers). |
| DayToggle | Seven toggle buttons Su Mo Tu We Th Fr Sa, `aria-pressed`, full day name as `aria-label`. The group's name is its `label` prop: "Care days" by default, "<task> days" (e.g. "Bathing days") for a task. Variants: `chosen` (solid brand), `auto` (brand tint with brand border = "we chose this day"), `off`. 44px buttons under 640px. |
| Panel | Section with `h2` header row (title, meta text, tools slot) and body. |
| SeverityPill | Icon + word, never color alone: BLOCK `OctagonX` "Must fix"; REVIEW `CircleHelp` "Needs review"; WARN `TriangleAlert` "Check"; INFO `Info` "Good to know". |
| Dialog | Radix Dialog; title required; focus returns to the trigger; Escape closes; overlay `bg-overlay`. |
| Toast | Radix Toast, bottom-right (bottom-center on phones), 5s; the message has `role="status"` (on the message, not the list item, so the viewport stays a valid list; decided Oct 25, 2026). Message names the result of the action ("Invite link copied"). |
| Menu | Radix DropdownMenu for the account menu and agency switcher. Not for site navigation: the public header's phone navigation is a disclosure (a button with `aria-expanded` showing a `nav` of plain links). |
| EmptyState | Short sentence saying what will appear here and the one action that starts it. |
| Textarea | Label (may be visually hidden), `spellCheck={false}`, `autoComplete="off"`, resizable vertically, min height 150px. A plain text box: it reads nothing from the clipboard (the paste import was removed Nov 13, 2026). |
| FileDrop | A `<label>` wrapping a visually hidden `<input type="file">`, so click, Enter/Space and drag-and-drop all work; highlighted on drag-over (brand border and tint); shows the accepted type in words. Focus ring on the label via `:focus-within`. An optional `id` goes on the file input, so a page can put focus on the chooser. |
| SkipLink | First focusable element: "Skip to main content". |
| Logo | The four-square mark from the prototype (three filled squares, one outlined) + "CarePlan Scheduler". The outlined square is the unit still to be scheduled. |

### 4.3 Writing rules
- Name things the way an agency scheduler would: "care plan", "tasks", "units", "care days",
  "Fusion units", "agency", "team". Never "tenant", "template", "entries", "derived" in the UI.
- Buttons say what happens: "Create account", "Set up agency", "Copy invite link", "Remove
  from team". The toast repeats the verb: "Removed from team".
- Errors say what happened and how to fix it. No "Oops", no "Sorry", no "Something went wrong"
  without a next step. Firebase error codes map to plain sentences (section 6.6).
- Numbers: minutes and units always together where both matter: "90 min · 6 units",
  "590 minutes a week · 39 units + 5 min". Months: "November 2026". Dates: "Nov 3, 2026".

### 4.4 Accessibility (WCAG 2.2 AA)
- Every page passes axe with zero violations in light and dark (Playwright, section 11).
- Full keyboard use: every action reachable by Tab/Shift-Tab, Enter/Space; the task picker is
  an ARIA combobox (arrow keys, Enter, Escape).
- Visible focus ring from the tokens on every focusable element.
- Touch targets ≥ 44px on screens under 640px wide: buttons, toggles and checkboxes (with their
  label). Links inside a sentence are exempt, as WCAG 2.5.8 allows (decided Oct 25, 2026).
- Status changes are announced: the Quick Schedule status line is `aria-live="polite"`.
- Tables have `<th scope>`; the weekly grid's cells have labels like
  "Bathing, Monday, 30 minutes. Change minutes".
- Contrast: the token pairs are chosen for ≥ 4.5:1 text contrast in both themes; do not put
  `text-ink-3` on `bg-sunk` for anything but placeholder text.

---

## 5. Quick Schedule

Quick Schedule is the prototype in `docs/design/quick-schedule-prototype.html`, rebuilt in
React with the components above. Its reference logic is `docs/design/reference/`. Match its
layout, copy and behavior unless this section says otherwise; this section wins.

Two ways in, one schedule:
- **From Fusion** (the default): open the care plan PDF (IMPORT-SPEC). Minutes per
  day and days per week come from Fusion and are locked.
- **By hand** (fallback): enter service, dates and tasks (QS-01 to QS-09).

### 5.1 Layout
- Page intro: `h1` "Quick Schedule"; "Open a care plan PDF from Fusion. You get a ready
  schedule that follows Missouri's rules, and you can change it within them."; actions
  "New care plan" (only while a plan the person opened or built is showing), "Print schedule" and "Save as PDF"
  (5.4 Print).
- **Import panel** (shown until a real plan is built, and again after "New care plan"), two
  columns at ≥ 860px:
  - Left: `h2` "Open the care plan PDF from Fusion"; numbered steps (a real sequence): "In
    Fusion, open the participant's care plan." / "Download it as a PDF." / "Choose the PDF here
    or drop it on the box."; a drop zone "Choose the PDF / or drop it here" (a `<label>` around
    a hidden file input, `id="qs-pdf"`, `accept="application/pdf,.pdf"`); "The PDF is read on
    this computer. It isn't uploaded." There is no text box and no "Build schedule" button.
  - Right: "Examples: 5-day plan · 7-day plan" (fixtures A and B); "No care plan handy? Build
    a schedule by hand".
  - A PDF chosen after an incomplete one is added to it (IMP-12). After "New care plan", focus
    goes to the PDF chooser.
  - Below both: the import issues (IMPORT-SPEC 3.1), `aria-live="polite"`.
- **Read summary** (after a plan is built from Fusion): participant name as `h2` (focused
  after import), "Read from Fusion · DCN <dcn>"; facts: Service, Plan, Fusion units, Tasks,
  Provider, Prior authorization; the checksum line (IMP-15): "**Every task read.** Our total
  from these tasks matches Fusion's 466 units a month." or "**Our total doesn't match
  Fusion's 402 units.** From these tasks we get 374 in a 28-day month, 391 in a 30-day month,
  401 in a 31-day month. Check that every row came through; Fusion's figure is the one we
  schedule against."; then warnings (unread rows, unknown tasks, odd minutes, "Built from 10
  of the plan's 14 rows"); buttons "Review what we read" (a table: task, minutes a day, days
  a week, units in the viewed month, plus transportation) and "New care plan". For the
  example the title is "Example care plan" with "This is what a Fusion plan looks like. Open
  a PDF above to make your own."
- Notice (info style): "Nothing you open is uploaded or saved to our servers. It
  stays in this browser tab, and the participant's name and DCN are gone when you close it."
- Two panes at ≥ 1060px: Care plan (360–400px) left, Schedule right; one column below. In one
  column a link "Skip to the schedule" sits above the Care plan pane and goes to the Schedule
  pane (a plan with many tasks otherwise puts the status several screens down on a phone).
- First visit in a tab: the import panel with the 5-day example already built beneath it.
- Inside `/app/quick` the page renders in the app shell; public `/quick` in the public layout.

### 5.2 Care plan pane

From Fusion:
- "Care plan" section: Service name, Plan dates, and "Minutes and days come from Fusion and
  can't be changed here." with a lock icon.
- Tasks: name, "<n> units in <Mon>", the locked line "45 min a day · 5 days a week", and the
  task's DayToggle (QS-07). No add or remove.
- Care days (QS-08). Essential transportation: "<m> minutes a month from Fusion (<u> units),
  about <w> minutes a week. This time comes off the monthly units before tasks." and "Usual
  day" select (default from IMPORT-SPEC 4). No Fusion-units field in the month view (the
  figure comes from the plan).

By hand: the inputs below. Every input change goes through the guard (5.7).

| ID | Input | Rule |
|---|---|---|
| QS-01 | Service | Native select of every rule-pack service with `unit === "15min"`, grouped: Consumer Directed Services (T1019U2), Independent Living Waiver (T1019U6), Agency model (T1019, T1019TF), Aged and Disabled Waiver (S5130, S5120, S5150, S5150TF). Option text `<name> · <code>`. Default T1019U2. Nurse visits (T1001) are not offered: they are visits, not tasks. |
| QS-02 | Changing service | Removes tasks whose `taskCode` isn't available to the new program, clears minute changes, keeps care days. Toast: "Removed 2 tasks that aren't part of Homemaker (ADW)" when any are removed. |
| QS-03 | Plan starts | `<input type="month">`, default next calendar month. Plan ends = start + 11 months, shown read-only. Changing it clears Fusion units. Left with something that isn't a whole month (a browser without a month picker shows a text box): "Enter the month the plan starts, like 2026-11." and nothing changes. |
| QS-04 | Add a task | Combobox. Options: `pack.tasks` where `programs` includes the service's program, `isTransport` is not true, and not already added; matches name or any alias, case-insensitive. Enter adds the highlighted option. New task: 15 min/day, every day, not pinned; focus moves to its minutes field with the value selected. No match: "No Homemaker (ADW) task matches "xyz"". All used: "Every task for this service is already added". |
| QS-05 | Minutes per day | Integer 1–1440, step 5. Empty or invalid: error "Enter whole minutes, like 15 or 30." and the task is left out of the schedule (not treated as 0) until fixed. Not a multiple of 5: allowed, hint "Most care plans use 5-minute steps." |
| QS-06 | Days per week | Select 1–7, 7 shown as "Every day". Lowering it below the number of pinned days drops the latest pinned days. |
| QS-09 | Transportation | Minutes per trip (integer ≥ 0, step 5), trips per week (1–7), usual day (default Monday). Blank or 0 = none. Summary from `transportAllowance`: "300 minutes a month = 20 units. These come off the monthly units before tasks." plus ", 10 minutes left over" when `unallocatedMinutes > 0`. |
| QS-11 | Fusion units this month | Integer ≥ 0, optional, per month (by hand only). Hint: "If you have the authorized units from the Fusion care plan, enter them. Fusion's figure is always the one we check against." |

Both modes:

| ID | Input | Rule |
|---|---|---|
| QS-07 | Task days | DayToggle per task. Unpinned: the composer's days in the `auto` style and the hint "We chose the lightest days. Select a day to choose yourself." Selecting a day pins the task: the pinned set starts from the days shown and toggles that day. Pinned: solid style, hint "Your days · Let us choose" (the link unpins). Non-care days are disabled. A pinned set can't exceed days per week: one more shows "Bathing is authorized for 3 days a week. Unselect a day first." and changes nothing. Unselecting a task's last day leaves it pinned with no days (off the week, SCH-02 "fewer days"), so the next day selected is where it goes; this is how a 1-day task moves. A care day turned off that empties a pinned set returns the task to our days. A refused change (5.7) shows its sentence in the same place. |
| QS-08 | Care days | DayToggle, default from the import (IMPORT-SPEC 4) or all seven by hand. Turning a day off removes it from every pinned set and clears minute changes. None selected: "Choose at least one care day." |
| QS-10 | Weekly grid cell | Selecting a scheduled cell turns it into a number field (Enter or blur saves, Escape cancels). 0 removes that day for that task. Changed cells get a warn underline; a value above the task's minutes per day gets the warn background (SCH-03 is allowed). "Undo my minute changes" appears while any change exists. Changing a task's minutes, days or pins clears that task's cell changes, and a change whose task moves off that day (another task's pins, transportation day, adding or removing a task) is dropped, so it can't come back later. |
| QS-12 | Examples / New care plan / by hand | Examples load fixtures A and B as if opened from a PDF (marked as examples), moved to start this month with their length kept: the fixtures are real plans from 2025, and a schedule covers only months still to come. "New care plan" reopens the import panel, with focus on the PDF chooser, and keeps the current schedule underneath until the next plan is built. |

### 5.3 Model (`features/quick-schedule/model.ts`, pure; reference `quick-model.js`)
`buildQuickModel(state, pack): QuickModel`:
1. `tasks`: valid tasks mapped to `AuthorizedTask` (`serviceAuthId: "quick"`, unmatched Fusion
   tasks get taskCode `FUSION:<name>`).
2. Transportation: from Fusion, `transportMinutesPerMonth` = Fusion minutes and the weekly
   hint `floor(floor(minutes/15)/5) × 15`; by hand, `transportAllowance(minPerTrip,
   tripsPerWeek)` and weekly `minPerTrip × tripsPerWeek`. CDS and ILW only.
3. `composeWeek({ tasks, activeDays, overrides: pinned sets, weeklyTransportMinutes: weekly,
   transportDay })`. This is the **pattern**.
4. `entries`: pattern with cell changes applied, 0-minute entries removed.
5. `months`: every month from plan start to plan end.
6. `auth`: `{ id: "quick", participantId: "quick", program, serviceCode, start: the schedule's
   start (step 5), end, state: "active", suspensions: [], revision: 1, tasks,
   transportMinutesPerMonth? }`. The plan's own dates stay as Fusion has them (read summary,
   print); months already over aren't scheduled or checked.
7. `monthlyAuthorizations`: from Fusion's care plan report, each month's own figure (IMP-17);
   from the care plan screen, its one figure prorated to every full month as Fusion does
   (IMP-10: when our total matches Fusion's, each month's own total; otherwise Fusion's figure,
   lowered in shorter months); by hand, QS-11 entries.
8. `trims = fitToAuthorization(patternTemplate, auth, monthlyAuthorizations, months)`
   (ENGINE-SPEC SCH-17). Trims come from the **pattern**, never from cell changes, so a
   person's changes are never silently cut.
9. `results = validatePlan({ pack, authorizations: [auth], monthlyAuthorizations,
   template (with entries), exceptions: trims, months })`, or `[]` with no valid tasks.
   The plan rules and CON-09 on the expanded template run here (ENGINE-SPEC Amendment B). The
   visit rules (CON-01 to CON-04, CON-06, CON-07, CON-16 and CON-17) run at the plan level on the
   visits the start times give and the caregivers, under Visit checks (5.8), not per service.
   CON-05 (a caregiver over 40 hours in a workweek) needs the agency's workweek start and arrives
   with agency mode (CP4-9).
10. `checksum` (from Fusion): IMP-15, over the full months of Fusion's plan (computed before
   step 7, which uses it).
11. `monthFigures(model, ym)`: `expandMonth(template, trims, …)`; authorized = Fusion or
   derived; budget = `max(0, authorized − transportUnits) × 15`; scheduled; over; trims in
   that month and their minutes. Same test as SCH-08, so meter and checks always agree.

Recompute on every change with `useMemo` (≤ 20 ms for an 11-month plan).

### 5.4 Schedule pane
- **Status** (`aria-live="polite"`): no tasks → "Add tasks to start". Any BLOCK group (only
  possible when the imported plan itself breaks a rule) → "N things to fix" and "This care
  plan itself breaks a Missouri rule. Details are in Checks." Otherwise "Ready to use" with
  "Follows every rule we check, for all N months." ("for the N months left in the plan" when
  the plan started before this month; "for its one month" or "for the one month left in the
  plan" for one) or "Follows every rule we check. N items are worth a look in Checks."
  Figures: minutes a week, units in the viewed month, care days.
- **Weekly schedule**: rows per task ("45 min · every day"), the transportation row on its
  day ("Set aside, not a task"), Day total footer with minutes, units and **unit tiles** (one
  10px square per whole unit, four per row, a partly filled square for leftover minutes);
  non-care days show "Off". Header meta "1465 minutes a week · 97 units + 10 min". Legend:
  "One square = one 15-minute unit · Scheduled · Select a cell to change its minutes". The
  refusal box (5.7) sits under the table. Scrolls inside its panel on phones.
- **Daily task list** (after the week): one card per weekday with each task and its minutes
  in care plan order, essential transportation on its usual day, and "Visit length 5 h 15 min"
  with "315 minutes = 21 units" (and "(175 for tasks, 60 for transportation)" on the
  transportation day); "No visit" on other days. Intro: "The tasks for each visit and their
  minutes. Set each EVV visit window to its visit length." On the printout each day's column
  ends in its visit length. The visit length is the sum of what's listed, so an EVV window set
  from it agrees with the schedule.
- **Month**: previous/next limited to the schedule's months (5.3 step 5). Balance, three
  figures for the viewed month: Authorized ("455 units", "Fusion", "Fusion, for 31 days" or
  "Calculated from the tasks"), Scheduled ("452 units + 10 min", "429 units + 10 min for tasks,
  23 for transportation"), Left ("2 units + 5 min", "Not scheduled, not billed"; "N min over"
  in block red). Meter: "<n> units (+ r min) scheduled for tasks of <available> available",
  chip "Fusion: 455 units − 23 transportation", "Fusion, for a 31-day month: 469 units − 23
  transportation" or "Calculated: …", bar in tile colors (block red for any overflow). When
  the month was trimmed: "This month's tasks need more than Fusion's 440 units, so the
  schedule stops 320 minutes early, starting Dec 30, 2025. Those days are marked below.",
  then "Cut at the end of December:" and one line per date with each task and its minutes
  ("Dec 30, 2025: Meal Prep/Eating 60 min, Bathing 45 min, …"), then "If the units run out
  every month, the care plan needs more than Fusion authorizes. DSDS says a consistent need to
  change a task should prompt a request to the care plan change team (INFO 09-25-02)."
  Calendar: one cell per date with minutes and units; trimmed dates get a warn border and
  "−195 min"; dates outside the plan and days without care are dashed. "Show every month"
  opens a table (on the printout too): month, authorized, scheduled, left, cut at month end.
- **Review with the participant** (optional, after Checks): the checkbox "I went over this
  schedule with the participant" and "Date reviewed" (today by default, not later). INFO
  09-25-02: "Collaborating with the participant to create this schedule is key." Not a change
  to the schedule, so not guarded; any change to the schedule afterwards clears it.
- **Checks**: 5.5. Footnote: "Unit math follows DHSS rules for 15-minute units: weekly
  frequency factors, short-month proration for daily tasks, and whole units only. A change
  that would break a rule isn't accepted; you'll see the limit instead. Checks marked "Needs
  review" use a rule DHSS hasn't confirmed yet, so they never count as passing." Link "See
  every rule and its source" → `/rules`.
- **Print** (D-17): "Print schedule" and "Save as PDF" make the same one-page PDF, US Letter
  landscape (792 × 612 pt, 30 pt margins), in Public Sans with the light theme's colors from
  tokens.css. `scheduleSheet.ts` works out what it says from the model and the screen's copy;
  `schedulePdf.ts` lays it out. It holds:
  - Heading: the logo and "CarePlan Scheduler", "Weekly care schedule, Sunday to Saturday"; the
    participant's name ("Example care plan" for the example; lines to write the name and DCN on
    for a plan built by hand); the status as a pill ("Ready to use" or "N things to fix"); the
    facts DCN, Service ("PC - CDS · T1019U2"), Plan, Schedule starts (when later than the plan),
    Fusion units, Provider and Prior authorization.
  - The week, Sunday to Saturday: a row per task in care plan order with "45 min · 5 days a
    week" (beside the name when a long plan needs the room), then essential transportation on
    its usual day ("Set aside, not a task"); each day's minutes, changed minutes underlined,
    minutes above the task's own on the warn fill; days without care shaded; a Week column; then
    each day's Visit length, Minutes and Units ("15 + 10 min"), or "No visit".
  - Beside the week: This week (task minutes a week, care days, transportation), Checks (the
    status line, then each Must fix, Needs review and Worth checking group with its task and
    months; "And N more checks. See Checks in Quick Schedule." when they don't all fit),
    "Reviewed with the participant" (the date, or a line to write it on) and a key.
  - Below: Units by month (month, authorized, scheduled, left, cut at month end, and "Starting"
    with the first date cut when a month is cut), a line saying where "authorized" comes from,
    and, when months are cut, the INFO 09-25-02 note.
  - Footer: "Checked with CarePlan Scheduler under rule pack mo-2026-07 on <date>" and "Set each
    EVV visit window to its visit length."
  - It stays one page up to the most a week can hold (25 CDS tasks and transportation, 12
    months): rows get shorter, never a second page.

  "Print schedule" opens the PDF in a new tab, in the browser's own viewer, ready to print. It
  downloads instead where the browser shows no PDFs (`navigator.pdfViewerEnabled` is false), a
  popup is blocked, or in the Windows app. "Save as PDF" downloads it. The file is named "Care
  schedule 2026-10-26.pdf", never with the participant's name or DCN (D-16); the PDF's title is
  "Weekly care schedule". Ctrl+P (⌘P) on the page and the Windows app's File → Print (the
  `careplan:print` event, cancelled by the page) make the same printout, once even if both fire.
  With no tasks the two buttons are off and Ctrl+P is left to the browser. If the PDF can't be
  made: toast "Couldn't make the PDF. Check your connection, then try again." Printing the page
  from the browser's own menu still prints the page itself.

### 5.5 Checks: grouping and copy (`grouping.ts`, `ruleCopy.ts`)
- Group results by `ruleId + severity + refs.taskId`; each group keeps its months in order.
  One group = one card; group counts drive the status line.
- Order: Must fix, Needs review, Check (heading + count each), then "Good to know" collapsed.
- Card: title from the copy table + context ("Bathing, every month of the plan", "November
  2026", "8 of 11 months"), one-line what-to-do, and details: "Months: …" (more than one),
  "Rule SCH-08 · <engine message>", "Source: <RULE_CATALOG source>", "Checked under
  mo-2026-07". A card about a task has "Show in week" (scroll to and highlight the row 2 s).
- SCH-08 results with `refs.taskId` use the copy key `SCH-08/task`.
- No "No problems found" while any Needs review group exists.
- Quick Schedule runs the plan rules and CON-09 on its weekly pattern (5.3 step 9). Once a
  service has a visit start time (5.8 Visit checks), the visit rules CON-01 to CON-04, CON-06,
  CON-07, CON-16 and CON-17 run on the built visits and caregivers (CON-05, over 40 hours, needs
  the agency's workweek start and arrives with CP4-9). CON-13 (a referral date) still never shows,
  since Quick Schedule has no referral date.

Copy table (`ruleCopy.ts`, `RULE_COPY`). A test checks every rule ID × severity in
`RULE_CATALOG` has an entry (AUTH-13, SCH-15 and SCH-17 emit nothing and are exempt).

| Key | Severity | Title | What to do |
|---|---|---|---|
| AUTH-03 | REVIEW | Two state formulas give different units | DHSS's worksheet and the HCBS-3c form round this task differently. Compare with the Fusion care plan. |
| AUTH-03 | INFO | Task units calculated | Units for this task use the DHSS worksheet formula. |
| AUTH-05 | INFO | How monthly units are figured | Daily tasks are prorated by the days in each month. Other tasks use the DHSS weekly frequency factor. |
| AUTH-06 | WARN | Monthly figures are calculated, not imported | This plan came from the old web tool, so each month's units are our calculation. Check them against Fusion. |
| AUTH-07 | REVIEW | Fusion's monthly figure differs from this month's task units | We schedule against Fusion's figure. If the tasks need more, the last days of the month are cut, and the month view lists them. If that happens every month, ask the care plan change team for a change. |
| AUTH-08 | INFO | Transportation time is set aside | Transportation minutes come off the monthly units before tasks are counted. |
| AUTH-09 | BLOCK | Respite is over its combined monthly limit | Basic and Advanced Respite together can't go over the monthly limit. |
| AUTH-09 | REVIEW | Fusion units are above the program limit | The units entered are higher than this service's monthly limit. Confirm the number with Fusion. |
| AUTH-09 | WARN | More units than this service allows | These tasks add up to more units in a month than this service's monthly limit. Check the minutes and days against the care plan. |
| AUTH-11 | INFO | When ILW starts this month | This projects the day State Plan units run out and ILW units begin. |
| AUTH-12 | BLOCK | ILW isn't approved yet | Don't schedule ILW units until the ILW authorization is approved. |
| SCH-02 | BLOCK | A task is on more days than authorized | Unselect the extra day, or check the days per week on the care plan. |
| SCH-02 | WARN | A task is on fewer days than authorized | Add care days or choose more days for this task so it gets all its authorized days. |
| SCH-03 | WARN | A day has more minutes than the task allows | One day's minutes for this task are above its minutes per day. That's allowed while the month stays within its units. |
| SCH-08 | BLOCK | The schedule goes over the month's authorization | Lower some minutes or days, or check the monthly units against Fusion. |
| SCH-08/task | BLOCK | A task goes over its monthly units | Lower this task's minutes on the longer days. |
| SCH-11 | WARN | The same change two months running | DSDS says a consistent need to change a task should prompt a request to the care plan change team. Ask them for a care plan change. |
| SCH-12 | REVIEW | Partial month without a Fusion figure | The plan starts or ends mid-month, so Fusion's monthly figure doesn't apply. Check that month's units in Fusion. |
| SCH-14 | BLOCK | A visit falls outside the authorization | Move the visit to a date the authorization covers. |
| SCH-14 | INFO | Future authorization | Visits for this authorization are drafts until it starts. |
| CON-01 | BLOCK | Two visits for the same service overlap | A participant can't get the same CDS or ILW service twice at once. Change one visit's time. |
| CON-01 | WARN | Two agency visits for the same service overlap | Check the times; overlapping agency visits are usually a mistake. |
| CON-02 | BLOCK | These two services can't overlap | Change one visit's time. |
| CON-02 | REVIEW | These services overlap and the rule isn't confirmed | DHSS hasn't said whether these services may overlap. Avoid it until it's confirmed. |
| CON-03 | BLOCK | Respite overlaps another service | Respite can't happen at the same time as any other service. |
| CON-04 | BLOCK | A caregiver is booked in two places at once | Change one visit's time or caregiver. |
| CON-05 | WARN | A caregiver is over 40 hours this workweek | Overtime may apply. Check the caregiver's total hours. |
| CON-06 | BLOCK | This attendant can't be paid for this participant | A spouse or legal guardian can't be the CDS attendant. |
| CON-06 | REVIEW | Check this attendant's relationship | A spouse or guardian as ILW attendant needs review. |
| CON-07 | BLOCK | This aide can't serve this participant | A close family member or a non-employee can't provide this agency service. |
| CON-07 | REVIEW | Check this Chore worker's relationship | Family members providing Chore need review. |
| CON-09 | BLOCK | Over 49 hours a week, whichever day the week starts | ILW, and Basic and Advanced Respite together, are limited to 49 hours a week. Take time off some days. |
| CON-09 | REVIEW | Check the 49-hour week | DHSS hasn't confirmed which seven days make the week for the 49-hour limit. Check the care plan. |
| CON-10 | BLOCK | Too many nurse visits | Nurse visits are limited to one a day and 26 in six months. |
| CON-13 | WARN | First visit is late | Agency personal care should start within 10 days of the referral. |
| CON-13 | REVIEW | Referral date is missing | Enter the date the referral was received. |
| CON-16 | BLOCK | Two waiver enrollments overlap | A participant can't be in two waivers on the same dates. |
| CON-16 | REVIEW | No waiver enrollment on file | This waiver service needs an enrollment record. |
| CON-17 | REVIEW | Caregiver details are missing | Add the caregiver's relationship and qualifications so we can check eligibility. |
| CDS-01 | BLOCK | Prompting or stand-by can't be a CDS task | No CDS time can be authorized for stand-by, prompting or cueing on its own. Check this task against the care plan. |
| CDS-01 | REVIEW | Check the prompting in this CDS task | Prompting and cueing can be part of a hands-on task, but they can't be time on their own. Check that the minutes are for hands-on help. |
| CDS-02 | BLOCK | Waiting or respite can't be CDS time | No CDS time can be authorized for respite or for waiting for the participant at an appointment. Check this task against the care plan. |
| CDS-02 | REVIEW | Check the waiting time in this CDS task | Respite, and waiting for the participant at an appointment, can't be CDS time. Check what this task's minutes cover. |
| CDS-03 | REVIEW | Check this CDS task isn't skilled care | CDS can't include a task a licensed professional must do or train, such as skilled nursing or therapy a physician ordered. Check this task against the care plan. |
| CDS-04 | REVIEW | Check CDS transportation against NEMT | Trips to medical appointments that NEMT covers can't be CDS transportation. To check a trip, call NEMT at 1-866-269-5927. |
| CDS-05 | BLOCK | CDS can't be given to an RCF or ALF resident | People who live in a nursing facility, RCF or ALF aren't eligible for CDS. End CDS before the facility care starts. |
| PRG-01 | BLOCK | HCBS can't be given during PACE | A participant enrolled in PACE isn't eligible for any HCBS service. Check the PACE dates against the care plan. |
| PRG-02 | BLOCK | This DMH program rules out this personal care | DD Shared Living, Residential Habilitation and Individualized Supportive Living rule out State Plan personal care. DMH self-directed services rule out CDS and ILW. Check the program dates against the care plan. |
| PRG-03 | REVIEW | State Plan personal care comes before DD waiver personal assistance | State Plan personal care must be used up before a comparable DD waiver service. Check with the participant's DD support coordinator. |

Unknown rule ID or severity: the engine message is the title and "Rule <id>" the detail; log
nothing.

### 5.6 State and storage (`state.ts`)
- One reducer owns `QuickState`: `source` ("fusion" | "manual"), `identity` ({ name, dcn } |
  null, **memory only**), `provider`, `pa`, `serviceLabel`, `serviceCode`, `plan` { start,
  end }, `headerUnits`, `tasks[]` (`id`, `taskCode`, `name`, `minPerDay`, `daysPerWeek`,
  `pinned`, `locked`), `nextId`, `activeDays`, `transport`, `edits`, `fusion`, `fromMonth`
  ("YYYY-MM", the month the schedule was built; it covers the plan from then on), `viewMonth`,
  `reviewed` (the date it was gone over with the participant, or null), `isExample`, `notes`,
  `rowsRead`.
- Persist the whole care plan (5.8), every service **except `identity`**, to `sessionStorage`
  key `cps.quick.v3` (debounced 300 ms); restore if the shape validates (else a single service
  under `cps.quick.v2` from the version before), else show the example. After a reload the read
  summary title is "Care plan from Fusion". All storage access in try/catch.
- Never write Quick Schedule state to `localStorage`, Firestore, the URL, or the console.

### 5.7 Guard: no change can break a rule (`guard.ts`)
- `tryChange(next, pack, current) → { ok: true, model } | { ok: false, blocks, model }`: build
  the model for the changed state; accept only if it adds **no new BLOCK result** (decided in
  the Oct 23, 2026 review). A BLOCK the current state already has (only possible when the care
  plan itself breaks a rule, e.g. Respite above 868 units) may stay exactly as it was (same rule,
  refs and message); any other BLOCK, including a changed existing one, refuses. `blocks` holds
  only the new results, so the sentence names what the change would break. For a plan with no
  BLOCK this is the same as "zero BLOCK". The reducer dispatch for every person-made change
  (service, plan start, adding or removing a task, cell, task days, unpin, care days,
  transportation day or amounts, minutes or days by hand) goes through it. Loading a plan does
  not (an imported plan's own problems are shown, not hidden), and neither do Fusion units by
  hand (QS-11, the plan's own figure) or "Undo my minute changes" (back to the pattern).
- `maxCellMinutes(state, key, requested, pack)`: the largest value ≤ requested, in 5-minute
  steps, that adds no new BLOCK (binary search; adding minutes never removes a BLOCK).
- `cellRefusal(state, key, requested, pack)`: null when the cell change fits, else the sentence
  below and the box's second sentence (and the "Use N minutes" value when a larger value fits).
- Refusal sentence from the first BLOCK, preferring the viewed month and a task result:
  - SCH-08 task: "That would put Bathing over its 93 units in December 2025."
  - SCH-08 service: "That would put December 2025 over the 455 units Fusion authorizes."
    (by hand: "…the plan allows.")
  - SCH-02: "Bathing is authorized for 3 days a week."
  - other: the copy-table title.
- Cell refusal box (role `alert`, under the grid): "**Not changed.** <sentence> The most
  Bathing can have on Tuesday is 55 minutes." + button "Use 55 minutes"; or, when nothing more
  fits: "Bathing can't have more than 45 minutes on Monday. To add time here, take it from
  another day first." The box clears on the next accepted change.
- Other refusals show their sentence next to the control (task days) or in a toast.

### 5.8 The whole care plan: several authorizations, one schedule (Oct 31, 2026)
Decided in the Oct 31, 2026 review (`docs/PHASE-3-UNIFIED-SCHEDULE.md`): the participant is
what a schedule is for, and the authorization is a layer under it. Missouri authorizes each
service on its own, but the participant lives one week. So:
- **Import reads every block** of a care plan (IMPORT-SPEC IMP-17/18) and builds every
  time-based authorization at once, in Fusion's order; nothing asks which service to schedule.
  An unknown label asks which service it is, or keeps it without a schedule, per label (IMP-11).
  Authorizations the week doesn't hold are kept, never dropped (IMP-19). A service whose authorization
  ended before this month is left out with a note; when all have ended, the plan has ended.
- **State** (`CarePlan`, `types.ts`): `services` (one `QuickState` per authorization, each with
  its own dates, Fusion figures, care days, tasks, checks and review), `visits` (authorized by
  month, IMP-18), `others` (kept without a schedule, IMP-19; absent in plans saved before it),
  `notes` (about the plan as a whole) and `view` ("plan" or a service's index).
  A plan of one service (the examples, by hand, a one-service care plan) shows that service as
  before, with its visits listed under it.
- **Each authorization keeps its own identity and units.** Service type, authorization (PA),
  dates and tasks stay together; a procedure code alone never names a service (Fusion shows
  T1019 under both agency and CDS). Every change goes to one service through its own guard
  (5.7), so the medically related household tasks stay under agency personal care and never
  count against homemaker.
- **Care days across services (superseded Oct 31, 2026 review):** every service combines on one
  shared set of care days, sized to the largest days-per-week across the client's services, the
  first days from Monday (IMPORT-SPEC 4). Each service takes its own days from that set — a
  service with the full count takes them all, one with fewer days takes the lightest subset, and
  transportation takes one weekday from it. All of it is editable in that service.
- **Whole care plan view** (the default with several services): tabs "Whole care plan" and one
  per service (toggle buttons, `aria-pressed`); the read summary for the plan (dates, services,
  tasks, visits, and for each authorization whether our total matches Fusion's); Authorizations
  (each service's PA, its units in the month, scheduled, left, its checks' status, "Open");
  the participant's week, Sunday to Saturday, every task under the service that authorizes it
  with that service's minutes and the day's total; Nurse visits by month (Past, This month,
  Coming up); Other authorizations (IMP-19: each kept one's label, its Appendix 1 service and
  code, its units in its own unit and never as hours, its PA and provider, why it isn't in the
  week, and its rows as read; a code Appendix 1 doesn't list is marked "Not recognized: kept for
  review"). The plan's read summary says what was read and what became of it, counted from the
  plan: "5 authorizations read: 3 scheduled in the week, 2 nurse visits by month." A service opens in detail on the same page (5.2-5.5) and the whole plan is one
  click back.
- **Print**: one service prints its one page (5.4). Several print the whole week first (every
  service's rows, each naming its service; "Day total", since a day there holds several visits;
  each service's units and PA; the visits' months), then each service with anything scheduled
  on its own page, with its months, checks and visit lengths for EVV. Every printout, one
  service or several, names the nurse visits by month and each kept authorization (IMP-19).
- **Storage**: the whole plan under `cps.quick.v3` without any `identity` (5.6); a single
  service saved under `cps.quick.v2` by the version before still opens.
- **Nurse visits on dates** (Coverage Phase 3, Nov 13, 2026; `NurseVisits.tsx`, `planEvents.ts`).
  The Nurse visits panel reads "By date, in the month authorized". Each visit Fusion authorized
  is listed in its month with "No date yet" and a native date input "Pick a date", limited to
  that authorization's month. Picking a date places one nurse visit event (`CarePlan.events`,
  optional in storage, no name or DCN); the row then shows "Visit date", the date ("May 12,
  2026") and "Remove date". The app never creates a visit Fusion did not authorize and never
  places one by itself. Every placement goes through the engine's `placeEvent` (5.7): a date
  outside the month, a visit past the month's count, a second nurse visit that day, or a 27th
  in six months is refused beside the visit (`role="alert"`) and nothing changes: "Not placed.
  Jun 2, 2026 is outside May 2026, the month this is authorized for. Pick a date in that month."
  A general health evaluation placed on the date of another authorized nurse visit is one visit
  that day ("Done at the nurse visit that day: one visit.") and counts once against the
  one-a-day limit. A placed evaluation gets a reminder on the 15th of the next month,
  "Reminder, not a visit · Jun 15, 2026 · Upload the evaluation (HCBS 08-26-01)": not billable,
  never counted as a visit, and removed with its visit. A month that has passed with no date
  shows "No date was placed for this month's visit. Pick a date above if one was arranged."
  (rule NUR-02, WARN); it says nothing about whether the visit happened. No visit month is ever
  derived: a plan shows only the months Fusion authorized (RN-01).
- **Services arranged by date** (Coverage Phase 3; `OtherPlacing.tsx`, `eventText.ts`). In Other
  authorizations, a kept authorization whose Appendix 1 class is APPOINTMENT gets a group "Place
  on the calendar" (`role="group"`, named "Place <label> on the calendar"). It stays in
  `others`; its events point at it by its id. One line says what it holds, then the fields and
  one button:
  - Adult day care (`S5100HC`, `S5100HB`): "Attendance, in 15-minute steps. It is never
    caregiver time."; Date, "Minutes attended", "Transportation minutes" (its own entry, counted
    toward its own 120 minutes a day); button "Add day care day".
  - Home delivered meals (`S5170`): "Counted as meals, never as time. No more than 2 a day.";
    Date, "Meals"; button "Add delivery".
  - Structured family caregiver (`S5126HB`): "A covered day is one day, never 15-minute
    units."; Date; button "Mark covered day".
  - An RCF/ALF nurse visit (`T1001U3`): "One visit a day, in a month the care plan
    authorizes."; Date; button "Add visit".
  A missing value is said before anything is sent: "Pick a date first.", "Enter the minutes as a
  whole number.", "Enter the number of meals.", "Enter the transportation minutes as a whole
  number." Every placement goes through `placeEvent` (5.7); the caps are the engine's own rules
  (adult day care 600 minutes a day in 15-minute steps, 5 days a week, 120 transportation
  minutes a day; 2 meals a day; one covered day a day; the month's authorized quantity) and a
  refusal is shown in the group (`role="alert"`): "Not placed. Home delivered meals are limited
  to 2 a day. Enter 2 or fewer for Nov 3, 2026." Placed dates are listed, each with "Remove"
  ("Nov 3, 2026 · 2 meals", "Nov 2, 2026 · 8 h · 60 min transportation"), and each month with
  something placed shows its balance in the service's own unit: "62 meals in November 2026, 10
  placed, 52 left", "100 h in November 2026, 8 h placed, 92 h left", "2 covered days of 30
  authorized in November 2026". The reason line keeps "Arranged by date" and adds the count:
  "Arranged by date · 5 dates placed". Nothing placed here enters the week, a caregiver's time
  or any 15-minute unit total.
- **Reminders on context authorizations** (Coverage Phase 3). A kept authorization of class
  CONTEXT never has caregiver time. ILW case management (`T2024U6`) and ILW equipment, supplies
  and environmental adaptations (`T2029U6`, `T2028U6`, `S5165U6`) may hold a dated reminder,
  only if the person adds one: "A reminder is a note on a date. It is never a visit and is never
  billed."; Date, "Note (optional)" (200 characters at most); button "Add reminder". It is
  listed as "Nov 10, 2026 · Reminder, not a visit · <note>". A reminder is not billable, has no
  quantity, is never a caregiver shift, is in no unit total and no balance, and does not change
  the reason line ("No caregiver time"). ILW financial management (`T2040U6`) is authorization
  context only: it shows its authorization and "Nothing to place: this is authorization context
  only." Any other event on a context authorization is refused by the engine (EVT-03): "Not
  placed. This authorization has no caregiver time, so only a reminder can go on it." The
  scheduler holds no costs; these authorizations have no cost field.
- **Care plan changes** (Coverage Phase 3, Manual 4.20; `AmendmentsPanel.tsx`,
  `amendments.ts`). With a service open in detail (not the example), a panel "Care plan
  changes" (meta "None recorded" or "N recorded") says: "If the care plan changes partway
  through, record the change here. The schedule follows it from the date it takes effect;
  nothing before that date moves, and Fusion's figures are kept as read." The form "Record a
  care plan change" (`role="group"`) has: "Kind of change" (Increase / Decrease / Reduction
  asked for by the participant); "Effective date" (a date in the schedule's dates); "New units
  a month (optional)"; a table of every task with "Minutes a day" and "Days a week", prefilled
  ("Enter 0 minutes to take a task out of the week from the change on."); a checkbox "The care
  plan shows this date"; button "Record change". For a decrease it says: "A decrease starts on
  the first of a month. One dated later in a month starts the first of the next month."
  - The engine sets where the change takes effect (`amendmentEffectiveDate`): an increase and a
    participant-requested reduction on their date, a decrease on the first of a month. The app
    never picks a date for the person, and a change is "Needs review: check the date this change
    takes effect against the care plan (Manual 4.20)." (AMEND-01) until the box is ticked ("You
    said the care plan shows this date.").
  - A change is stored on its service as a version (`QuickState.amendments`, optional in
    storage). It never edits the imported tasks, units or monthly figures. Occurrences are
    recalculated from the effective date forward only (`serviceChain`, `expandChainMonth`).
  - Recording goes through the guard (5.7) and is refused beside the form (`role="alert"`),
    with the plan unchanged: "Not recorded. Change a task's minutes or days, or enter the new
    units a month."; "Not recorded. A change takes effect after Dec 1, 2025 and no later than
    Oct 31, 2026; this one would take effect on <date>." (also for a change that would take
    effect before one already recorded: history is not rewritten); or the sentence of the
    Must-fix rule the changed plan would break. Changes are kept in the order recorded.
  - Recorded changes are listed: "Increase · Takes effect Jan 15, 2026", then each task's
    "Bathing: 45 min a day, 7 days a week → 60 min a day, 7 days a week" and "480 units a month
    from the change on", with "Remove change". A decrease that was moved reads "Decrease ·
    Takes effect Feb 1, 2026 (entered Jan 15, 2026; a decrease starts on the first of a month)".
  - The weekly grid, month view and one-service printout show the plan before any change. The
    participant calendar (below) shows the version in effect on each date.
- **The participant calendar** (Coverage Phase 3; `ParticipantCalendar.tsx`,
  `normalizeEvents.ts`, `calendarView.ts`, `balances.ts`, `DayChangeForm.tsx`, `dayChanges.ts`).
  - **One list.** `normalizeEvents(plan, models, pack, onlyMonths?)` is one list of every
    occurrence in the plan, each with its date, service, authorization, kind, minutes or
    quantity and unit: each service's weekly pattern expanded to real dates by the engine (trims,
    one-day changes and recorded care plan changes applied, each occurrence on the version in
    effect that day), transportation on its day, and every dated event. Two authorizations are
    never merged. **It is the only source the calendar, the list view and the whole-plan PDF read
    from.** The screen asks for the month on view; the PDF for all of them.
  - **The Month tab.** For a plan the person opened or built (not the example), once it has a
    schedule. On the whole care plan: a nav "Week or month" with toggle buttons "Week" (the
    default, the participant's week) and "Month" (the calendar in its place). On a plan of one
    service: a button "Show the month calendar" / "Hide the month calendar" (`aria-expanded`).
    The calendar and its code are in the dated-side chunk and load when it is first opened.
  - **The panel** "The participant's month": previous and next ("Previous month on the
    calendar", "Next month on the calendar") over every scheduled month and any month with an
    event, opening on this month; toggle buttons "Calendar" and "Month as a list".
  - **Calendar**: `role="grid"` named "<Month Year>, by date", Sunday to Saturday, one
    `gridcell` per date. Each cell shows a band for each service with its minutes that day,
    labeled by name and not only by color ("PC - Agency 150"), and a mark for each event:
    "Visit", "Day care", "Meals", "Day" (a covered day), "Reminder", and "Change" where a care
    plan change takes effect. Dates outside the plan and days without care are dashed. Each
    cell's accessible name reads its date and contents ("Tuesday, May 12, 2026: PC - Agency 150
    minutes; GHE, Nurse visit, 1 visit"; "Sunday, May 3, 2026: no care"; "... outside the
    plan"). One cell is in the tab order; arrow keys move a day or a week, Home and End go to
    the week's ends, the focus is visible, and Enter or Space chooses the date.
  - **Month as a list**: the accessible alternative and the default below 860 px. A table
    "<Month Year> as a list" with Date, Service, What, How much. A service's tasks on a date are
    one row (their names, their minutes added up); transportation and each event have their
    own. The grid's cells and the list's rows are the same items (a test compares them).
  - **Authorization balances** beside it: each authorization with a figure for the month, in
    its own unit: "226 units in May 2026 · 224 units scheduled · 2 units left", "62 meals in
    November 2026 · 2 meals placed · 60 meals left". Then "Next nurse visit to place: General
    Health Evaluation, May 2026" while one is waiting, and the shared respite figure when the
    plan holds both respite lines (AUTH-09's own combined figure).
  - **Change this day**: choosing a date shows a group "Change this day: <weekday>, <date>"
    with each task scheduled that day and its minutes, and "Save this day". "This changes only
    <date>. The weekly pattern and the authorization stay as they are. Enter 0 to take a task
    off this day." It records a one-day change (`QuickState.dayChanges`, optional in storage),
    which the engine reads as a calendar exception (SCH-11). It goes through the guard (5.7): a
    change that would put the month over its units is refused there, "Not changed. That would
    put <task> over its N units in <Month>." Setting the pattern's own minutes back removes the
    change.
- **Checks added in Coverage Phase 3** (copy in `ruleCopy.ts`, shown as in 5.5; the refusal
  sentences above are what a person sees when a placement is refused):

  | Rule | Severity | Title | What to do |
  |---|---|---|---|
  | AMEND-01 | REVIEW | A care plan change needs its start date checked | The schedule crosses a care plan change. Check the date the change takes effect against the care plan in Fusion. |
  | EVT-01 | BLOCK | That date is outside the authorization | Pick a date inside the dates and months the care plan authorizes for this service. |
  | EVT-02 | BLOCK | That is more than the care plan authorizes this month | The care plan's count for the month is the limit. Remove a date first, or choose another month. |
  | EVT-03 | BLOCK | This authorization has no caregiver time | Only a reminder can go on this authorization. It is never a visit and is never billed. |
  | NUR-01 | REVIEW | Advanced Personal Care: check the first month's nurse visits | A new Advanced Personal Care authorization is expected to have two nurse visits in its first month unless an ongoing nurse visit covers it. Check the care plan. DHSS hasn't confirmed the first-month visit count, so this stays under review. |
  | NUR-02 | WARN | No date was placed for this month's visit | Pick a date for the visit in the month it was authorized. This doesn't say whether the visit happened. |
- **Visit start times and visit checks** (Coverage Phase 4, CP4-1; `VisitTimes.tsx`,
  `visits.ts`, `PlanChecks.tsx`, `extrasSlots.tsx`). For a plan the person opened or built.
  - **Start times.** With a service open in detail, a panel "Visit start times" (meta "None
    set" or "N of M set"): "Optional. Add a start time to check overlaps with other services."
    One native time input for each care day, "<Weekday> start time", stored with the service
    (`QuickState.startTimes`, optional in storage, "HH:mm" in America/Chicago). Under each: "Visit
    length 2 h", and with a time set "Visit length 2 h, ends 11:00 AM" or "... ends 1:00 AM the
    next day". The visit's length is the day's total already shown as its visit length; the end
    is the engine's `addMinutesLocal`, so a visit past midnight and a clock-change day are right.
    The daily task list shows "Starts 9:00 AM" on that day, and the one-service printout's visit
    row reads "9:00 AM, 2 h".
  - **Visits.** `buildVisits(plan, models, pack)` turns services with start times into engine
    `Visit` objects for the dates of the plan, from the one occurrence list. A service or a day
    with no start time produces none.
  - **Visit checks.** A panel "Visit checks" on the whole care plan (and under a one-service
    plan) lists the rules that read visits, grouped as in 5.5. Where start times are missing the
    overlap rules don't pass: each is "Needs review" with the engine's sentence, said once with
    the services and rules it covers: "No clock times yet, so overlaps can't be checked" · "PC -
    Agency, PC - CDS, HC · CON-01, CON-02". With nothing to raise it reads "Every visit rule we
    can check from this schedule's times is met."
  - **Guard.** Setting a time goes through the guard (5.7): a time that would break an overlap
    rule is refused in the panel (`role="alert"`) with the rule's copy, "Not changed. Two visits
    for the same service overlap. A participant can't get the same CDS or ILW service twice at
    once. Change one visit's time."; a value that isn't a time: "Not changed. Enter the time as
    hours and minutes, like 9:00 AM."
- **Caregivers** (Coverage Phase 4, CP4-2; `CaregiversPanel.tsx`, `caregivers.ts`). A panel
  "Caregivers" (meta "None added" or "N added"), for a plan the person opened or built:
  "Optional. Add the people who give the care to check who can serve this participant and
  whether anyone is booked twice. Enter what you know about each; nothing is guessed. Names stay
  in this tab and are never saved." Button "Add a caregiver".
  - **What is entered.** For each caregiver: "Name of Caregiver 1 (kept in this tab only, never
    saved)"; "Relationship of Caregiver 1 to the participant" (Not entered / Not related /
    Spouse / Legal guardian / Parent / Sibling / Child / Stepchild / Grandparent / Grandchild /
    Other family); and three questions, each Not entered / Yes / No: "Agency employee", "Nurse
    license", "On the Family Care Safety Registry". Every answer starts at "Not entered".
    Qualifications are entered, never guessed from a name or a role word (CON-17).
  - **Names are memory-only**, exactly like the participant's: kept in React state, never
    written to `sessionStorage`, Firestore, the URL or logs. `savePlan` drops them, and a stored
    caregiver that carries a name is refused on load. After a reload a caregiver is "Caregiver
    1", by their place in the plan; the printout always uses that label.
  - **Assignment.** "Services Caregiver 1 is assigned to": a checkbox for each service. A
    service can have several caregivers; each visit takes the first. For a structured family
    caregiver authorization: "<label> covered days: Caregiver 1 is" Not the caregiver / The
    primary caregiver / The backup caregiver (one person can't be both). Stored as optional
    `CarePlan.caregivers`, `QuickState.caregiverIds` and `PlanOther.sfcCaregivers`.
  - **Checks.** An assigned caregiver is checked by the engine's own rules, called as they are:
    CON-06 (a spouse or legal guardian as the paid CDS attendant), CON-07 (a close family member
    or a non-employee as an agency aide) and CON-17. Missing data is never a pass and never a
    block: Visit checks shows "Caregiver details are missing" under "Needs review" until the
    relationship and, for an agency service, the employment are entered. (An unanswered
    employment question used to read as "not an employee" in the engine; it is now CON-17's
    REVIEW, and only a stated No is CON-07's BLOCK.)
  - **Guard.** What is entered and who is assigned go through the guard (5.7). A change that
    would add a Must-fix result is refused in the panel (`role="alert"`) and nothing changes:
    "Not changed. This attendant can't be paid for this participant. A spouse or legal guardian
    can't be the CDS attendant."
- **Other programs** (CP4-7; `ProgramsPanel.tsx`, `programs.ts`). A panel "Other programs" (meta
  "None entered" or "N entered") beside Waivers, for a plan the person opened or built:
  "Optional. Enter PACE or a Department of Mental Health program this participant is in, with
  its dates. It is checked against the care plan, never guessed." Button "Add a program"; each
  row has "Program" (PACE; DD Shared Living; DD Residential Habilitation; DD Individualized
  Supportive Living; DMH self-directed services; DD waiver personal assistant services), "Start
  date", "End date" and "Remove program". Stored as optional `CarePlan.programs`.
  - **Checks.** PRG-01 (PACE rules out every HCBS service, Policy 4.35.3), PRG-02 (DD
    residential services rule out State Plan personal care, and DMH self-directed services rule
    out CDS and ILW, Policies 4.35.1 and 3.25) and PRG-03 (State Plan personal care before DD
    waiver personal assistance, REVIEW) run under Visit checks, with CDS-05 (CDS beside RCF/ALF
    personal care on the plan). CDS-01 to CDS-04 read one CDS authorization's task labels and
    transportation, so they are that service's own Checks.
  - **Not guarded.** An entered program is a fact about the participant, not a change to the
    schedule, so it is always recorded; refusing it would hide why the plan can't be used. What
    it rules out shows as "Must fix before you use this schedule" under Visit checks.

## 6. Accounts

### 6.1 Firebase setup (`features/auth/firebase.ts`)
- `initializeApp` with `import.meta.env.VITE_FIREBASE_*` (section 7.1). Export lazy getters
  `getAuthInstance()` and `getDb()`; this module is imported only by lazy routes.
- Auth persistence: `browserLocalPersistence`. Firestore: `initializeFirestore(app, {
  localCache: memoryLocalCache() })` — no IndexedDB cache, so nothing stays on shared
  computers after sign-out.
- Never call `getAnalytics` (D-05).

### 6.2 Sign up, sign in, reset, verify
- **Create account** (`/sign-up`): Your name, Work email, Password (show/hide toggle; hint
  "At least 12 characters"), button "Create account"; "Continue with Google" above, divider
  "or". On success: `updateProfile(displayName)`, `sendEmailVerification`, create
  `users/{uid}`, go to `/verify-email`.
- **Sign in** (`/sign-in`): Email, Password, "Sign in"; "Continue with Google"; links "Forgot
  password?" and "Create an account". Google uses `signInWithPopup`; if the popup is blocked,
  fall back to `signInWithRedirect`.
- **Reset password** (`/reset-password`): email field, "Send reset link". Always show "If an
  account uses that email, a reset link is on its way." (no account enumeration).
- **Verify email** (`/verify-email`): "Check your email. We sent a link to <email>." Buttons
  "I've verified my email" (reloads the user; continues if verified, otherwise "We don't see
  the verification yet. Open the link in the email, then try again.") and "Send the email
  again" (disabled for 60s after sending). Polls `reload()` every 5s while the tab is visible.
- **Sign out**: account menu → "Sign out" → `/` with toast "Signed out".

### 6.3 Agency (tenant)
- **Set up your agency** (`/app/new-agency`): Agency name (2–120 characters), Workweek starts
  on (select, default Sunday; hint "Used for overtime checks"), State (read-only "Missouri"),
  Time zone (read-only "Central (America/Chicago)"). Button "Set up agency". One batched
  write: `tenants/{newId}` + `tenants/{newId}/members/{uid}` (owner) +
  `users/{uid}.lastTenantId`. Then `/app` with toast "Agency set up".
- **Agency details** (`/app/agency`): the same fields; owners can edit and "Save changes";
  others see read-only values and "Only an owner can change agency details."
- **Agency switcher**: when the person belongs to more than one agency, the shell's agency name
  opens a menu of agencies; choosing one sets `users/{uid}.lastTenantId` and reloads `/app`
  data. Current agency = `lastTenantId` if still a member, else the first membership.

### 6.4 Team and invites
- **Team** (`/app/agency/members`): table of members (name, email, role, joined) and pending
  invites (email, role, expires, "Copy link", "Revoke"). Owners see "Invite someone".
- **Invite dialog**: Email, Role (Scheduler: "Builds and changes schedules"; Viewer: "Can look
  but not change"; Owner: "Also manages agency details and the team"). Button "Create invite".
  Creates `invites/{id}` (section 7) expiring in 14 days, then shows the link
  `<origin>/join/<id>` with "Copy invite link" and "Open in my email app" (a `mailto:` with
  subject "Join <agency> on CarePlan Scheduler" and the link in the body). Toast "Invite link
  copied".
- **Change role / remove**: owners only, never on themselves. "Remove from team" asks in a
  Dialog: "Remove <name> from <agency>? They lose access right away." The last owner can't be
  removed or demoted (rules enforce: owners can't change their own membership).
- **Accept** (`/join/:inviteId`): signed in and verified. Shows "<agency> invited you to join as
  a Scheduler." with "Join <agency>" and "Not now". If the invite email differs from the
  signed-in email: "This invite is for j***@example.com. Sign in with that email to accept it."
  Expired: "This invite expired on Nov 3, 2026. Ask the agency owner for a new one."
  Revoked or used: "This invite is no longer active." Joining is one batched write: member doc
  (with `inviteId`) + invite `status: "accepted"`, `acceptedBy`, `acceptedAt`.
- **Invite banner**: on `/app` and `/app/new-agency`, pending invites for the person's email
  show a banner with "Review invite" for each.

### 6.5 Session timeout
- Activity = pointer, key, touch, scroll or focus in the app, throttled to once per 15s.
- After 28 minutes idle, a Dialog: "You'll be signed out in 2 minutes" with a live countdown and
  "Stay signed in". At 30 minutes, sign out and go to `/sign-in?reason=timeout`, which shows
  "You were signed out after 30 minutes without activity."
- Shared across tabs through a `localStorage` timestamp (`cps.lastActive`) and the `storage`
  event, so activity in one tab keeps the others alive. Quick Schedule state survives (it's in
  sessionStorage), but the app shell is signed out.

### 6.6 Firebase error copy (`features/auth/errors.ts`)
| Code | Message |
|---|---|
| auth/invalid-credential, auth/wrong-password, auth/user-not-found | That email and password don't match. Try again or reset your password. |
| auth/email-already-in-use | An account already uses that email. Sign in instead. |
| auth/weak-password, auth/password-does-not-meet-requirements | Use at least 12 characters. |
| auth/invalid-email | Enter an email address like name@agency.com. |
| auth/too-many-requests | Too many tries. Wait a few minutes, then try again. |
| auth/popup-closed-by-user | (no message; return to the form) |
| auth/network-request-failed, unavailable | You're offline. Check your connection and try again. |
| permission-denied | You don't have access to that. Ask your agency owner. |
| anything else | That didn't work. Try again, and if it keeps happening, email support@thecdscloud.com. |

---

## 7. Data

### 7.1 Firebase web config (`apps/web/.env`, committed)
Firebase web config identifies the project; it is not a secret. Access is protected by
`firestore.rules` and Auth. Restrict the API key to the app's domains in Google Cloud Console
(see the setup list in PHASE-2-CLINE-PROMPTS.md).

```
VITE_FIREBASE_API_KEY=AIzaSyBM78FXLaYBGEcW6iCqt3tfMjEp2OVbl1Y
VITE_FIREBASE_AUTH_DOMAIN=care-plan-scheduler.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=care-plan-scheduler
VITE_FIREBASE_STORAGE_BUCKET=care-plan-scheduler.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1091152996503
VITE_FIREBASE_APP_ID=1:1091152996503:web:7c3fe58ad64562a2dfe1d2
VITE_USE_EMULATORS=false
```
`apps/web/.env.emulator` (committed) is used for local and e2e runs against the emulators
(`vite build --mode emulator`, `vite --mode emulator`):
```
VITE_USE_EMULATORS=true
VITE_FIREBASE_PROJECT_ID=demo-careplan
```
With it the app connects Auth to `127.0.0.1:9099` and Firestore to `127.0.0.1:8080`, and its
project ID matches `firebase emulators:exec --project demo-careplan`. A `demo-` project never
reaches real Firebase.

### 7.2 Collections

| Path | Fields | Written by |
|---|---|---|
| `users/{uid}` | `email` (lowercase), `displayName`, `createdAt`, `updatedAt`, `lastTenantId` (optional) | the user |
| `tenants/{tenantId}` | `name`, `state: "MO"`, `timeZone: "America/Chicago"`, `workweekStart: 0–6`, `createdAt`, `createdBy` | founder creates; owners update `name`, `workweekStart` |
| `tenants/{tenantId}/members/{uid}` | `uid`, `role: "owner" \| "scheduler" \| "viewer"`, `email` (lowercase), `displayName`, `joinedAt`, `inviteId` (absent for the founder) | founder (self, owner) or invitee (self, invited role); owners change `role` of others |
| `invites/{inviteId}` | `tenantId`, `tenantName`, `email` (lowercase), `role`, `status: "pending" \| "accepted" \| "revoked"`, `createdAt`, `createdBy`, `expiresAt`, `acceptedBy`, `acceptedAt` | owners create and revoke; invitee accepts |

Queries the app makes (all equality-only, so no composite indexes):
- my memberships: `collectionGroup("members").where("uid", "==", uid)`
- team: `tenants/{t}/members` (all)
- pending invites for me: `invites.where("email", "==", myEmail).where("status", "==", "pending")`
- agency invites: `invites.where("tenantId", "==", t).where("status", "==", "pending")`
Sort on the client.

---

## 8. `firestore.rules` (verbatim)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function verified() { return signedIn() && request.auth.token.email_verified == true; }
    function myEmail() { return request.auth.token.email.lower(); }
    function tenantPath(t) { return /databases/$(database)/documents/tenants/$(t); }
    function memberPath(t, uid) { return /databases/$(database)/documents/tenants/$(t)/members/$(uid); }
    function invitePath(id) { return /databases/$(database)/documents/invites/$(id); }
    function isMember(t) { return signedIn() && exists(memberPath(t, request.auth.uid)); }
    function isOwner(t) { return isMember(t) && get(memberPath(t, request.auth.uid)).data.role == 'owner'; }
    function validRole(r) { return r in ['owner', 'scheduler', 'viewer']; }
    function changedOnly(keys) { return request.resource.data.diff(resource.data).affectedKeys().hasOnly(keys); }
    function validTenantFields(d) {
      return d.name is string && d.name.size() >= 2 && d.name.size() <= 120
        && d.state == 'MO' && d.timeZone == 'America/Chicago'
        && d.workweekStart is int && d.workweekStart >= 0 && d.workweekStart <= 6;
    }

    function foundingOwner(t, u) {
      return !exists(tenantPath(t))
        && getAfter(tenantPath(t)).data.createdBy == u
        && request.resource.data.role == 'owner'
        && !('inviteId' in request.resource.data);
    }
    function acceptingInvite(t, u) {
      let inv = get(invitePath(request.resource.data.inviteId)).data;
      let after = getAfter(invitePath(request.resource.data.inviteId)).data;
      return verified()
        && inv.tenantId == t
        && inv.email == myEmail()
        && inv.status == 'pending'
        && inv.expiresAt > request.time
        && request.resource.data.role == inv.role
        && after.status == 'accepted'
        && after.acceptedBy == u;
    }

    match /users/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow create: if signedIn() && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['email', 'displayName', 'createdAt', 'updatedAt', 'lastTenantId'])
        && request.resource.data.email == myEmail()
        && request.resource.data.displayName is string && request.resource.data.displayName.size() <= 120
        && request.resource.data.createdAt == request.time;
      allow update: if signedIn() && request.auth.uid == uid
        && changedOnly(['displayName', 'updatedAt', 'lastTenantId', 'email'])
        && request.resource.data.email == myEmail()
        && request.resource.data.updatedAt == request.time
        && (!('lastTenantId' in request.resource.data)
            || exists(memberPath(request.resource.data.lastTenantId, uid))
            || existsAfter(memberPath(request.resource.data.lastTenantId, uid)));
      allow delete: if false;
    }

    match /tenants/{tenantId} {
      allow read: if isMember(tenantId);
      allow create: if verified()
        && request.resource.data.keys().hasOnly(['name', 'state', 'timeZone', 'workweekStart', 'createdAt', 'createdBy'])
        && validTenantFields(request.resource.data)
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.createdAt == request.time
        && getAfter(memberPath(tenantId, request.auth.uid)).data.role == 'owner';
      allow update: if isOwner(tenantId)
        && changedOnly(['name', 'workweekStart'])
        && validTenantFields(request.resource.data);
      allow delete: if false;

      match /members/{uid} {
        allow read: if isMember(tenantId) || (signedIn() && request.auth.uid == uid);

        allow create: if signedIn() && request.auth.uid == uid
          && request.resource.data.keys().hasOnly(['uid', 'role', 'email', 'displayName', 'joinedAt', 'inviteId'])
          && request.resource.data.uid == uid
          && request.resource.data.email == myEmail()
          && request.resource.data.displayName is string && request.resource.data.displayName.size() <= 120
          && request.resource.data.joinedAt == request.time
          && validRole(request.resource.data.role)
          && (foundingOwner(tenantId, uid) || acceptingInvite(tenantId, uid));

        allow update: if isOwner(tenantId) && request.auth.uid != uid
          && changedOnly(['role'])
          && validRole(request.resource.data.role);

        allow delete: if signedIn() && (
          (isOwner(tenantId) && request.auth.uid != uid)
          || (request.auth.uid == uid && resource.data.role != 'owner'));

      }
    }

    // Collection-group read of my own memberships.
    match /{path=**}/members/{uid} {
      allow read: if signedIn() && resource.data.uid == request.auth.uid;
    }

    match /invites/{inviteId} {
      allow read: if signedIn() && (
        (verified() && resource.data.email == myEmail())
        || isOwner(resource.data.tenantId));

      allow create: if isOwner(request.resource.data.tenantId)
        && request.resource.data.keys().hasOnly(['tenantId', 'tenantName', 'email', 'role', 'status', 'createdAt', 'createdBy', 'expiresAt'])
        && request.resource.data.status == 'pending'
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.createdAt == request.time
        && request.resource.data.expiresAt is timestamp
        && request.resource.data.expiresAt > request.time
        && request.resource.data.expiresAt <= request.time + duration.value(15, 'd')
        && request.resource.data.email is string
        && request.resource.data.email == request.resource.data.email.lower()
        && request.resource.data.email.matches('^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')
        && validRole(request.resource.data.role)
        && request.resource.data.tenantName == get(tenantPath(request.resource.data.tenantId)).data.name;

      allow update: if signedIn() && resource.data.status == 'pending' && (
        (isOwner(resource.data.tenantId)
          && changedOnly(['status'])
          && request.resource.data.status == 'revoked')
        || (verified()
          && resource.data.email == myEmail()
          && resource.data.expiresAt > request.time
          && changedOnly(['status', 'acceptedBy', 'acceptedAt'])
          && request.resource.data.status == 'accepted'
          && request.resource.data.acceptedBy == request.auth.uid
          && request.resource.data.acceptedAt == request.time
          && existsAfter(memberPath(resource.data.tenantId, request.auth.uid))));

      allow delete: if false;
    }

    // Everything else is closed.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The catch-all `/{document=**}` deny does not override the specific allows above (Firestore
grants access if any matching rule allows it); it documents intent and blocks new paths until
they get rules.

The invites `read` rule checks the invitee's own email before `isOwner(...)`. In a list query
filtered on `email`, `resource.data.tenantId` isn't fixed, so evaluating `isOwner` first is a
type error that denies the whole query (found in Prompt 10; R-18). The order doesn't change who
may read what.

Rules tests (`apps/web/rules-test/firestore.rules.test.ts`, emulator) cover at least:

| ID | Case | Expect |
|---|---|---|
| R-01 | unverified user creates tenant + owner member in one batch | denied |
| R-02 | verified user creates tenant + owner member in one batch | allowed |
| R-03 | verified user creates tenant without the member doc | denied |
| R-04 | user creates an owner member doc in an existing tenant they didn't create | denied |
| R-05 | member reads tenant; non-member reads tenant | allowed; denied |
| R-06 | scheduler updates tenant name; owner updates name; owner updates `state` | denied; allowed; denied |
| R-07 | owner creates invite (14 days, lowercase email, valid role, matching tenantName) | allowed |
| R-08 | scheduler creates invite; owner creates invite expiring in 30 days | denied; denied |
| R-09 | invitee (matching verified email) accepts: member doc with invite role + invite accepted, one batch | allowed |
| R-10 | invitee accepts with a higher role than the invite | denied |
| R-11 | someone with a different email accepts | denied |
| R-12 | accept an expired or revoked invite | denied |
| R-13 | owner changes another member's role; owner changes own role | allowed; denied |
| R-14 | owner removes another member; scheduler removes self; owner removes self | allowed; allowed; denied |
| R-15 | collection-group query of my memberships; query of someone else's | allowed; denied |
| R-16 | user writes another user's `users/{uid}` | denied |
| R-17 | any read or write to an unlisted collection | denied |
| R-18 | verified invitee lists their pending invites (`email` + `status` query); someone lists another email's | allowed; denied |

---

## 9. `vercel.json` and security headers

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "npm ci",
  "buildCommand": "npm run build -w @careplan/web",
  "outputDirectory": "apps/web/dist",
  "framework": null,
  "rewrites": [{ "source": "/((?!assets/).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin-allow-popups" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.googleusercontent.com; font-src 'self'; connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com; frame-src https://care-plan-scheduler.firebaseapp.com https://accounts.google.com; frame-ancestors 'none'; worker-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

`'unsafe-inline'` in `style-src` is needed for React `style` attributes (unit tile fill
percentages, meter widths). No inline scripts are allowed.

---

## 10. Performance budgets
- Public routes (`/`, `/quick`, `/rules`, `/privacy`): the JavaScript a page needs ≤ **180 KB
  gzip** total, and no chunk containing `firebase` is loaded. `apps/web/scripts/check-bundle.mjs`
  reads `dist/.vite/manifest.json` (enable `build.manifest`) and walks the manifest from the
  `index.html` key through each chunk's `imports`. It checks (1) the entry chunk and its static
  imports ≤ 180 KB, and (2) for each public page listed in its `PUBLIC_PAGES` (the page's source
  file, a lazy chunk), the entry plus that page's chunk and its static imports ≤ 180 KB. It fails
  if any of those chunks' source module ids include `node_modules/firebase` or
  `node_modules/@firebase`, or their code references the Firebase SDK. `npm run build` runs it.
  Decided in the Oct 23, 2026 review: React alone is about 100 KB, so a page-by-page budget is
  the one Quick Schedule can meet; the public header's phone navigation is a disclosure, not a
  Radix menu, which keeps Radix out of every public page.
- pdf.js is never in those chunks: check-bundle also fails if any of them contains `pdfjs-dist`
  code (search for `GlobalWorkerOptions`). It loads only through `import()` when a PDF is chosen.
- luxon is never in those chunks either (search for `Invalid DateTime`). It times visits
  (ENGINE-SPEC SCH-15), and public pages have none: they validate with `validatePlan`. Decided
  in the Oct 25, 2026 review: luxon was 21 KB gzip of both `/` and `/quick`.
- The printout (D-17) loads through `import()` only when someone prints: its own chunk
  (pdf-lib and fontkit, about 515 KB gzip, fontkit being most of it) and three Public Sans font
  files of about 18 KB each, all same-origin and cached for a year. It is never in a page's
  static imports, so it counts toward no page budget.
- Quick Schedule recomputes in one frame after a change on a mid-range laptop; a unit test
  times `buildQuickModel` for fixture B (11 months) and fails above 50 ms in CI. Reading the
  text of a plan's PDF takes under 20 ms.
- Fonts: one variable font file (latin subset) preloaded (`vite.config.ts` adds the
  `<link rel="preload">` for the hashed file at build time and fails the build if it's missing).

---

## 11. Acceptance checks

Playwright runs with the clock fixed at 2026-10-21 12:00 America/Chicago
(`page.clock.setFixedTime`), so "the viewed month" for fixture B is October 2026.

| ID | Check | How |
|---|---|---|
| AC-01 | First visit to `/quick`: the import panel, and the 5-day example built beneath it: day totals Mon..Fri `290, 285, 275, 270, 195`, "Every task read. Our total from these tasks matches Fusion's 466 units a month.", and "Ready to use". | Playwright |
| AC-02 | On Nov 20, 2025 (before B's plan starts), opening fixture B's PDF (`fusion-table-with-banner.pdf`) builds the schedule: read summary "SAMPLE PARTICIPANT B", "Read from Fusion · DCN 10000002", the 455 match line for a 30-day month, import panel hidden, "Ready to use" and "Follows every rule we check, for all 11 months.", and the chip "Fusion, for a 31-day month: 469 units − 23 transportation" (IMP-10). | Playwright |
| AC-03 | B with Fusion's figure at 440, in December 2025: "the schedule stops 320 minutes early, starting Dec 30, 2025", the line "Dec 30, 2025: Meal Prep/Eating 60 min, Bathing 45 min, Wash Dishes 15 min, Dressing/Grooming 5 min", and the Dec 31 cell shows "−195 min". | Playwright |
| AC-04 | With B: changing Monday's Bathing to 60 is refused: "Not changed. That would put Bathing over its 93 units in October 2026." and "Bathing can't have more than 45 minutes on Monday."; the week is unchanged. | Playwright |
| AC-05 | With B: Monday's Bathing 45 → 30 is accepted (SCH-03 not involved); Tuesday's 45 → 60 is refused with "The most Bathing can have on Tuesday is 55 minutes."; "Use 55 minutes" applies 55 and the status stays "Ready to use". | Playwright |
| AC-06 | Fixture D, opened as a PDF, shows "This PDF has 10 of the plan's 14 rows" and "Open the PDF that has every page of the care plan, or build with the 10 rows we have."; "Build with the 10 rows I have" builds it and the summary lists "Built from 10 of the plan's 14 rows." | Playwright |
| AC-07 | Opening a PDF of B-page1 ("This PDF has 10 of the plan's 16 rows"), then a second PDF of B-page2, builds one plan with 15 tasks and the 455 match line. | Playwright |
| AC-08 | Opening `fusion-table-with-banner.pdf` with the file input gives the same result as AC-02. Opening `fusion-table-only.pdf` asks for the plan dates; entering 2026-01-01 and 2026-12-31 builds it. | Playwright |
| AC-09 | A PDF with no care plan in it shows "We couldn't find care plan tasks in that PDF" and "Open the participant's care plan PDF from Fusion." The chooser's file input accepts only `application/pdf,.pdf`; a text file that reaches it anyway shows "That isn't a PDF" and builds nothing. The import panel has no text box. | Playwright |
| AC-10 | Selecting a second day for Clean Bath (1 day a week) shows "Clean Bath is authorized for 1 day a week. Unselect a day first." and changes nothing. | component test |
| AC-11 | Reloading keeps the plan, but the summary title becomes "Care plan from Fusion" and the DCN is gone. A new tab starts with the example. | Playwright |
| AC-12 | By hand: "Build a schedule by hand" opens the inputs; keyboard-only "dress" + Enter adds Dressing/Grooming and focuses its minutes; 60-minute transportation once a week shows "300 minutes a month = 20 units"; switching to Homemaker (ADW) removes tasks with the toast. | Playwright |
| AC-13 | By hand, the ENGINE-SPEC TC-01 tasks give day totals Sun..Sat `70, 90, 90, 90, 90, 90, 70` and month units 181 / 177 / 169 for 31-, 30- and 28-day months. | unit (model) |
| AC-14 | `/quick`, `/`, `/rules` load no Firebase and no pdf.js code until a PDF is chosen, and make no requests to Google domains. Opening a PDF requests only same-origin files. | check-bundle + Playwright request log |
| AC-15 | Privacy: during AC-02 to AC-08 and AC-24, `sessionStorage`, `localStorage` and the console never contain "10000002", "10000005" or "SAMPLE PARTICIPANT". | Playwright |
| AC-16 | Sign up → verify (emulator) → set up agency → invite a scheduler → second user accepts → both see each other on Team. | Playwright against emulators |
| AC-17 | Firestore rules tests R-01 to R-18 pass. | `npm run test:rules` |
| AC-18 | axe: zero violations on `/`, `/quick` (example, an import issue showing, and a built plan), `/rules`, `/sign-in`, `/sign-up`, `/app`, `/app/quick`, `/app/agency/members`, in light and dark. | Playwright |
| AC-19 | Everything works at 390 × 844 with no horizontal page scroll; the weekly grid scrolls inside its panel; the import panel stacks to one column. | Playwright |
| AC-20 | After 30 minutes idle (fake timers) the session signs out with the timeout message; activity in a second tab prevents it. | component test |
| AC-21 | `/rules` lists every rule in `RULE_CATALOG` (including SCH-17) with ID, status, severities and source, and the services table shows each ceiling from `MO_2026_07`. | component test |
| AC-22 | Engine: `RULE_CATALOG` matches ENGINE-SPEC section 5; TC-38 to TC-40 pass; all earlier engine tests pass. Import: IMP-T01 to IMP-T19 pass. | engine + import tests |
| AC-23 | Root `npm run typecheck`, `npm test`, `npm run build` pass; `.github/workflows/ci.yml` runs them plus e2e and rules tests. | CI / local |
| AC-24 | Opening `fusion-care-plan-report.pdf` (Fusion's care plan report, IMPORT-SPEC 1.3) builds the plan with no button press: read summary "SAMPLE PARTICIPANT E", "Read from Fusion · DCN 10000005", the 229 match line, the note "GHE (General Health Evaluation) is a nurse visit, so it's listed by month, not in the week.", and "Ready to use". | Playwright |
| AC-25 | On Oct 21, 2026: the 5-day example's month view starts at October 2026 with Previous month disabled; B (Dec 2025 to Oct 2026) builds with "Schedule starts Oct 1, 2026" and "for the one month left in the plan"; D (ended Jun 30, 2026) shows "This care plan has ended" and builds nothing. | Playwright |
| AC-26 | Daily task list: B's Monday "Visit length 5 h 15 min", "315 minutes = 21 units"; Sunday with transportation "235 minutes = 15 units + 10 min (175 for tasks, 60 for transportation)". Month balance: B in December 2025 "469 units", "Fusion, for 31 days"; every month's units on request (February 434). Review with the participant: today's date, printed, and cleared by a change. | Component tests |
| AC-27 | The printout (5.4 Print): B's PDF is one US Letter landscape page titled "Weekly care schedule", with "SAMPLE PARTICIPANT B", Sunday to Saturday, "5 h 15 min" and "3 h 55 min", every month's units and the footer, each day's minutes centered under its name, and every piece of text inside the margins with none overlapping, also with every CDS task and transportation. "Save as PDF" downloads "Care schedule 2025-11-20.pdf"; "Print schedule" opens it in a new tab, or downloads it where the browser shows no PDFs; Ctrl+P and `careplan:print` make the same printout once; only same-origin requests. | unit (read back with pdf.js) + component + Playwright |
| AC-28 | Whole care plan (5.8): fixture F (agency PC 226, CDS essential transportation 40, homemaker 5, two GHEs) builds with nothing to choose and opens on the whole care plan: each authorization matches Fusion on its own (226, 40, 5); agency Monday to Friday (715 minutes), CDS transportation 120 minutes on the quietest weekday (Friday), homemaker on Saturday; both GHEs listed by month; no month after Oct 31, 2026; zero Must fix. "Open HC" changes homemaker's days under its own rules and the week shows it; a reload keeps every service and the view without the name or DCN; axe passes in both themes; no sideways page scroll on a phone. | unit + component + Playwright |
| AC-29 | Whole care plan printout (5.8): F prints four US Letter landscape pages, the whole week first ("Services PC - Agency, PC - CDS, HC", every row naming its service, "Day total", "226 units in Oct · PA …", "Nurse visits May 2026 and Aug 2026", no "Units by month"), then each service's own page; every piece of text inside the margins with none overlapping. | unit (read back with pdf.js) + component |
| AC-30 | Nothing read is dropped (IMP-19): fixture G builds PC - CDS with nothing to choose and lists HDM, ADC, FMS, RN (RCF/ALF) and XYZ under Other authorizations, each in its own unit ("62 meals a month"), XYZ marked not recognized; its printout names all five; a label we have not seen can be kept instead of named; a reload keeps them; a plan saved before keeps loading; axe passes in both themes at desktop and phone width. | unit + component + Playwright |

---

## 12. Landing, Rules and Privacy pages

**Landing (`/`)** for agency owners and state reviewers. Left-aligned, no stock photos.
- Headline (40px, 700): "Open a Fusion care plan PDF. Get a schedule that follows Missouri's rules."
- Lead (17px, ink-2, ≤ 60ch): "Open the care plan PDF from Fusion. CarePlan
  Scheduler reads every task, checks its total against Fusion's, builds the week, and won't let
  anyone change it in a way that breaks a rule. Every check names the policy it comes from."
- Actions: primary "Try Quick Schedule" (`/quick`), secondary "Create agency account".
  Small line: "Quick Schedule needs no account. Nothing you open is uploaded."
- Live figure beside the headline (stacks below on phones): the example plan's Day total row
  with unit tiles and "Ready to use", computed by the engine on the page (no screenshot).
  This is the page's one memorable element. The example plan is fixture A built by the Quick
  Schedule model (Mon..Fri 290, 285, 275, 270, 195; Sunday and Saturday "Off"); the status is
  that model's status line, so it says "Ready to use" only because the checks pass. Caption:
  "Day totals for the example care plan, built and checked on this page."
- Four short sections, each a heading + 2 sentences + one concrete figure. Figures 1, 2
  and 4 are computed on the page by the engine and the import package (fixture A, TC-01,
  RULE_CATALOG); figure 3 is a static example of the refusal box, styled exactly like the
  real one:
  1. "Reads the care plan PDF from Fusion" — lead "Open the care plan PDF." and detail
     "Fusion's care plan PDFs are read in your browser, every page, and the plan stays on your
     computer."; figure: the match
     line "Every task read. Our total from these tasks matches Fusion's 466 units a month."
  2. "Built from tasks, not averages" — monthly units are never spread evenly across days;
     figure: the TC-01 week `70, 90, 90, 90, 90, 90, 70`.
  3. "Can't be edited out of compliance" — a change that breaks a rule is refused with the
     limit; figure: the refusal box for the 5-day example (starting this month), in its first
     month where Bathing has no room left (23 weekdays), e.g. on Oct 21, 2026: "Not changed. That
     would put Bathing over its 69 units in December 2026. Bathing can't have more than 45 minutes on Tuesday. To add time here, take
     it from another day first."
  4. "Every check names its source" — figure: one card with its source line.
- For state reviewers: one paragraph and a link "See every rule and its source" → `/rules`.
- Footer: "© 2026 CarePlan Scheduler", links Privacy, Rules and sources, and
  "Questions: support@thecdscloud.com" as selectable text.

**Rules and sources (`/rules`)**: intro sentence; rule pack name, ID and effective date; "Quick
Schedule builds a weekly pattern, not visits, so it runs the authorization and schedule checks,
and the 49-hour weekly limit (CON-09) on the pattern. SCH-14 and the other conflict and
eligibility checks are for visits, caregivers and enrollments, which come in a later release.";
tables grouped Authorization / Schedule / Conflicts and eligibility, generated from
`RULE_CATALOG` (ID, rule text, severities as pills, status, source); status explained in plain
words: VERIFIED "Checked against the cited DHSS source", VERIFIED (CDS) "Checked for CDS; for
other programs, results show as Needs review", VERIFIED basis "The cited source supports the
check; how strictly it applies is a product decision", PARTIAL "Partly confirmed; results
show as Needs review", APPROVED "Product decision, documented", OPEN "Waiting on DHSS".
Then "Services and monthly limits" from `MO_2026_07.services` (code, name, unit, monthly
ceiling or "—", weekly hour limit, source) and "Days-per-month factors" from
`daysPerMonthFactor` (1 → 5 … 7 → 31).

**Privacy (`/privacy`)**: plain-language page: Quick Schedule "reads the care plan PDF you
open, on your computer. Nothing you open is uploaded." and keeps everything in that tab (the participant's name and DCN only until the
page is reloaded or closed); accounts store name, email and agency details in Google Firebase (United States); no
advertising or analytics trackers; participant data arrives in a later release and will be
covered by a business associate agreement before any agency enters it; contact email.

---

## 13. Out of scope for Phase 2
Saving participants or their imported plans, caregivers, visits, the caregiver calendar,
exports other than print, billing, MFA, App Check, audit logs, Cloud Functions, custom email sending.
These start in Phase 3 or later. Phase 3 must add App Check and an audit log before any
participant data is stored, and a signed Google Cloud BAA must be in place first.
