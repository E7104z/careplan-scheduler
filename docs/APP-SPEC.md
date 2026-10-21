# CarePlan Scheduler — App Specification (Phase 2)

Phase 2 puts the Phase 1 rules engine in front of people: a public site, sign-in, agency
accounts, and **Quick Schedule**. Nothing about a participant is stored in Phase 2.

This file is the source of truth for everything under `apps/web`, `firestore.rules`,
`firebase.json` and `vercel.json`. `docs/ENGINE-SPEC.md` stays the source of truth for
`packages/engine`. If a prompt and a spec disagree, stop and ask.

Visual and behavioral target: `docs/design/quick-schedule-prototype.html` (open it in a
browser; it runs the real engine). Tokens: `docs/design/tokens.css`.

**Done when:** the Vercel preview of the `phase-2-app` pull request works end to end: a
visitor builds a schedule in Quick Schedule without an account; an agency owner signs up,
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
| vitest | 3.2.4 | web (dev), same as engine |
| jsdom | 26.1.0 | web (dev) |
| @testing-library/react | 16.3.3 | web (dev) |
| @testing-library/user-event | 14.6.8 | web (dev) |
| @testing-library/jest-dom | 6.10.0 | web (dev) |
| @types/react, @types/react-dom | 19.3.0 | web (dev) |
| @playwright/test | 1.64.1 | web (dev) |
| @axe-core/playwright | 4.14.0 | web (dev) |
| @firebase/rules-unit-testing | 5.0.2 | web (dev) |
| firebase-tools | 14.27.0 | root (dev) |

Do not use newer majors (Vite 8, React Router 8, Vitest 5, TypeScript 7, Firebase 13). They
were not verified with the engine.

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
  docs/  APP-SPEC.md  ENGINE-SPEC.md  RULE-MAP.md  PHASE-2-CLINE-PROMPTS.md  design/
  packages/engine/              Phase 1 + RULE_CATALOG
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
        quick-schedule/   model.ts  grouping.ts  ruleCopy.ts  state.ts  QuickSchedule.tsx  ...
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
  bundle never contains Firebase (D-06, budget in section 10).
- On every route change, move focus to the page's `<h1>` and update `document.title` to
  `<Page> · CarePlan Scheduler`.

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
- Panels: `bg-surface border border-line rounded-md shadow-panel`. Not everything is a panel:
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
| Button | Variants `primary` (pine), `secondary` (surface + line-2 border), `quiet` (no border), `danger` (block). Sizes `md` 40px, `sm` 32px; 44px min height under 640px. Shows a spinner and keeps its width while `busy`; `aria-busy` set. |
| Field | Label above input, hint below, error below hint in `text-block` with `aria-describedby` and `aria-invalid`. Required fields say "Required" in the hint, not an asterisk. |
| NumberField | `inputmode="numeric"`, integer only, `min`/`max`/`step`; never coerces an empty field to 0. |
| Select | Native `<select>` styled with tokens (best for mobile and screen readers). |
| DayToggle | Seven toggle buttons Su Mo Tu We Th Fr Sa, `aria-pressed`, full day name as `aria-label`. Variants: `chosen` (solid pine), `auto` (pine tint with pine border = "we chose this day"), `off`. |
| Panel | Section with `h2` header row (title, meta text, tools slot) and body. |
| SeverityPill | Icon + word, never color alone: BLOCK `OctagonX` "Must fix"; REVIEW `CircleHelp` "Needs review"; WARN `TriangleAlert` "Check"; INFO `Info` "Good to know". |
| Dialog | Radix Dialog; title required; focus returns to the trigger; Escape closes; overlay `bg-overlay`. |
| Toast | Radix Toast, bottom-right (bottom-center on phones), 5s, `role="status"`. Message names the result of the action ("Invite link copied"). |
| Menu | Radix DropdownMenu for the account menu and agency switcher. |
| EmptyState | Short sentence saying what will appear here and the one action that starts it. |
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
- Touch targets ≥ 44px on screens under 640px wide.
- Status changes are announced: the Quick Schedule status line is `aria-live="polite"`.
- Tables have `<th scope>`; the weekly grid's cells have labels like
  "Bathing, Monday, 30 minutes. Change minutes".
- Contrast: the token pairs are chosen for ≥ 4.5:1 text contrast in both themes; do not put
  `text-ink-3` on `bg-sunk` for anything but placeholder text.

---

## 5. Quick Schedule

Quick Schedule is the prototype in `docs/design/quick-schedule-prototype.html`, rebuilt in
React with the components above. Match its layout, copy and behavior unless this section
says otherwise. Where the prototype and this section disagree, this section wins.

### 5.1 Layout
- Page intro: `h1` "Quick Schedule", one-sentence description, actions "Load example plan"
  and "Start blank".
- Notice (info style): "Nothing you enter here is saved to our servers or sent anywhere. It
  stays in this browser tab until you close it. Don't enter a participant's name or DCN."
- Two panes at ≥ 1060px: Care plan (360–400px) on the left, Schedule on the right. One column
  below 1060px with the status bar first, then Care plan, then the schedule panels.
- Care plan pane: Service, Tasks, Care days, Essential transportation (CDS and ILW only).
- Schedule pane: Status, Weekly schedule, Month, Checks, footnote on unit math.
- Inside `/app/quick` the same page renders inside the app shell; public `/quick` renders inside
  the public layout with a "Create agency account" call to action in the header.

### 5.2 Inputs and their rules

| ID | Input | Rule |
|---|---|---|
| QS-01 | Service | Native select of every rule-pack service with `unit === "15min"`, grouped: Consumer Directed Services (T1019U2), Independent Living Waiver (T1019U6), Agency model (T1019, T1019TF), Aged and Disabled Waiver (S5130, S5120, S5150, S5150TF). Option text `<name> · <code>`. Default T1019U2. Nurse visits (T1001) are not offered: they are visits, not tasks. |
| QS-02 | Changing service | Removes tasks whose `taskCode` isn't available to the new program, clears minute changes, keeps care days. Toast: "Removed 2 tasks that aren't part of Homemaker (ADW)" when any are removed. |
| QS-03 | Plan starts | `<input type="month">`, default next calendar month. Plan ends = start + 11 months, shown read-only. Changing it clears Fusion units. Plans always start on the 1st in Phase 2. |
| QS-04 | Add a task | Combobox. Options: `pack.tasks` where `programs` includes the service's program, `isTransport` is not true, and not already added; matches name or any alias, case-insensitive. Enter adds the highlighted option. New task: 15 min/day, every day, not pinned; focus moves to its minutes field with the value selected. No match: "No Homemaker (ADW) task matches "xyz"". All used: "Every task for this service is already added". |
| QS-05 | Minutes per day | Integer 1–1440, step 5. Empty or invalid: error "Enter whole minutes, like 15 or 30." and the task is left out of the schedule (not treated as 0) until fixed. A value that isn't a multiple of 5 is allowed (Fusion allows it) but shows the hint "Most care plans use 5-minute steps." |
| QS-06 | Days per week | Select 1–7, 7 shown as "Every day". Lowering it below the number of pinned days drops the latest pinned days. |
| QS-07 | Task days | DayToggle per task. Unpinned: shows the composer's days in the `auto` style and the hint "We chose the lightest days. Select a day to choose yourself." Selecting a day pins the task: the pinned set starts from the days currently shown and toggles that day. Pinned: solid style, hint "Your days · Let us choose" (the link unpins). A day that isn't a care day is disabled. **New:** a pinned set can't exceed Days per week: selecting one more shows the inline hint "Bathing is authorized for 3 days. Unselect a day first." and changes nothing. |
| QS-08 | Care days | DayToggle, default all seven. Turning a day off removes it from every pinned set and clears minute changes. None selected: error "Choose at least one care day." |
| QS-09 | Transportation | Minutes per trip (integer ≥ 0, step 5), trips per week (1–7), usual day (Sunday–Saturday, default Monday). Blank or 0 minutes = no transportation. Summary under the fields from `transportAllowance`: "300 minutes a month = 20 units. These come off the monthly units before tasks." plus ", 10 minutes left over" when `unallocatedMinutes > 0`. |
| QS-10 | Weekly grid cell | Selecting a scheduled cell turns it into a number field (Enter or blur saves, Escape cancels). 0 removes that day for that task. Changed cells get a warn-colored underline; a value above the task's minutes per day gets the warn background. "Undo my minute changes" appears in the panel header while any change exists. Changing a task's minutes, days, or pins clears that task's cell changes. |
| QS-11 | Fusion units this month | Integer ≥ 0, optional, stored per month in the plan. Hint: "If you have the authorized units from the Fusion care plan, enter them. Fusion's figure is always the one we check against." |
| QS-12 | Load example plan / Start blank | Example = CDS State Plan, next month: Bathing 30 × 3 pinned Mon/Wed/Fri; Assistance with Toileting 15 × 7; Meal Prep/Eating 45 × 7; Laundry (Home) 30 × 2 pinned Tue/Thu; Clean Kitchen 10 × 2 pinned Sun/Sat (ENGINE-SPEC TC-01). The page opens with the example the first time in a tab, and the notice says so until the first change. Start blank keeps the service and dates. |

### 5.3 Engine adapter (`features/quick-schedule/model.ts`, pure)
`buildQuickModel(state, pack): QuickModel`:
1. `tasks`: valid tasks (QS-05) mapped to `AuthorizedTask` with `serviceAuthId: "quick"`.
2. `allowance`: `transportAllowance(minPerTrip, tripsPerWeek)` when the program is CDS or ILW
   and minutes > 0; otherwise `null`.
3. `composeWeek({ tasks, activeDays, overrides: pinned sets, weeklyTransportMinutes:
   allowance ? minPerTrip × tripsPerWeek : 0, transportDay })`.
4. `entries`: composed entries with cell changes applied (`"<taskId>:<weekday>"` → minutes),
   entries with 0 minutes removed. Transportation is never a template entry.
5. `auth`: `{ id: "quick", participantId: "quick", program, serviceCode, start: <start>-01,
   end: <last day of start + 11>, state: "active", suspensions: [], revision: 1, tasks,
   transportMinutesPerMonth: allowance?.minutesPerMonth }` (omit the key when no allowance).
6. `template`: `{ id: "quick-template", participantId: "quick", start, end, entries,
   rulePackVersion: pack.id }`.
7. `monthlyAuthorizations`: one `{ source: "fusion", revision: 1 }` per month with Fusion units.
8. `results`: `validateSchedule({ pack, authorizations: [auth], monthlyAuthorizations,
   template, exceptions: [], visits: [], caregivers: [], enrollments: [], months: all 12 plan
   months, tenantWorkweekStart: 0 })`, or `[]` when there are no valid tasks.
9. Per-month figures for the month view: `expandMonth(template, [], y, m, start, end)`;
   `authorizedUnits = fusion ?? derivedServiceMonthUnits(auth, y, m)`;
   `transportUnits = monthTransportUnits(auth)`;
   `taskBudgetMinutes = max(0, authorizedUnits − transportUnits) × 15`;
   `scheduledTaskMinutes = Σ expanded minutes`; over when scheduled > budget (same test as
   SCH-08, so the meter and the checks always agree).

Memoize with `useMemo` on the state object; recompute on every input change (it takes
< 5 ms for 12 months).

### 5.4 Schedule pane
- **Status** (`aria-live="polite"`): no tasks → "Add tasks to start". Any BLOCK group →
  "N things to fix" (block icon) and "This schedule breaks a Missouri rule. Details are in
  Checks." Otherwise "Ready to use" (check icon) with "N items are worth a look in Checks." or
  "Every check passed for all 12 months." Figures: minutes a week, units in the viewed month
  (Fusion or calculated), care days a week.
- **Weekly schedule**: table with a row per task (name + "30 min · 3 days a week"), a
  transportation row on its day when set (italic, "Set aside, not a task"), and a Day total
  footer: minutes, "6 units" or "4 units + 10 min", and the **unit tiles**: one 10px square
  per whole 15-minute unit, four per row, plus a partly filled square for leftover minutes.
  Days that aren't care days show "Off". Header meta: "590 minutes a week · 39 units + 5 min".
  Legend: "One square = one 15-minute unit · Scheduled · Select a cell to change its minutes".
  Wider than its panel on phones → scrolls inside its own container.
- **Month**: previous/next buttons limited to the 12 plan months, month name between them.
  Meter: "<scheduled> units (+ <r> min) scheduled for tasks of <available> available", source
  chip "Fusion: 177 units" or "Calculated: 177 units" with " − 20 transportation" when set,
  bar in tile colors, the overflow part in block red, and "270 minutes over. See Checks below."
  when over. Then the Fusion units field (QS-11), then a calendar: weekday header, one cell
  per date with day number, minutes and units; days with no care are dashed and empty.
- **Checks**: section 5.5.
- Footnote: "Unit math follows DHSS rules for 15-minute units: weekly frequency factors,
  short-month proration for daily tasks, and whole units only. Every check names the rule it
  comes from. Checks marked "Needs review" use a rule DHSS hasn't confirmed yet, so they never
  count as passing." Link "See every rule and its source" → `/rules`.
- **Print**: "Print schedule" button in the page intro calls `window.print()`. Print styles:
  hide navigation, inputs and buttons; print the service, plan dates, weekly grid with day
  totals, the viewed month's calendar, the status line and the Must fix / Needs review checks;
  footer "Checked with CarePlan Scheduler under rule pack mo-2026-07 on <date>". Fits US Letter
  landscape.

### 5.5 Checks: grouping and copy (`grouping.ts`, `ruleCopy.ts`)
- Group results by `ruleId + severity + refs.taskId`. Each group keeps its months in order.
  One group = one card. Group counts (not raw results) drive the status line.
- Order: Must fix, Needs review, Check (each with a heading and count), then "Good to know"
  collapsed in a `<details>`.
- Card: plain title from the copy table + context ("Bathing, every month of the plan",
  "November 2026", "9 of 12 months"), one-line what-to-do, and a `<details>` with: "Months:
  Nov 2026, Dec 2026, …" (when more than one), "Rule SCH-08 · <engine message>", "Source:
  <RULE_CATALOG source>", "Checked under mo-2026-07".
- When a card refers to a task, a "Show in week" button scrolls to and highlights that task's
  row for 2 seconds.
- SCH-08 results with `refs.taskId` use the copy key `SCH-08/task`.
- No "No problems found" while any Needs review group exists.

Copy table (`ruleCopy.ts`, exported as `RULE_COPY`). A unit test checks every rule ID ×
severity in `RULE_CATALOG` has an entry (AUTH-13 and SCH-15 emit nothing and are exempt).

| Key | Severity | Title | What to do |
|---|---|---|---|
| AUTH-03 | REVIEW | Two state formulas give different units | DHSS's worksheet and the HCBS-3c form round this task differently. Compare with the Fusion care plan. |
| AUTH-03 | INFO | Task units calculated | Units for this task use the DHSS worksheet formula. |
| AUTH-05 | INFO | How monthly units are figured | Daily tasks are prorated by the days in each month. Other tasks use the DHSS weekly frequency factor. |
| AUTH-06 | WARN | Monthly figures are calculated, not imported | This plan came from the old web tool, so each month's units are our calculation. Check them against Fusion. |
| AUTH-07 | REVIEW | Our total doesn't match Fusion | We keep Fusion's number. Check the minutes and days per week you entered against the care plan. |
| AUTH-08 | INFO | Transportation time is set aside | Transportation minutes come off the monthly units before tasks are counted. |
| AUTH-09 | BLOCK | Respite is over its combined monthly limit | Basic and Advanced Respite together can't go over the monthly limit. |
| AUTH-09 | REVIEW | Fusion units are above the program limit | The units entered are higher than this service's monthly limit. Confirm the number with Fusion. |
| AUTH-11 | INFO | When ILW starts this month | This projects the day State Plan units run out and ILW units begin. |
| AUTH-12 | BLOCK | ILW isn't approved yet | Don't schedule ILW units until the ILW authorization is approved. |
| SCH-02 | BLOCK | A task is on more days than authorized | Unselect the extra day, or check the days per week on the care plan. |
| SCH-02 | WARN | A task is on fewer days than authorized | Add care days or choose more days for this task so it gets all its authorized days. |
| SCH-03 | WARN | A day has more minutes than the task allows | One day's minutes for this task are above its minutes per day. |
| SCH-08 | BLOCK | The schedule goes over the month's authorization | Lower some minutes or days, or check the monthly units against Fusion. |
| SCH-08/task | BLOCK | A task goes over its monthly units | Lower this task's minutes on the longer days, or check its minutes per day on the care plan. |
| SCH-11 | WARN | Same one-time change two months running | If this keeps happening, the care plan may need a change request. |
| SCH-12 | REVIEW | Partial month without a Fusion figure | The plan starts or ends mid-month. Enter that month's units from Fusion. |
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
| CON-09 | REVIEW | Over 49 hours in a Sunday–Saturday week | ILW and Respite are limited to 49 hours a week. Review this week. |
| CON-09 | WARN | Over 49 hours in a 7-day stretch | A 7-day window crossing two weeks goes over 49 hours. |
| CON-10 | BLOCK | Too many nurse visits | Nurse visits are limited to one a day and 26 in six months. |
| CON-13 | WARN | First visit is late | Agency personal care should start within 10 days of the referral. |
| CON-13 | REVIEW | Referral date is missing | Enter the date the referral was received. |
| CON-16 | BLOCK | Two waiver enrollments overlap | A participant can't be in two waivers on the same dates. |
| CON-16 | REVIEW | No waiver enrollment on file | This waiver service needs an enrollment record. |
| CON-17 | REVIEW | Caregiver details are missing | Add the caregiver's relationship and qualifications so we can check eligibility. |

Unknown rule ID or severity: show the engine message as the title and "Rule <id>" as detail,
and log nothing (no console noise in production).

### 5.6 State and storage (`state.ts`)
- One reducer (`useReducer`) owns `QuickState`: `serviceCode`, `startMonth`, `tasks[]`
  (`id`, `taskCode`, `name`, `minPerDay: number | null`, `daysPerWeek`, `pinned: Weekday[] |
  null`), `activeDays: boolean[7]`, `transport { minPerTrip, tripsPerWeek, day }`, `edits`,
  `fusion: Record<YYYY-MM, number>`, `viewMonth`, `isExample`.
- Task ids are `qt-1`, `qt-2`, … from a counter kept in state (no module-level mutable state).
- Persist to `sessionStorage` key `cps.quick.v1` on every change (debounced 300ms), restore on
  load if the shape validates; otherwise load the example. All storage access in try/catch.
- Never write Quick Schedule state to `localStorage`, Firestore, the URL, or the console.

---

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
        isOwner(resource.data.tenantId)
        || (verified() && resource.data.email == myEmail()));

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
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.googleusercontent.com; font-src 'self'; connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com; frame-src https://care-plan-scheduler.firebaseapp.com https://accounts.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" }
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
- Public routes (`/`, `/quick`, `/rules`): JavaScript loaded by `index.html` ≤ **180 KB gzip**
  total, and no chunk containing `firebase` is loaded. `apps/web/scripts/check-bundle.mjs`
  reads `dist/.vite/manifest.json` (enable `build.manifest`), sums gzip sizes of the entry chunk
  and its static imports, fails above the budget, and fails if any of those chunks' source
  module ids include `node_modules/firebase` or `node_modules/@firebase`. `npm run build` runs it.
- Quick Schedule recomputes in < 16 ms after an input change on a mid-range laptop (one frame);
  a unit test times `buildQuickModel` for the example plan and fails above 50 ms in CI.
- Fonts: one variable font file (latin subset) preloaded.

---

## 11. Acceptance checks

| ID | Check | How |
|---|---|---|
| AC-01 | `/quick` opens with the example plan and shows day totals Sun..Sat `70,90,90,90,90,90,70`, "590 minutes a week · 39 units + 5 min", and "Ready to use". | Playwright |
| AC-02 | For the example plan, the month view shows 181 units in 31-day months, 177 in 30-day months, 169 in a 28-day February (ENGINE-SPEC TC-01). | unit (model) + Playwright |
| AC-03 | Changing Monday's Bathing cell to 60 shows "2 things to fix": the over-the-month card and the Bathing card ("every month of the plan"), plus the "A day has more minutes than the task allows" check. "Undo my minute changes" restores "Ready to use". | Playwright |
| AC-04 | Entering 150 Fusion units for the first month shows the over-meter, "270 minutes over", a SCH-08 Must fix for that month, and an AUTH-07 Needs review. | Playwright |
| AC-05 | Turning Sunday off moves the 7-day tasks to 6 days and shows three "fewer days than authorized" checks, one per affected task. | Playwright |
| AC-06 | Adding "dress" through the picker with the keyboard only adds Dressing/Grooming and focuses its minutes field. | Playwright |
| AC-07 | 60-minute transportation once a week shows "300 minutes a month = 20 units" and the meter's " − 20 transportation". | Playwright |
| AC-08 | Switching to Homemaker (ADW) keeps only Clean Kitchen from the example, hides transportation, and shows the removal toast. | Playwright |
| AC-09 | Selecting a fourth day for Bathing (3 days a week, pinned) shows the inline hint and changes nothing. | component test |
| AC-10 | Reloading `/quick` keeps the plan; a new tab starts with the example. | Playwright |
| AC-11 | `/quick`, `/`, `/rules` load no Firebase code and make no requests to Google domains. | check-bundle + Playwright request log |
| AC-12 | Sign up → verify (emulator) → set up agency → invite a scheduler → second user accepts → both see each other on Team. | Playwright against emulators |
| AC-13 | Firestore rules tests R-01 to R-17 pass. | `npm run test:rules` |
| AC-14 | axe: zero violations on `/`, `/quick`, `/rules`, `/sign-in`, `/sign-up`, `/app`, `/app/quick`, `/app/agency/members`, in light and dark. | Playwright |
| AC-15 | Everything works at 390 × 844 (phone) with no horizontal page scroll; the weekly grid scrolls inside its panel. | Playwright |
| AC-16 | After 30 minutes idle (fake timers) the session signs out with the timeout message; activity in a second tab prevents it. | component test |
| AC-17 | `/rules` lists every rule in `RULE_CATALOG` with ID, status, severities and source, and the services table shows each ceiling from `MO_2026_07`. | component test |
| AC-18 | Engine: `RULE_CATALOG` matches ENGINE-SPEC section 5 exactly; engine tests still 112+ passing. | engine test |
| AC-19 | Root `npm run typecheck`, `npm test`, `npm run build` pass; `.github/workflows/ci.yml` runs them plus e2e and rules tests. | CI / local |

---

## 12. Landing, Rules and Privacy pages

**Landing (`/`)** for agency owners and state reviewers. Left-aligned, no stock photos.
- Headline (40px, 700): "Care plan schedules that follow Missouri's rules."
- Lead (17px, ink-2, ≤ 60ch): "Enter the tasks from a Fusion care plan. CarePlan Scheduler
  builds the week from those tasks, figures the units for every month the way DHSS does, and
  checks the schedule against each rule, naming the policy it comes from."
- Actions: primary "Try Quick Schedule" (`/quick`), secondary "Create agency account".
  Small line: "Quick Schedule needs no account and saves nothing."
- Live figure beside the headline (stacks below on phones): the example plan's Day total row
  with unit tiles and "Ready to use", computed by the engine on the page (no screenshot).
  This is the page's one memorable element.
- Three short sections, each a heading + 2 sentences + one concrete figure:
  1. "Built from tasks, not averages" — monthly units are never spread evenly across days;
     figure: the TC-01 week `70 · 90 · 90 · 90 · 90 · 90 · 70`.
  2. "Every check names its source" — figure: one SCH-08 card from the Checks list with its
     source line.
  3. "Fusion's number wins" — imported authorizations are never recalculated; figure: the
     meter with "Fusion: 177 units".
- For state reviewers: one paragraph and a link "See every rule and its source" → `/rules`.
- Footer: "© 2026 CarePlan Scheduler", links Privacy, Rules and sources, and
  "Questions: support@thecdscloud.com" as selectable text.

**Rules and sources (`/rules`)**: intro sentence; rule pack name, ID and effective date;
tables grouped Authorization / Schedule / Conflicts and eligibility, generated from
`RULE_CATALOG` (ID, rule text, severities as pills, status, source); status explained in plain
words: VERIFIED "Checked against the cited DHSS source", PARTIAL "Partly confirmed; results
show as Needs review", APPROVED "Product decision, documented", OPEN "Waiting on DHSS".
Then "Services and monthly limits" from `MO_2026_07.services` (code, name, unit, monthly
ceiling or "—", weekly hour limit, source) and "Days-per-month factors" from
`daysPerMonthFactor` (1 → 5 … 7 → 31).

**Privacy (`/privacy`)**: plain-language page: Quick Schedule keeps everything in the browser
tab; accounts store name, email and agency details in Google Firebase (United States); no
advertising or analytics trackers; participant data arrives in a later release and will be
covered by a business associate agreement before any agency enters it; contact email.

---

## 13. Out of scope for Phase 2
Saved participants, care plan import, caregivers, visits, the caregiver calendar, exports
other than print, billing, MFA, App Check, audit logs, Cloud Functions, custom email sending.
These start in Phase 3 or later. Phase 3 must add App Check and an audit log before any
participant data is stored, and a signed Google Cloud BAA must be in place first.
