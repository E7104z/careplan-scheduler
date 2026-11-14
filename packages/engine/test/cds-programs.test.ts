import { describe, expect, it } from "vitest";
import {
  ruleCDS01PromptingCueing,
  ruleCDS02WaitingTime,
  ruleCDS03LicensedTasks,
  ruleCDS04NemtTrips,
  ruleCDS05FacilityResidents,
  rulePRG01Pace,
  rulePRG02DmhPrograms,
  rulePRG03FundingSequence,
  type OtherProgram,
  type ProgramEnrollment,
  type ServiceAuthorization,
} from "../src/index.js";

// CP4-7: Policy 3.25 CDS task rules and program compatibility, flagged only from what the plan
// states or the person enters.

function auth(fields: Partial<ServiceAuthorization> & Pick<ServiceAuthorization, "id" | "program" | "serviceCode">): ServiceAuthorization {
  return {
    participantId: "P-TEST-01", start: "2026-11-01", end: "2027-04-30", state: "active", suspensions: [], revision: 1, tasks: [],
    ...fields,
  };
}

function cds(taskNames: string[], fields: Partial<ServiceAuthorization> = {}): ServiceAuthorization {
  return auth({
    id: "cds-1", program: "CDS", serviceCode: "T1019U2",
    tasks: taskNames.map((name, index) => ({
      id: `cds-1-t${index}`, serviceAuthId: "cds-1", taskCode: `FUSION:${name}`, name, minPerDay: 30, daysPerWeek: 7,
    })),
    ...fields,
  });
}

function enrolled(program: OtherProgram, start = "2026-11-01", end = "2027-04-30"): ProgramEnrollment {
  return { participantId: "P-TEST-01", program, start, end };
}

const severities = (results: { severity: string }[]) => results.map((r) => r.severity);

describe("CDS-01: no stand-alone prompting, cueing or stand-by as a CDS task (Policy 3.25)", () => {
  it.each(["Prompting/Cueing", "Stand-by assistance", "Standby", "Cueing", "prompting and cueing", "Encouragement"])(
    "a CDS task that is only %s → BLOCK", (name) => {
      const results = ruleCDS01PromptingCueing([cds([name])]);
      expect(severities(results)).toEqual(["BLOCK"]);
      expect(results[0]!.refs).toMatchObject({ serviceAuthId: "cds-1", taskId: "cds-1-t0" });
      expect(results[0]!.message).toContain(name);
    });

  it("prompting as part of another task → REVIEW, since it may be a component of a task (4.35.1)", () => {
    expect(severities(ruleCDS01PromptingCueing([cds(["Bathing with cueing"])]))).toEqual(["REVIEW"]);
  });

  it("a hands-on task → nothing; the same label on ILW or agency care → nothing (the rule is CDS's)", () => {
    expect(ruleCDS01PromptingCueing([cds(["Bathing", "Meal Prep/Eating"])])).toEqual([]);
    expect(ruleCDS01PromptingCueing([cds(["Assistance to stand", "Mobility/Transfer"])])).toEqual([]);
    expect(ruleCDS01PromptingCueing([{ ...cds(["Prompting/Cueing"]), program: "ILW", serviceCode: "T1019U6" }])).toEqual([]);
  });
});

describe("CDS-02: waiting time and respite are not CDS time (Policy 3.25)", () => {
  it.each(["Waiting time", "Wait at appointments", "Waiting", "Respite care"])("a CDS task that is only %s → BLOCK", (name) => {
    expect(severities(ruleCDS02WaitingTime([cds([name])]))).toEqual(["BLOCK"]);
  });

  it("waiting mentioned in another task → REVIEW; no mention → nothing", () => {
    expect(severities(ruleCDS02WaitingTime([cds(["Essential shopping and waiting"])]))).toEqual(["REVIEW"]);
    expect(ruleCDS02WaitingTime([cds(["Essential Shopping"])])).toEqual([]);
  });
});

describe("CDS-03: skilled or physician-ordered tasks are excluded (Policy 3.25)", () => {
  it("a CDS task naming therapy or skilled nursing → REVIEW, never BLOCK (a label can't show who ordered it)", () => {
    expect(severities(ruleCDS03LicensedTasks([cds(["Physical therapy exercises"])]))).toEqual(["REVIEW"]);
    expect(severities(ruleCDS03LicensedTasks([cds(["Skilled nursing"])]))).toEqual(["REVIEW"]);
    // Even a label that is nothing but "Therapy": who must perform or order it isn't on the plan.
    expect(severities(ruleCDS03LicensedTasks([cds(["Therapy"])]))).toEqual(["REVIEW"]);
  });

  it("library tasks → nothing", () => {
    expect(ruleCDS03LicensedTasks([cds(["Catheter Hygiene", "Medications", "Bowel/Bladder Routine"])])).toEqual([]);
  });
});

describe("CDS-04: NEMT-covered medical trips are not CDS transportation (Policy 3.25)", () => {
  it("CDS with transportation → one REVIEW (whether NEMT covers a trip isn't on the plan)", () => {
    const results = ruleCDS04NemtTrips([cds(["Bathing"], { transportMinutesPerMonth: 120 })]);
    expect(severities(results)).toEqual(["REVIEW"]);
    expect(results[0]!.refs.serviceAuthId).toBe("cds-1");
  });

  it("CDS with no transportation, or transportation on another service → nothing", () => {
    expect(ruleCDS04NemtTrips([cds(["Bathing"])])).toEqual([]);
    expect(ruleCDS04NemtTrips([cds(["Bathing"], { transportMinutesPerMonth: 0 })])).toEqual([]);
    expect(ruleCDS04NemtTrips([auth({ id: "pc-1", program: "AGENCY_PC", serviceCode: "T1019", transportMinutesPerMonth: 60 })])).toEqual([]);
  });
});

describe("CDS-05: RCF/ALF residents are not eligible for CDS (Policy 3.25)", () => {
  const rcf = auth({ id: "rcf-1", program: "RCF_PC", serviceCode: "T1019U3" });

  it("CDS and RCF/ALF personal care on overlapping dates → BLOCK on the CDS authorization", () => {
    const results = ruleCDS05FacilityResidents([cds(["Bathing"]), rcf]);
    expect(severities(results)).toEqual(["BLOCK"]);
    expect(results[0]!.refs.serviceAuthId).toBe("cds-1");
  });

  it("CDS that ended before the RCF/ALF care began → nothing (a move, not both at once)", () => {
    expect(ruleCDS05FacilityResidents([cds(["Bathing"], { end: "2026-12-31" }), { ...rcf, start: "2027-01-01" }])).toEqual([]);
  });

  it("CDS alone → nothing", () => {
    expect(ruleCDS05FacilityResidents([cds(["Bathing"])])).toEqual([]);
  });
});

describe("PRG-01: PACE excludes DSDS HCBS (Policy 4.35.3)", () => {
  const plan = [cds(["Bathing"]), auth({ id: "hm-1", program: "HOMEMAKER", serviceCode: "S5130" })];

  it("a PACE enrollment the person entered, overlapping HCBS → BLOCK on each overlapping authorization", () => {
    const results = rulePRG01Pace(plan, [enrolled("PACE", "2027-02-01", "2027-12-31")]);
    expect(results.map((r) => [r.severity, r.refs.serviceAuthId])).toEqual([["BLOCK", "cds-1"], ["BLOCK", "hm-1"]]);
  });

  it("PACE that ends before the plan starts → nothing; no enrollment entered → nothing (never inferred)", () => {
    expect(rulePRG01Pace(plan, [enrolled("PACE", "2026-01-01", "2026-10-31")])).toEqual([]);
    expect(rulePRG01Pace(plan, [])).toEqual([]);
  });
});

describe("PRG-02: DMH programs that exclude DSDS personal care (Policies 4.35.1 and 3.25)", () => {
  const statePlan = [
    cds(["Bathing"]),
    auth({ id: "pc-1", program: "AGENCY_PC", serviceCode: "T1019" }),
    auth({ id: "hm-1", program: "HOMEMAKER", serviceCode: "S5130" }),
  ];

  it.each<OtherProgram>(["DD_SHARED_LIVING", "DD_RESIDENTIAL_HABILITATION", "DD_ISL"])(
    "%s → BLOCK on State Plan personal care only, not on waiver services", (program) => {
      const results = rulePRG02DmhPrograms(statePlan, [enrolled(program)]);
      expect(results.map((r) => [r.severity, r.refs.serviceAuthId])).toEqual([["BLOCK", "cds-1"], ["BLOCK", "pc-1"]]);
    });

  it("DMH self-directed services → BLOCK on CDS and ILW (one self-direction program at a time), not agency care", () => {
    const ilw = auth({ id: "ilw-1", program: "ILW", serviceCode: "T1019U6" });
    const results = rulePRG02DmhPrograms([...statePlan, ilw], [enrolled("DMH_SELF_DIRECTED")]);
    expect(results.map((r) => [r.severity, r.refs.serviceAuthId])).toEqual([["BLOCK", "cds-1"], ["BLOCK", "ilw-1"]]);
  });

  it("dates that don't overlap → nothing", () => {
    expect(rulePRG02DmhPrograms(statePlan, [enrolled("DD_ISL", "2025-01-01", "2026-10-31")])).toEqual([]);
  });
});

describe("PRG-03: State Plan personal care before a comparable DD waiver service (Policy 4.35.1)", () => {
  it("DD waiver personal assistant services entered → REVIEW, never BLOCK (whether State Plan care is used up isn't on the plan)", () => {
    const withPc = rulePRG03FundingSequence([cds(["Bathing"])], [enrolled("DD_WAIVER_PERSONAL_ASSISTANT")]);
    expect(severities(withPc)).toEqual(["REVIEW"]);
    const without = rulePRG03FundingSequence([auth({ id: "hm-1", program: "HOMEMAKER", serviceCode: "S5130" })], [enrolled("DD_WAIVER_PERSONAL_ASSISTANT")]);
    expect(severities(without)).toEqual(["REVIEW"]);
    expect(without[0]!.message).not.toBe(withPc[0]!.message);
  });

  it("no DD waiver personal assistant enrollment → nothing", () => {
    expect(rulePRG03FundingSequence([cds(["Bathing"])], [enrolled("PACE")])).toEqual([]);
  });
});
