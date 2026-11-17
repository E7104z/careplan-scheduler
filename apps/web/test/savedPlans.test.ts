import { beforeEach, describe, expect, it, vi } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../src/features/import/importFlow";
import { forgetOpenedPlan, openedPlanFor, rememberOpenedPlan } from "../src/features/agency/openedPlan";
import { openSavedPlan, PLAN_SCHEMA, planDates, SavedPlanError, savePlanFor } from "../src/features/agency/savedPlans";
import { defaultPlanName } from "../src/features/agency/SaveToAgencyForm";
import { canDelete, canSave, participantNameProblem, storageGate } from "../src/features/agency/storageGate";
import type { CarePlan } from "../src/features/quick-schedule/types";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// A stand-in for Firestore: documents by path, written by setDoc and read back by getDoc.
const store = new Map<string, Record<string, unknown>>();

vi.mock("../src/features/auth/firebase", () => ({ getDb: () => ({}) }));
vi.mock("firebase/firestore", () => {
  let counter = 0;
  const ref = (path: string) => ({ id: path.split("/").at(-1)!, path });
  return {
    collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }),
    doc: (parent: { path: string }, id?: string) => ref(`${parent.path}/${id ?? `generated-${++counter}`}`),
    setDoc: vi.fn(async (target: { path: string }, data: Record<string, unknown>) => void store.set(target.path, data)),
    getDoc: vi.fn(async (target: { path: string }) => ({ exists: () => store.has(target.path), data: () => store.get(target.path) })),
    serverTimestamp: () => "server-time",
    getDocs: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    writeBatch: vi.fn(),
  };
});

const ACTOR = { uid: "u-test-01", email: "p-test-01@example.com", displayName: "P-TEST-01", emailVerified: true };
const TENANT = "t-test-01";
const PARTICIPANT = "p-test-1";

function planF(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), MO_2026_07, new Date("2026-04-15T12:00:00-05:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture F should build");
  return outcome.plan;
}

beforeEach(() => store.clear());

describe("saved plans in the agency (PHASE-3-SPEC section 6)", () => {
  it("stores the tab's de-identified copy with its checksum, and opens to the same plan", async () => {
    const plan = planF();
    const identity = plan.services[0]!.identity!;
    const id = await savePlanFor(TENANT, PARTICIPANT, ACTOR, { planId: null, name: "Care plan Apr 2026 to Mar 2027", plan });
    const saved = store.get(`tenants/${TENANT}/participants/${PARTICIPANT}/plans/${id}`)!;

    expect(Object.keys(saved).sort()).toEqual(["carePlan", "checksum", "name", "planEnd", "planStart", "savedAt", "savedBy"]);
    expect(saved.savedBy).toBe(ACTOR.uid);
    expect((saved.carePlan as { schema: number }).schema).toBe(PLAN_SCHEMA);
    expect(saved.checksum).toMatch(/^[0-9a-f]{64}$/);
    const text = JSON.stringify(saved);
    expect(text).not.toContain(identity.name);
    expect(text).not.toContain(identity.dcn);

    const opened = await openSavedPlan(TENANT, PARTICIPANT, id);
    expect(opened).toEqual({ ...plan, services: plan.services.map((state) => ({ ...state, identity: null })) });
  });

  it("saving over a plan keeps its id", async () => {
    const plan = planF();
    const id = await savePlanFor(TENANT, PARTICIPANT, ACTOR, { planId: null, name: "First", plan });
    expect(await savePlanFor(TENANT, PARTICIPANT, ACTOR, { planId: id, name: "Second", plan })).toBe(id);
    expect(store.get(`tenants/${TENANT}/participants/${PARTICIPANT}/plans/${id}`)!.name).toBe("Second");
  });

  it("a plan whose text doesn't match its checksum isn't opened", async () => {
    const id = await savePlanFor(TENANT, PARTICIPANT, ACTOR, { planId: null, name: "Plan", plan: planF() });
    const path = `tenants/${TENANT}/participants/${PARTICIPANT}/plans/${id}`;
    const saved = store.get(path)!;
    const stored = saved.carePlan as { schema: number; json: string };
    store.set(path, { ...saved, carePlan: { ...stored, json: stored.json.replace('"units":', '"units": ') } });
    await expect(openSavedPlan(TENANT, PARTICIPANT, id)).rejects.toBeInstanceOf(SavedPlanError);
    await expect(openSavedPlan(TENANT, PARTICIPANT, "missing")).rejects.toBeInstanceOf(SavedPlanError);
  });

  it("names a plan by its months, never by a name", () => {
    const plan = planF();
    expect(planDates(plan).planStart <= planDates(plan).planEnd).toBe(true);
    expect(defaultPlanName(plan)).toMatch(/^Care plan [A-Z][a-z]{2} \d{4} to [A-Z][a-z]{2} \d{4}$/);
    expect(defaultPlanName(plan)).not.toContain(plan.services[0]!.identity!.name);
  });
});

describe("the storage gate", () => {
  const tenant = { name: "P-TEST-AGENCY-01", state: "MO", timeZone: "America/Chicago", workweekStart: 0 };

  it("needs the BAA, then the deployment flag", () => {
    expect(storageGate(tenant, true)).toBe("needs-baa");
    expect(storageGate({ ...tenant, baaVersion: "1.0" }, null)).toBe("loading");
    expect(storageGate({ ...tenant, baaVersion: "1.0" }, false)).toBe("storage-off");
    expect(storageGate({ ...tenant, baaVersion: "1.0" }, true)).toBe("open");
  });

  it("owners and schedulers save, only owners delete", () => {
    expect([canSave("owner"), canSave("scheduler"), canSave("viewer"), canSave(null)]).toEqual([true, true, false, false]);
    expect([canDelete("owner"), canDelete("scheduler")]).toEqual([true, false]);
  });

  it("an alias is required, short, and never a DCN", () => {
    expect(participantNameProblem("  ")).toMatch(/^Enter the name/);
    expect(participantNameProblem("x".repeat(121))).toBe("Use 120 characters or fewer.");
    expect(participantNameProblem("P-001 1000-0002")).toBe("Leave the DCN out. Use a name or your agency's alias.");
    expect(participantNameProblem("P-001")).toBeNull();
  });
});

describe("which saved plan the tab's plan is", () => {
  it("is the one it was opened from or saved as, only for the same agency and the same authorizations", () => {
    const plan = planF();
    rememberOpenedPlan({ tenantId: TENANT, participantId: PARTICIPANT, planId: "plan-1" }, plan);
    expect(openedPlanFor(TENANT, plan)).toMatchObject({ participantId: PARTICIPANT, planId: "plan-1" });
    // Another agency, or another care plan opened since (new authorization ids), is not that plan.
    expect(openedPlanFor("t-test-02", plan)).toBeNull();
    expect(openedPlanFor(TENANT, planF())).toBeNull();
    forgetOpenedPlan();
    expect(openedPlanFor(TENANT, plan)).toBeNull();
  });
});
