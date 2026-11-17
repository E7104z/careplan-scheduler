# CarePlan Scheduler: Cline prompts for Coverage Phase 5 (Firebase-only hosting)

Nov 16, 2026. Drop this file in the repo as `docs/COVERAGE-PHASE-5-CLINE-PROMPTS.md`, then paste the prompts below into Cline one at a time, in order. Start the next prompt only after the current one's "Finish" list passes and you have looked at the result.

Phase 5 adds no new scheduling rules. It makes sure what the app shows, prints and claims is accurate, then proves it with tests and a release report.

## What is true about hosting (read this first)

- Vercel is completely removed. `vercel.json` is deleted, the repo is disconnected in Vercel, and the local `.vercel/` folder is gone. Nothing in this repo may use, mention or depend on Vercel again, except the history files listed in CP5-0.
- Firebase Hosting is the only host. Project `care-plan-scheduler`, live at https://care-plan-scheduler.web.app.
- Deploys happen only through GitHub Actions. The Deploy workflow runs on every merge to `main`, signs in with the `FIREBASE_TOKEN` repository secret, and runs `npx firebase-tools deploy --only hosting --project care-plan-scheduler`. Merging the Phase 5 pull request therefore deploys to production. Cline never merges and never deploys.
- The workflow deploys hosting only. Firestore rules and indexes are deployed by the owner by hand (`firebase deploy --only firestore:rules,firestore:indexes`). A hosting rollback does not roll those back.

## Rules for Cline in every prompt

1. Read `.clinerules` first. It is the house style and wins over anything here. If this file and `.clinerules` disagree, stop and report; do not choose.
2. Work only on branch `coverage-phase-5`, cut from `main` after Phase 4 is merged. Never commit to `main`, never `--force`, never merge a pull request.
3. Never run any deploy command (`firebase deploy`, `firebase hosting:*`, `npx firebase-tools`). Never edit `.github/workflows/`, `firebase.json`, `.firebaserc`, `firestore.rules`, `docs/design/tokens.css`, `docs/fixtures/`, or any spec, unless the prompt names it. Never read or print a secret or token value. If one of these looks wrong, stop and report.
4. Do not add anything named for, imported from, or configured for Vercel. Do not suggest it.
5. The shell is Windows PowerShell: no `&&`. Run commands one per line or separate with `;`.
6. Tests first, then the change, then a mutation check: break the behavior on purpose, confirm the new test fails, restore it. Say what you broke and what failed.
7. Integer-minute arithmetic only. Files under 300 lines, one concept per file, no `any`, no default exports, no TODO or stubs, no `console.log`.
8. New user-facing copy follows APP-SPEC 4.3 (sentence case, plain words, buttons say what happens, errors say how to fix it). Colors, fonts and radii come only from `tokens.css` through the Tailwind token names. No green. Accessibility is part of done: labels, keyboard path, visible focus, `aria-live` where the spec says, axe zero violations, 390 x 844 with no horizontal scroll.
9. Design choices marked (design) are decided. Follow them. If one cannot be built as written because the code says otherwise, stop and report; do not improvise a different design.
10. Standard finish (every "Finish" means all of these, with the summary lines pasted in your final message): `npm run typecheck`; `npm test`; `npm run build` (this runs `scripts/check-bundle.mjs`); and, when any UI changed, `npm run test:e2e -w @careplan/web`. Then commit with the message given and push the branch.

## Order

| Order | Prompt | Delivers |
| --- | --- | --- |
| 1 | CP5-0 | Stale hosting references removed; a guard test keeps them out |
| 2 | CP5-1 | One PDF carries the whole plan; screen, PDF and print agree |
| 3 | CP5-2 | Coverage line everywhere; review-every-authorization dialog |
| 4 | CP5-3 | Wording guard: no compliance claims while a review stands |
| 5 | CP5-4 | Out-of-scope programs stay visible |
| 6 | CP5-5 | Accessibility, phone and print pass; audit matrix; release report; pull request |

## Prompt CP5-0: Vercel is gone; make the repo say so

Read `.clinerules` first, then the "What is true about hosting" and "Rules for Cline" sections of `docs/COVERAGE-PHASE-5-CLINE-PROMPTS.md`.

Task: Vercel was removed from this project (`vercel.json` deleted, repo disconnected, `.vercel/` gone, hosting moved to Firebase Hosting, project `care-plan-scheduler`, deployed by the GitHub Actions "Deploy" workflow on merge to `main`). Remove every leftover reference from the live code and docs, and add a test so none can return.

Step 1. Create branch `coverage-phase-5` from `main`. Run `git grep -n -i vercel` and `git ls-files | Select-String -Pattern -i "vercel"` (file names). Paste the full list of hits in your first message, grouped as: (a) history files, (b) live docs, (c) code, config or package files, (d) workflows.

History files are NOT edited, because they record what was true then: `docs/PHASE-1-*`, `docs/PHASE-2-*`, `"All Schedules/"`, `docs/COVERAGE-PHASE-2-CLINE-PROMPT.md`, `docs/CLINE-PROMPTS-PDF-ONLY-AND-COVERAGE-3-5.md`, and `docs/COVERAGE-PHASE-5-CLINE-PROMPTS.md`.

Step 2. This prompt authorizes editing, for Vercel references only: `.clinerules`, `README.md` and any README in `apps/` or `packages/`, `docs/APP-SPEC.md`, `docs/MISSOURI-COVERAGE-AUDIT.md`, `docs/DSDS-QUESTIONS.md`, `docs/RULE-MAP.md`, `docs/ENGINE-SPEC.md`, `.gitignore`, and `package.json` files (scripts only).

- Where a live doc names Vercel as the host, a preview, a redeploy or a rollback, reword it to the Firebase fact: "Firebase Hosting (project care-plan-scheduler), deployed by the GitHub Actions Deploy workflow when a change is merged to main." A preview is a Firebase Hosting preview channel that the owner creates; Cline never creates one.
- Where a live doc says the hosting and BAA question covers "Google and Vercel", reword it to Google only (Firebase Hosting and Firestore). Do not change what the BAA question is.
- `.gitignore`: remove any `.vercel` line.
- `.clinerules`: add one bullet under the project facts: "Hosting is Firebase Hosting only. Vercel is not used and must not be reintroduced. Deploys run only through the GitHub Actions Deploy workflow on merge to main; no agent runs a deploy command."
- `package.json` scripts that call a vercel command: remove the script.

Step 3. STOP AND REPORT instead of editing if any hit in group (c) or (d) is more than text: an import of any `@vercel/*` package, a dependency or devDependency on `vercel` or `@vercel/*`, `VERCEL_*` environment variables read by code, or any reference inside `.github/workflows/`. List each with its file and line and wait. Do not refactor code or touch workflows in this prompt.

Step 4. Add `apps/web/test/hosting.test.ts` (node:fs and node:child_process in the test only):

- the word "vercel" (case-insensitive) appears in no file from `git ls-files`, except the history files above (match by path prefix);
- `vercel.json` and `.vercel` are not tracked;
- `firebase.json` exists, has a `hosting` section, and its `public` directory is the web build output (read the value; assert it is a non-empty string and that the directory name matches what `npm run build -w @careplan/web` produces);
- `package.json` files list no dependency whose name contains "vercel".

Mutation: add the word to a live doc and confirm the test fails, then remove it.

Finish: standard finish (no e2e needed unless UI files changed). Commit:
`chore: remove remaining Vercel references and guard against their return`.

## Prompt CP5-1: One PDF carries the whole plan; screen, PDF and print agree

Read first: `schedulePdf.ts`, `scheduleSheet.ts`, `planSheet.ts`, `printSchedule.ts`; the
`normalizeEvents` list from CP3-7; APP-SPEC 5.4 Print and 5.8 Print; tests `schedulePdf.test.ts`,
`ui-print.test.tsx`.

This prompt authorizes editing APP-SPEC 5.4 Print and 5.8 Print, and the audit's EXPORT-01 row.

Build:
- The whole-plan printout reads **only** from `normalizeEvents` and the existing sheet models, so
  every occurrence on the screen is in the PDF and the reverse. It adds: a **month calendar page**
  for each month still to come (each service's minutes and each event, marked and labeled in black
  and white as well as color); the **authorization legend** (each service's name, code, PA,
  provider, dates, unit, balance for the month); every **review finding** (Needs review items
  included); every **kept and unknown authorization** with its original rows; the caregiver
  assignments **by label only** ("Caregiver 1"), never names (memory-only rule); start times when
  set.
- The one-service printout still fits one US Letter landscape page (AC-27); the whole-plan printout
  pages grow as needed and each page footer reads "Checked with CarePlan Scheduler under rule pack
  mo-2026-07 on <date>".
- "Print schedule" and "Save as PDF" stay the only two outputs; the file name stays "Care schedule
  <date>.pdf", never with a name or DCN.
- Audit EXPORT-01 now reads "Screen, PDF and print agree": update its row.

Tests: **parity test:** make the PDF for fixture F with events placed, read it back with pdf.js, and
compare its list of occurrences (date, service, kind, quantity) with `normalizeEvents`: equal sets.
Same for fixture G (kept items present) and for a plan with an amendment. No name, DCN or caregiver
name in the PDF text. Existing print tests stay green. Mutation: drop one event from the PDF
builder and confirm the parity test fails.

Finish: standard finish with e2e. Commit: `feat(web): whole-plan PDF reads the same occurrences as the screen (EXPORT-01)`.

## Prompt CP5-2: Coverage line on every view and every printout, and "Review every authorization"

Read first: `ReadSummary.tsx`, `PlanOverview.tsx`, the plan summary sentence ("5 authorizations
read: 3 scheduled in the week, 2 nurse visits by month"), `others.ts`.

Build:
- A coverage line, counted from the plan, on the whole-plan view, on a one-service plan, and at the
  top of every printout: "X service authorizations recognized · Y scheduled · Z need a date · N
  administrative context · U unknown" and, when every worksheet row matched, "All task rows
  recognized". Counts use the Appendix 1 class (AUTO, APPOINTMENT, CONTEXT) the plan already knows.
- A button **Review every authorization** opening a dialog (Radix Dialog, as the app does): each
  authorization with its classification, its source page and rows as read (the CP2-6 raw view), and
  for an unknown one its original text. Nothing in it is editable; keep or map actions already in
  the import flow stay where they are.
- Unknown authorizations appear in the dialog, in the whole-plan view and on every printout, always.

Tests: counts for fixture F ("5 recognized, 3 scheduled, 2 need a date") and G; the line appears on
the screen and in the PDF; unknowns appear in all three places; the dialog is keyboard-operable with
focus returned on close; axe zero violations. Mutation: hide unknowns from the printout and confirm
the test fails.

Finish: standard finish with e2e. Commit: `feat(web): coverage line everywhere and a review-every-authorization dialog`.

## Prompt CP5-3: Completeness wording guard

Read first: `.clinerules`; `status.ts`, `ruleCopy.ts`, `Landing.tsx`, `schedulePdf.ts`, APP-SPEC 4.3.

Build a test that renders and extracts text from: the status line, the Checks panel, the whole-plan
view, every dialog, the landing and rules pages, and the PDF, for plans in each state (clean, with a
REVIEW, with a BLOCK, with an unknown authorization). Assert none of these phrases appears while a
REVIEW or BLOCK stands: "Missouri-approved", "fully compliant", "compliant", "approved by", "passes
all rules", "no problems found". Assert the status reads "Ready to use" with the review items
listed when only REVIEWs stand. If any copy fails, reword it. This prompt authorizes editing only
the copy the test finds, in the files it appears in.

Mutation: change one string to "Fully compliant" and confirm the guard fails.

Finish: standard finish. Commit: `test(web): no compliance claims while a review stands`.

## Prompt CP5-4: Out-of-scope programs stay visible

Read first: audit "Outside Appendix 1"; `others.ts`, the IMP-19 handling.

Build:
- Any authorization whose code is not in Appendix 1 shows as **Unsupported, kept for review**: its
  original rows as read, the page it came from, and what was recognized (code, dates, provider, units
  as printed). One fixed sentence: "This service is outside what CarePlan Scheduler schedules today.
  It is kept here and on the printout so nothing is lost." (Medically Complex Adult Waiver, Brain
  Injury Waiver, DMH developmental disability waivers, Medicare home health, hospice and private pay
  each need their own manual and rule pack; none is built here.) The app does not guess a program
  from a name.
- It never enters a unit total, the weekly pattern or the calendar; it is in the coverage line's
  "unknown" count and every printout.
- Update `otherReason` wording only as needed for this sentence.

Tests: fixture G's `XYZ H2015` shows the sentence, its rows and page; it is absent from totals; it is
on the PDF. Mutation: add its units to a total and confirm the test fails.

Finish: standard finish. Commit: `feat(web): out-of-scope authorizations kept visible with a fixed explanation`.

## Prompt CP5-5: Accessibility, phone and print pass, the audit, the release report, the pull request

Read first: `.clinerules`; `a11y.spec.ts`, `phone.spec.ts`, AC-18, AC-19, AC-27 to AC-30; the audit's
matrix; `firebase.json` and `.github/workflows/` (read only, never edit); the git log for CP4-9.

This prompt authorizes editing `docs/MISSOURI-COVERAGE-AUDIT.md` (section 8 statuses, section 5.1
"Now" column, section 7 phase marks) and adding `docs/COVERAGE-RELEASE-REPORT.md`.

Build:

- Add axe checks (desktop and phone, light and dark) for every view added in Phases 2 to 5: the
  calendar and its list, the balances, the caregivers panel, the amendment dialog, the review
  dialog, the unsupported card. Zero violations. Add a keyboard-only path through placing a nurse
  visit, an ADC day and a one-day change. The month grid has no horizontal page scroll at 390 x 844.
- PDF legibility: a test reads the generated PDFs and asserts no text smaller than the size the
  existing printouts use for body text, and that every page has the footer.
- Update the audit matrix: every row proven by a named test becomes PASS (name the test); rows
  waiting on DHSS stay EVIDENCE; nothing is marked PASS without a test. Update section 5.1 "Now" for
  all 21 services and mark Phases 2 to 5 in section 7.
- Write `docs/COVERAGE-RELEASE-REPORT.md` with these sections:
  1. The 21-service and 51-row coverage diff.
  2. Rule traceability: every rule in `RULE_CATALOG` with its source, status and test.
  3. The deterministic calculators and their fixtures.
  4. Fixture F end to end.
  5. Open DHSS questions (audit section 9).
  6. Security review: Quick Schedule is browser-only (nothing uploaded, nothing in storage or the
     console); caregiver and participant names stay in memory only. CP4-9 (agency-wide worker load,
     alias-only Firestore storage) was built and merged — PR #21, commit c758b6f, "feat(agency):
     worker load across participants with alias-only storage (CON-04, CON-05)". Cross-participant
     worker checks are shipped: CON-04 double-bookings BLOCK and CON-05 40-hour weeks WARN across
     the agency's participants, each shown by agency alias only (never name, DCN or address). The
     BAA decision was made by the owner on 2026-11-13 and covers Google only (Firebase Hosting and
     Firestore); live participant persistence stays disabled until the Google Cloud BAA is executed.
  7. Hosting and deploy: Firebase Hosting project `care-plan-scheduler`; deployed only by the GitHub
     Actions Deploy workflow on merge to `main`, hosting only (read the workflow and quote its deploy
     command, never any secret). Firestore rules and indexes are deployed by hand and are not
     covered by a hosting rollback. Report what `firebase.json` sets: the public directory, SPA
     rewrites, and any response headers. No header was lost in the move from `vercel.json` to
     `firebase.json`; include this comparison (already verified, do not recompute):

     | Item | `vercel.json` (old) | `firebase.json` (now) |
     | --- | --- | --- |
     | SPA rewrite | `/((?!assets/).*)` → `/index.html` | `**` → `/index.html` |
     | Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | same |
     | X-Content-Type-Options | `nosniff` | same |
     | Referrer-Policy | `strict-origin-when-cross-origin` | same |
     | Permissions-Policy | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | same |
     | Cross-Origin-Opener-Policy | `same-origin-allow-popups` | same |
     | X-Frame-Options | `DENY` | same |
     | Content-Security-Policy | present | present, superset (adds `https://www.google.com` to `script-src` and `frame-src`, `https://www.gstatic.com` to `frame-src`) |
     | assets Cache-Control | `public, max-age=31536000, immutable` | same |
     | Redirects | none | none |

     If a security header (for example a content security policy) is missing from `firebase.json`,
     list that as an open item. Do not edit `firebase.json`.
  8. Rollback plan: (a) in the Firebase console, Hosting, release history, roll back to the previous
     release; or (b) revert the merge commit on `main`, which makes the Deploy workflow publish the
     reverted build. Saved plans open in the previous version because every new plan field is
     optional. Rules and indexes roll back separately, by redeploying the previous
     `firestore.rules` and `firestore.indexes.json` from git.
  9. Open items for the owner: the empty Vercel project can be deleted from the Vercel dashboard
     (nothing depends on it); the Deploy workflow signs in with a `firebase login:ci` token
     (`FIREBASE_TOKEN`), which firebase-tools has marked deprecated in favor of service accounts, so
     plan that change; the DHSS questions; real-case validation (below).
  10. The result of every command in the standard finish, pasted.

Then open a pull request from `coverage-phase-5` to `main` titled
"Phase 5: PDF parity and completeness". The body lists every prompt CP5-0 to CP5-5 with its commit,
test counts and mutation results, links `docs/COVERAGE-RELEASE-REPORT.md`, and ends with:
"Merging this pull request deploys to production through the Deploy workflow." Do not merge.

Finish: standard finish with e2e (all projects). Commit:
`docs: coverage release report; audit matrix updated from tests`.

## After the last prompt (you, not Cline)

- Check the pull request's CI run is green, and read `docs/COVERAGE-RELEASE-REPORT.md` section 7 (headers) and section 6 (CP4-9).
- Optional preview before merging: build locally and create a Firebase Hosting preview channel from your own signed-in terminal, for example `firebase hosting:channel:deploy phase5 --project care-plan-scheduler --expires 7d`. Cline does not do this.
- Merge. The Deploy workflow publishes to https://care-plan-scheduler.web.app. Confirm the run is green and the site loads.
- Real-case validation: open real care plan PDFs on the live site in a private window and compare each month's units with Fusion. Do not commit any real plan.
- Send the DHSS questions in `docs/DSDS-QUESTIONS.md` plus the audit's questions 8 to 13. Every rule that waits on an answer stays REVIEW; do not present those as state-certified.
- Settle the BAA question (Google only) before any agency puts real participant data in hosted storage.
- If rules or indexes changed in this phase (they should not), deploy them by hand.
- Delete the empty Vercel project in the Vercel dashboard whenever you like.





