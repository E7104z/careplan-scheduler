import { describe, expect, it } from "vitest";
import { MO_2026_07 } from "@careplan/engine";
import { addPage, emptyImportFlow, next } from "../../src/features/import/importFlow";
import { addCaregiver, planCaregivers, updateCaregiver } from "../../src/features/quick-schedule/caregivers";
import { planFromStored, storedPlan } from "../../src/features/quick-schedule/persistence";
import {
  decryptPlan,
  encryptPlan,
  PLAN_FILE_FORMAT,
  planFileName,
  PlanFileError,
  type PlanFileProblem,
} from "../../src/features/quick-schedule/planFile";
import type { CarePlan } from "../../src/features/quick-schedule/types";
import fixtureF from "@fixtures/fusion/F-care-plan-report-multi.txt?raw";

// APP-SPEC 5.9 on fixture F (PC - Agency, PC - CDS, HC). Names are made up ("Caregiver A").
const PASSPHRASE = "blue kitchen table by the window";

function planF(): CarePlan {
  const outcome = next(addPage(emptyImportFlow(), fixtureF), MO_2026_07, new Date("2026-04-15T12:00:00-05:00"));
  if (outcome.kind !== "ready") throw new Error("Fixture F should build");
  return outcome.plan;
}

async function problemOf(work: Promise<unknown>): Promise<PlanFileProblem | "none"> {
  try {
    await work;
    return "none";
  } catch (error) {
    if (error instanceof PlanFileError) return error.problem;
    throw error;
  }
}

describe("the saved plan file (APP-SPEC 5.9)", () => {
  it("opens with its passphrase to the same plan, name and DCN included", async () => {
    const plan = planF();
    expect(plan.services[0]!.identity).not.toBeNull();
    const text = await encryptPlan(plan, PASSPHRASE, "2026-04-15");
    const opened = await decryptPlan(text, PASSPHRASE);
    expect(opened.savedAt).toBe("2026-04-15");
    expect(opened.plan).toEqual(plan);
  });

  it("holds nothing readable: no name, DCN, PA or task in the file's text", async () => {
    const plan = planF();
    const identity = plan.services[0]!.identity!;
    const text = await encryptPlan(plan, PASSPHRASE, "2026-04-15");
    expect(text).not.toContain(identity.name);
    expect(text).not.toContain(identity.dcn);
    expect(text).not.toMatch(/T1019|S5130|Bathing/);
    expect(JSON.parse(text)).toMatchObject({ format: PLAN_FILE_FORMAT, version: 1, kdf: { iterations: 600000 } });
  });

  it("encrypts afresh each time: two saves of one plan differ", async () => {
    const plan = planF();
    expect(await encryptPlan(plan, PASSPHRASE, "2026-04-15")).not.toBe(await encryptPlan(plan, PASSPHRASE, "2026-04-15"));
  });

  it("keeps a caregiver's name out, as every other copy does", async () => {
    const added = addCaregiver(planF());
    const id = planCaregivers(added).at(-1)!.id;
    const named = updateCaregiver(added, id, { name: "Caregiver A" });
    const opened = await decryptPlan(await encryptPlan(named, PASSPHRASE, "2026-04-15"), PASSPHRASE);
    expect(planCaregivers(opened.plan).map((caregiver) => caregiver.name)).toEqual([undefined]);
  });

  it("a wrong passphrase doesn't open it", async () => {
    const text = await encryptPlan(planF(), PASSPHRASE, "2026-04-15");
    expect(await problemOf(decryptPlan(text, "blue kitchen table by the door"))).toBe("wrong-passphrase");
  });

  it("an edited header or ciphertext doesn't open it", async () => {
    const file = JSON.parse(await encryptPlan(planF(), PASSPHRASE, "2026-04-15"));
    const fewer = JSON.stringify({ ...file, kdf: { ...file.kdf, iterations: 599999 } });
    expect(await problemOf(decryptPlan(fewer, PASSPHRASE))).toBe("wrong-passphrase");
    const flipped = file.data.startsWith("A") ? `B${file.data.slice(1)}` : `A${file.data.slice(1)}`;
    expect(await problemOf(decryptPlan(JSON.stringify({ ...file, data: flipped }), PASSPHRASE))).toBe("wrong-passphrase");
  });

  it("a file this app didn't write is named as such; one from a later version can't be read", async () => {
    expect(await problemOf(decryptPlan("%PDF-1.7", PASSPHRASE))).toBe("not-a-plan-file");
    expect(await problemOf(decryptPlan(JSON.stringify({ format: "something-else" }), PASSPHRASE))).toBe("not-a-plan-file");
    const file = JSON.parse(await encryptPlan(planF(), PASSPHRASE, "2026-04-15"));
    expect(await problemOf(decryptPlan(JSON.stringify({ ...file, version: 2 }), PASSPHRASE))).toBe("unreadable");
    expect(await problemOf(decryptPlan(JSON.stringify({ ...file, kdf: { ...file.kdf, iterations: 1e9 } }), PASSPHRASE))).toBe(
      "unreadable",
    );
  });

  it("is named by the date only", () => {
    expect(planFileName("2026-11-16")).toBe("Care plan 2026-11-16.careplan");
  });
});

describe("one shape check for every stored copy", () => {
  it("drops the identity unless asked to keep it, and refuses a damaged plan", () => {
    const plan = planF();
    expect(planFromStored(storedPlan(plan))!.services[0]!.identity).toBeNull();
    expect(planFromStored(storedPlan(plan, { keepIdentity: true }))).toEqual(plan);
    const damaged = { ...storedPlan(plan), services: [] };
    expect(planFromStored(damaged)).toBeNull();
    expect(planFromStored("not a plan")).toBeNull();
  });
});
