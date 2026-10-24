// Firestore security rules tests R-01 to R-17 (APP-SPEC section 8), one `it` per expectation.
// Runs against the Firestore emulator: `npm run test:rules` inside `firebase emulators:exec`.
// The accept cases (R-09 to R-12) all send the same full batch, so each denial comes from the
// one thing that case changes, not from a missing write.
import { readFileSync } from "node:fs";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "demo-careplan";
const RULES = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8");

interface Person {
  uid: string;
  email: string;
  displayName: string;
}

const OWNER: Person = { uid: "u-test-owner", email: "p-test-owner@example.com", displayName: "P-TEST-OWNER" };
const SCHEDULER: Person = { uid: "u-test-sched", email: "p-test-sched@example.com", displayName: "P-TEST-SCHED" };
const INVITEE: Person = { uid: "u-test-invitee", email: "p-test-invitee@example.com", displayName: "P-TEST-INVITEE" };
const OTHER: Person = { uid: "u-test-other", email: "p-test-other@example.com", displayName: "P-TEST-OTHER" };

const TENANT = "t-test-01";
const TENANT_NAME = "P-TEST-AGENCY-01";
const INVITE = "i-test-01";

const DAY_MS = 24 * 60 * 60 * 1000;
const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();
const inDays = (days: number) => firebase.firestore.Timestamp.fromMillis(Date.now() + days * DAY_MS);

type Db = firebase.firestore.Firestore;

const tenantDoc = (db: Db, tenantId: string) => db.collection("tenants").doc(tenantId);
const memberDoc = (db: Db, tenantId: string, uid: string) =>
  db.collection("tenants").doc(tenantId).collection("members").doc(uid);
const inviteDoc = (db: Db, inviteId: string) => db.collection("invites").doc(inviteId);
const userDoc = (db: Db, uid: string) => db.collection("users").doc(uid);

let env: RulesTestEnvironment;

const verified = (person: Person) =>
  env.authenticatedContext(person.uid, { email: person.email, email_verified: true }).firestore();
const unverified = (person: Person) =>
  env.authenticatedContext(person.uid, { email: person.email, email_verified: false }).firestore();

const tenantFields = (name: string, createdBy: string) => ({
  name,
  state: "MO",
  timeZone: "America/Chicago",
  workweekStart: 0,
  createdAt: serverTimestamp(),
  createdBy,
});

const memberFields = (person: Person, role: string) => ({
  uid: person.uid,
  role,
  email: person.email,
  displayName: person.displayName,
  joinedAt: serverTimestamp(),
});

const inviteFields = (createdBy: string, expiresAt: firebase.firestore.Timestamp) => ({
  tenantId: TENANT,
  tenantName: TENANT_NAME,
  email: INVITEE.email,
  role: "scheduler",
  status: "pending",
  createdAt: serverTimestamp(),
  createdBy,
  expiresAt,
});

async function seedTenant(tenantId: string, name: string, extra: Array<{ person: Person; role: string }> = []) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await tenantDoc(db, tenantId).set(tenantFields(name, OWNER.uid));
    await memberDoc(db, tenantId, OWNER.uid).set(memberFields(OWNER, "owner"));
    for (const { person, role } of extra) {
      await memberDoc(db, tenantId, person.uid).set(memberFields(person, role));
    }
  });
}

async function seedInvite(status: string, expiresAt: firebase.firestore.Timestamp) {
  await env.withSecurityRulesDisabled(async (context) => {
    await inviteDoc(context.firestore(), INVITE).set({ ...inviteFields(OWNER.uid, expiresAt), status });
  });
}

/** Tenant + founding owner member, the batch `createAgency` sends. */
function agencyBatch(db: Db, person: Person) {
  const batch = db.batch();
  batch.set(tenantDoc(db, "t-test-new"), tenantFields(TENANT_NAME, person.uid));
  batch.set(memberDoc(db, "t-test-new", person.uid), memberFields(person, "owner"));
  return batch;
}

/** Member doc with `inviteId` + invite accepted, the batch `acceptInvite` sends. */
function acceptBatch(db: Db, person: Person, role: string) {
  const batch = db.batch();
  batch.set(memberDoc(db, TENANT, person.uid), { ...memberFields(person, role), inviteId: INVITE });
  batch.update(inviteDoc(db, INVITE), { status: "accepted", acceptedBy: person.uid, acceptedAt: serverTimestamp() });
  return batch;
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: RULES } });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

describe("R-01 to R-04 setting up an agency", () => {
  it("R-01 denies an unverified user creating tenant + owner member in one batch", async () => {
    await assertFails(agencyBatch(unverified(OWNER), OWNER).commit());
  });

  it("R-02 allows a verified user creating tenant + owner member in one batch", async () => {
    await assertSucceeds(agencyBatch(verified(OWNER), OWNER).commit());
  });

  it("R-03 denies a verified user creating a tenant without the member doc", async () => {
    const db = verified(OWNER);
    await assertFails(tenantDoc(db, "t-test-new").set(tenantFields(TENANT_NAME, OWNER.uid)));
  });

  it("R-04 denies an owner member doc in an existing tenant the user didn't create", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await assertFails(memberDoc(verified(OTHER), TENANT, OTHER.uid).set(memberFields(OTHER, "owner")));
  });
});

describe("R-05 and R-06 reading and changing an agency", () => {
  it("R-05 allows a member to read the tenant", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await assertSucceeds(tenantDoc(verified(OWNER), TENANT).get());
  });

  it("R-05 denies a non-member reading the tenant", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await assertFails(tenantDoc(verified(OTHER), TENANT).get());
  });

  it("R-06 denies a scheduler updating the tenant name", async () => {
    await seedTenant(TENANT, TENANT_NAME, [{ person: SCHEDULER, role: "scheduler" }]);
    await assertFails(tenantDoc(verified(SCHEDULER), TENANT).update({ name: "P-TEST-AGENCY-02" }));
  });

  it("R-06 allows an owner updating the tenant name", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await assertSucceeds(tenantDoc(verified(OWNER), TENANT).update({ name: "P-TEST-AGENCY-02" }));
  });

  it("R-06 denies an owner updating state", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await assertFails(tenantDoc(verified(OWNER), TENANT).update({ state: "KS" }));
  });
});

describe("R-07 and R-08 creating invites", () => {
  it("R-07 allows an owner's invite: 14 days, lowercase email, valid role, matching tenantName", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await assertSucceeds(inviteDoc(verified(OWNER), INVITE).set(inviteFields(OWNER.uid, inDays(14))));
  });

  it("R-08 denies a scheduler creating an invite", async () => {
    await seedTenant(TENANT, TENANT_NAME, [{ person: SCHEDULER, role: "scheduler" }]);
    await assertFails(inviteDoc(verified(SCHEDULER), INVITE).set(inviteFields(SCHEDULER.uid, inDays(14))));
  });

  it("R-08 denies an owner's invite expiring in 30 days", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await assertFails(inviteDoc(verified(OWNER), INVITE).set(inviteFields(OWNER.uid, inDays(30))));
  });
});

describe("R-09 to R-12 accepting invites", () => {
  it("R-09 allows the invitee: member doc with the invite role + invite accepted, one batch", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await seedInvite("pending", inDays(14));
    await assertSucceeds(acceptBatch(verified(INVITEE), INVITEE, "scheduler").commit());
  });

  it("R-10 denies accepting with a higher role than the invite", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await seedInvite("pending", inDays(14));
    await assertFails(acceptBatch(verified(INVITEE), INVITEE, "owner").commit());
  });

  it("R-11 denies someone with a different email accepting", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await seedInvite("pending", inDays(14));
    await assertFails(acceptBatch(verified(OTHER), OTHER, "scheduler").commit());
  });

  it("R-12 denies accepting an expired invite", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await seedInvite("pending", inDays(-1));
    await assertFails(acceptBatch(verified(INVITEE), INVITEE, "scheduler").commit());
  });

  it("R-12 denies accepting a revoked invite", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await seedInvite("revoked", inDays(14));
    await assertFails(acceptBatch(verified(INVITEE), INVITEE, "scheduler").commit());
  });
});

describe("R-13 and R-14 changing and removing members", () => {
  it("R-13 allows an owner changing another member's role", async () => {
    await seedTenant(TENANT, TENANT_NAME, [{ person: SCHEDULER, role: "scheduler" }]);
    await assertSucceeds(memberDoc(verified(OWNER), TENANT, SCHEDULER.uid).update({ role: "viewer" }));
  });

  it("R-13 denies an owner changing their own role", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await assertFails(memberDoc(verified(OWNER), TENANT, OWNER.uid).update({ role: "scheduler" }));
  });

  it("R-14 allows an owner removing another member", async () => {
    await seedTenant(TENANT, TENANT_NAME, [{ person: SCHEDULER, role: "scheduler" }]);
    await assertSucceeds(memberDoc(verified(OWNER), TENANT, SCHEDULER.uid).delete());
  });

  it("R-14 allows a scheduler removing themselves", async () => {
    await seedTenant(TENANT, TENANT_NAME, [{ person: SCHEDULER, role: "scheduler" }]);
    await assertSucceeds(memberDoc(verified(SCHEDULER), TENANT, SCHEDULER.uid).delete());
  });

  it("R-14 denies an owner removing themselves", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await assertFails(memberDoc(verified(OWNER), TENANT, OWNER.uid).delete());
  });
});

describe("R-15 to R-17 memberships, users and everything else", () => {
  it("R-15 allows the collection-group query of my memberships", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await seedTenant("t-test-02", "P-TEST-AGENCY-02");
    await assertSucceeds(verified(OWNER).collectionGroup("members").where("uid", "==", OWNER.uid).get());
  });

  it("R-15 denies the collection-group query of someone else's memberships", async () => {
    await seedTenant(TENANT, TENANT_NAME);
    await assertFails(verified(OTHER).collectionGroup("members").where("uid", "==", OWNER.uid).get());
  });

  it("R-16 denies writing another user's users/{uid}", async () => {
    await assertFails(
      userDoc(verified(OWNER), OTHER.uid).set({
        email: OTHER.email,
        displayName: OTHER.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("R-17 denies reading an unlisted collection", async () => {
    await assertFails(verified(OWNER).collection("p-test-unlisted").doc("d-test-01").get());
  });

  it("R-17 denies writing an unlisted collection", async () => {
    await assertFails(verified(OWNER).collection("p-test-unlisted").doc("d-test-01").set({ note: "P-TEST" }));
  });
});
