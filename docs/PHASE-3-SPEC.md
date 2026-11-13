# CarePlan Scheduler — Phase 3 Specification

Source of truth for Phase 3. `docs/APP-SPEC.md` remains the source of truth for everything
Phase 2 built; this document adds Phase 3. It changes no Phase 2 file except the verbatim
`firestore.rules` additions in section 7, which each prompt applies. If this document and
APP-SPEC disagree, stop and ask.

Phase 3, in the founder's fixed order:
1. BAA (Prompt 1) · 2. App Check (Prompt 2) · 3. Audit log + MFA (Prompt 3) ·
4. Saved participants and plans (Prompt 4) · 5. Billing readiness (Prompt 5)

## 1. External prerequisites (founder actions, not code)

| Item | Founder action | Gates |
|---|---|---|
| Google Cloud BAA | Sign Google's BAA for Firebase before any PHI is stored | Prompt 4 |
| Customer BAA | Counsel reviews `docs/legal/business-associate-agreement.md` | Prompt 1 |
| App Check | Provision a reCAPTCHA Enterprise key; enable App Check enforcement in the console | Prompt 2 |
| MFA | Upgrade Firebase Auth to Identity Platform (Google Cloud) | Prompt 3 |
| Billing | Decide the provider and plan tiers (Stripe recommended) | Prompt 5 |

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| P3-01 | Each item merges to `main` before the next starts. | Later prompts read fields and rules earlier ones added. |
| P3-02 | The customer BAA is one versioned document (`1.0`): `docs/legal/business-associate-agreement.md` (canonical) and `features/agency/baaText.ts` (in-app rendering) must stay in sync. | One text, one version to accept. |
| P3-03 | BAA acceptance is per-tenant, owner-only, recorded as `baaVersion`, `baaAcceptedBy`, `baaAcceptedAt` on the tenant. No participant data may be written until `baaVersion` exists. | The BAA binds the agency (Covered Entity); only its owner signs. |
| P3-04 | App Check uses reCAPTCHA Enterprise and activates only when a site key is configured; emulator runs are unaffected. | Device attestation without breaking local dev. |
| P3-05 | MFA is TOTP (authenticator apps) via Identity Platform. Owners toggle `security.mfaRequired` per agency; when on, every member must enroll before entering `/app`. | Free, no SMS provider; matches HIPAA guidance. |
| P3-06 | The audit log is a top-level, append-only `auditLog` collection. Clients write only their own events; no update or delete; name and DCN never appear in an event. | Immutable trail; the no-PHI-in-diagnostics rule stays. |
| P3-07 | Saved participants and plans live under the tenant: `tenants/{t}/participants/{pid}` and `tenants/{t}/participants/{pid}/plans/{planId}`. A plan serializes the Quick Schedule `CarePlan` (APP-SPEC 5.3/5.8). | Participant is the scheduling entity (PHASE-3-UNIFIED-SCHEDULE). |
| P3-08 | **OPEN — participant name and DCN in storage.** APP-SPEC D-16 and IMPORT-SPEC I-3 say name and DCN never go to Firestore. Phase 3 is the point that changes for saved participants. Proposed: store `displayName` and `dcn`, tenant-scoped, gated by P3-03; confirm before Prompt 4 builds. | A scheduling product must identify the participant; this is a founder/legal call. |
| P3-09 | Billing readiness adds a plan gate and a Billing screen but no provider integration until the provider is chosen. | Never build an integration the founder hasn't chosen. |

## 3. BAA (Prompt 1)

- The document is `docs/legal/business-associate-agreement.md`; the in-app text is
  `features/agency/baaText.ts` exporting `BAA_VERSION = "1.0"`, `BAA_TITLE` and
  `BAA_SECTIONS: { heading, paragraphs[] }[]`.
- `tenants/{tenantId}` gains three optional fields, set together, owner-only:
  `baaVersion: string`, `baaAcceptedBy: string` (the owner's uid), `baaAcceptedAt: timestamp`.
- Route `/app/agency/baa` (member). The page shows the status and the full agreement:
  - Accepted: "Accepted on Nov 3, 2026 · version 1.0" plus the text.
  - Not accepted, owner: a checkbox "I am authorized to accept this agreement for <agency>"
    and button "Accept agreement"; on submit, `acceptBaa` writes the three fields, reloads,
    toasts "Agreement accepted".
  - Not accepted, not owner: "Only an owner can accept this agreement."
- Home's "Get your agency ready" checklist gains, first: "Accept the business associate
  agreement" (done when `tenant.baaVersion` is set; links to `/app/agency/baa`).
- `Agency details` gains a read-only "Business associate agreement" panel: accepted state and a
  "View the agreement" link; owners see "Review and accept" while not accepted.
- `firestore.rules`: the tenant `allow update` also allows an owner to set only the three BAA
  fields, with `baaAcceptedBy == request.auth.uid` and `baaAcceptedAt == request.time`
  (section 7). Rules tests R-19/R-20 cover it.

## 4. App Check (Prompt 2)

- `features/auth/firebase.ts` exports `getAppCheckInstance()`; when
  `VITE_FIREBASE_APPCHECK_SITE_KEY` is non-empty, `initializeAppCheck(app,
  { provider: new ReCAPTCHAEnterpriseProvider(key), isTokenAutoRefreshEnabled: true })`.
- `apps/web/.env` and `.env.emulator` gain the key variable (emulator empty). Public pages stay
  Firebase-free; the module is only imported by lazy routes (D-06).
- CSP in `vercel.json` adds `https://*.googleapis.com` to `script-src` if the reCAPTCHA
  provider needs it. The App Check debug token is never used in production.

## 5. Audit log + MFA (Prompt 3)

- `auditLog/{id}`: `actorUid`, `actorEmail` (lowercase), `tenantId`, `action` (a fixed string
  set), `target` (opaque id or path segment, never name or DCN), `at` (serverTimestamp).
  Create-only for the actor; members read their tenant's events; no update or delete.
- `features/audit/auditLog.ts` exposes `writeAudit(actor, event)` and an `AUDIT_ACTIONS` list:
  `account.sign-in`, `account.sign-out`, `account.session-timeout`, `security.mfa-enrolled`,
  `security.mfa-required-changed`, `compliance.baa-accepted`, `participant.created`,
  `participant.updated`, `participant.deleted`, `plan.saved`, `plan.printed`,
  `team.member-invited`, `team.role-changed`, `team.member-removed`, `agency.updated`.
- MFA: after the Identity Platform upgrade, `features/auth/mfa.ts` adds TOTP enroll
  (`multiFactor(user).enroll(...)`), `getMultiFactorResolver`, challenge resolution, and an
  `mfaRequired` branch in `AuthProvider` so an unenrolled member of a requiring agency sees the
  enrollment screen before `/app`. Tenant field `security.mfaRequired` (owner-only).

## 6. Saved participants and plans (Prompt 4)

- Gate: creating a participant requires the tenant to have `baaVersion` (P3-03), enforced in
  rules. Build only after the founder resolves P3-08.
- `tenants/{t}/participants/{pid}`: `displayName`, `dcn` (both per P3-08), `createdAt`,
  `createdBy`, `updatedAt`, `updatedBy`.
- `tenants/{t}/participants/{pid}/plans/{planId}`: the serialized `CarePlan` plus `name`,
  `planStart`, `planEnd`, `checksum`, `savedAt`, `savedBy`.
- UI: a Participants list (`/app/participants`), a participant detail with their saved plans,
  and "Save plan" from Quick Schedule inside `/app` writing the current `CarePlan` under the
  chosen participant. Everything stays behind the Quick Schedule guard (APP-SPEC 5.7).

## 7. `firestore.rules` additions (verbatim; each prompt applies its own)

Tenant update (Prompt 1) — replace the existing `allow update` with:

```
      allow update: if isOwner(tenantId) && (
        (changedOnly(['name', 'workweekStart']) && validTenantFields(request.resource.data))
        || (changedOnly(['baaVersion', 'baaAcceptedBy', 'baaAcceptedAt'])
            && request.resource.data.baaVersion is string
            && request.resource.data.baaVersion.size() >= 1
            && request.resource.data.baaVersion.size() <= 20
            && request.resource.data.baaAcceptedBy == request.auth.uid
            && request.resource.data.baaAcceptedAt == request.time)
      );
```

## 8. Routes added

| Path | Page | Access |
|---|---|---|
| `/app/agency/baa` | Business associate agreement | member (owner accepts) |
| `/app/participants` | Participants | member (Prompt 4) |
| `/app/participants/:pid` | Participant | member (Prompt 4) |
| `/app/billing` | Billing | owner (Prompt 5) |

## 9. Acceptance checks

| Id | Check |
|---|---|
| P3-AC-01 | An owner accepts the BAA; the tenant gains the three fields; Home ticks the item; Agency details shows the accepted date; a non-owner can read but not accept. |
| P3-AC-02 | Rules tests R-19/R-20 pass: owner-only, acceptor-is-caller, `acceptedAt == request.time`. |
| P3-AC-03 | App Check is on only with a key; emulator builds pass without one; public bundle stays Firebase-free (check-bundle). |
| P3-AC-04 | Audit events are append-only; a delete/update fails; no event contains a name or DCN. |
| P3-AC-05 | A member of an MFA-required agency without TOTP cannot reach `/app` until enrolled. |
| P3-AC-06 | A participant and its plan save, reload and re-open; nothing is written until the BAA is accepted. |

