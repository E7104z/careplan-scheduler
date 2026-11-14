# Phase 3 — Cline build prompts

Phase 3 spec: `docs/PHASE-3-SPEC.md`. Build in order, one prompt per branch, merge before the
next. Every prompt below already incorporates the repo rules in `.clinerules`; do not weaken
them. Stop and ask if the spec and an existing file disagree.

General "Finish" commands for every prompt (run in `apps/web` unless noted):
`npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npx playwright test` (Prompt 1 also
runs `npx vitest run --config ../../vitest.rules.config.ts` from the repo root).

---

## Prompt 1 — Customer BAA: document + in-app acceptance

Branch `phase-3/baa`. Commit: `feat: customer BAA with owner-only acceptance`.

**Read first:** `docs/PHASE-3-SPEC.md` §2–3 and §7; `docs/APP-SPEC.md` §4.3 (copy rules),
§5.1, §6.3, §6.6, §8; `firestore.rules`; `apps/web/src/features/agency/*`,
`src/features/auth/authContext.ts`, `src/pages/Home.tsx`, `src/layouts/AppLayout.tsx`,
`src/router.tsx`, `src/ui/*`, `apps/web/rules-test/firestore.rules.test.ts`,
`apps/web/test/pages.test.tsx`, `apps/web/test/agency.test.tsx`.

**Task:**
1. Add `docs/legal/business-associate-agreement.md` — the HIPAA BAA between the agency
   (Covered Entity) and Golden Care Alliance, LLC (Business Associate), version 1.0. Required
   45 CFR 164.504(e)/HITECH provisions: permitted uses and disclosures, BA obligations
   (safeguards, minimum necessary, breach reporting, subcontractors, accounting, Secretary
   access, return/destroy), CE obligations, term and termination, return/destroy on
   termination. No placeholders; a complete document.
2. Add `src/features/agency/baaText.ts` exporting `BAA_VERSION = "1.0"`, `BAA_TITLE`,
   `BAA_SECTIONS: { heading: string; paragraphs: string[] }[]` — the same text, no placeholder
   paragraphs.
3. `src/features/agency/types.ts`: extend `Tenant` with optional `baaVersion`,
   `baaAcceptedBy`, `baaAcceptedAt` (epoch ms). Add `acceptBaa` to the service interface and
   implement it in `src/features/agency/tenants.ts`: `updateDoc(tenantRef(t), { baaVersion,
   baaAcceptedBy, baaAcceptedAt: serverTimestamp() })`.
4. Convert the tenant snapshot through a defensive `asTenant` (in `docFields.ts` or
   `memberships.ts`) so `baaAcceptedAt` becomes epoch ms via `asMillis`.
5. Add `/app/agency/baa` (lazy) rendering `BAA_TITLE` + `BAA_SECTIONS` plus the status and the
   owner-only accept form per PHASE-3-SPEC §3; use `ToastHost` for "Agreement accepted".
6. `Home.tsx`: prepend the checklist item "Accept the business associate agreement"
   (done when `tenant.baaVersion`), linking to `/app/agency/baa`.
7. `AgencyDetails.tsx`: add a read-only "Business associate agreement" panel.
8. `firestore.rules`: apply the §7 tenant-update change verbatim.
9. Rules tests: add R-19 (owner accepts BAA with the three fields) and R-20 (a non-owner, or
   `baaAcceptedBy != caller`, or `baaAcceptedAt != request.time`, is denied). Unit tests for
   `baaText.ts` (version 1.0, non-empty sections) and the accept flow (owner accepts →
   `acceptBaa` called with the right fields; non-owner sees the read-only message).

**Finish:** all five commands above; paste the summary lines.

## Prompt 2 — App Check

Branch `phase-3/app-check`. Commit: `feat: App Check with reCAPTCHA Enterprise`.

**Read first:** `docs/PHASE-3-SPEC.md` §2 P3-04, §4; `src/features/auth/firebase.ts`,
`src/features/auth/AuthProvider.tsx`, `scripts/check-bundle.mjs`, `firebase.json`,
`apps/web/.env`, `apps/web/.env.emulator`, APP-SPEC §7.1, §10.

**Task:** Add `VITE_FIREBASE_APPCHECK_SITE_KEY` to both env files (empty in emulator). Add
`getAppCheckInstance()` to `firebase.ts` that initializes `ReCAPTCHAEnterpriseProvider` only
when the key is non-empty. Wire it so Firebase calls in the app obtain the App Check token;
keep the module out of the public bundle. If the reCAPTCHA enterprise script needs it, extend
the CSP in `firebase.json` (hosting `headers`). Add a unit test that the provider is not
initialized without a key.
Do not hardcode or commit a real site key.

**Finish:** `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npm run check:bundle` (or
`node scripts/check-bundle.mjs`), `npx playwright test`.

---

## Prompt 3 — Audit log + MFA

Branch `phase-3/audit-mfa`. Commit: `feat: append-only audit log and TOTP MFA`.

**Read first:** `docs/PHASE-3-SPEC.md` §2 P3-05/P3-06, §5; `firestore.rules`;
`src/features/auth/*`, `src/features/agency/*`, `src/layouts/AppLayout.tsx`.

**Task:** Add `features/audit/auditLog.ts` with `writeAudit` and `AUDIT_ACTIONS` (spec §5).
Add the `auditLog` collection rules (create-only, actor is caller, `at == request.time`,
no update/delete; members read their tenant's events). Call `writeAudit` from the
sign-in/out/timeout and BAA-accept paths (and leave hooks for Prompt 4). Add the
`security.mfaRequired` tenant field (owner-only) and the MFA module (TOTP enroll + challenge)
behind Identity Platform. Wire `AuthProvider` so an unenrolled member of a requiring agency is
sent to enrollment before `/app`. No PHI in any audit field; add a rule test that update and
delete of an audit doc are denied.

**Finish:** the five commands above.

---

## Prompt 4 — Saved participants and plans

Branch `phase-3/participants`. Commit: `feat: saved participants and plans`.

**Read first:** `docs/PHASE-3-SPEC.md` §2 P3-07/P3-08/P3-10, §6;
`docs/PHASE-3-UNIFIED-SCHEDULE.md`; `src/features/quick-schedule/*` (state model, the guard,
the `CarePlan` shape); `firestore.rules` (the participants/plans and `config/phiStorage` rules are
already applied).

**Task:** Add `features/participants/` service modules; `/app/participants` and
`/app/participants/:pid` pages; and "Save plan" from in-app Quick Schedule. P3-08 is resolved:
store `displayName` (no `dcn`), use the random document id as the internal participant id. Writes
are gated by both the tenant `baaVersion` and `config/phiStorage.enabled` (the rules enforce this).
Reuse the engine and the Quick Schedule guard; never re-implement schedule math. Every change still
passes the guard (APP-SPEC 5.7, rule 19a). Build and test with synthetic participants only.

**Finish:** the five commands above.

---

## Prompt 5 — Billing readiness

Branch `phase-3/billing`. Commit: `feat: billing plan gate and billing page`.

**Read first:** `docs/PHASE-3-SPEC.md` §2 P3-09; APP-SPEC §4.3, §6; the provider decision from
the founder.

**Task:** Add the chosen plan tiers (owner-only config), a Billing page for owners, and a
feature gate so the tenant's plan controls saved-participant limits. No payment-provider SDK
until the founder picks one; the page shows the plan and the limits, not a checkout.

**Finish:** the five commands above.

