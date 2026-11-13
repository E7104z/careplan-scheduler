import { describe, expect, it } from "vitest";
import {
  MO_2026_07,
  ruleCON01SameServiceOverlap,
  ruleCON02DifferentServiceOverlap,
  ruleCON03RespiteOverlap,
  ruleCON04CaregiverOverlap,
  ruleCON05CaregiverHours,
  ruleCON06AttendantRelationship,
  ruleCON07AgencyAide,
  ruleCON09WeeklyHours,
  ruleCON10NurseVisits,
  ruleCON13FirstVisit,
  ruleCON16WaiverEnrollments,
  ruleCON17QualificationData,
  type Caregiver,
  type ServiceAuthorization,
  type Visit,
  type WaiverCode,
  type WaiverEnrollment,
} from "../src/index.js";

function visit(fields: {
  id: string;
  participantId?: string;
  caregiverId?: string;
  serviceCode: ServiceAuthorization["serviceCode"];
  start: string;
  end: string;
}): Visit {
  return {
    id: fields.id,
    participantId: fields.participantId ?? "P-TEST-01",
    caregiverId: fields.caregiverId ?? "C-1",
    serviceCode: fields.serviceCode,
    start: fields.start,
    end: fields.end,
    taskIds: [],
  };
}

function auth(fields: {
  id: string;
  program: ServiceAuthorization["program"];
  serviceCode: ServiceAuthorization["serviceCode"];
  receivedDate?: string;
}): ServiceAuthorization {
  return {
    id: fields.id,
    participantId: "P-TEST-01",
    program: fields.program,
    serviceCode: fields.serviceCode,
    start: "2026-01-01",
    end: "2026-12-31",
    state: "active",
    suspensions: [],
    receivedDate: fields.receivedDate,
    revision: 1,
    tasks: [],
  };
}

function caregiver(fields: {
  id: string;
  relationships?: Caregiver["relationships"];
  agencyEmployee?: boolean;
  nurseLicense?: boolean;
  fcsrRegistered?: boolean;
}): Caregiver {
  return {
    id: fields.id,
    relationships: fields.relationships ?? {},
    agencyEmployee: fields.agencyEmployee,
    nurseLicense: fields.nurseLicense,
    fcsrRegistered: fields.fcsrRegistered,
  };
}

function enrollment(waiver: WaiverCode, start: string, end: string): WaiverEnrollment {
  return { participantId: "P-TEST-01", waiver, start, end };
}

describe("conflict rules", () => {
  it("TC-08a: CON-01 BLOCK for overlapping CDS visits", () => {
    const a = visit({ id: "v-1", serviceCode: "T1019U2", start: "2026-10-05T09:00", end: "2026-10-05T11:00" });
    const b = visit({ id: "v-2", serviceCode: "T1019U2", start: "2026-10-05T10:00", end: "2026-10-05T12:00" });
    expect(ruleCON01SameServiceOverlap([a, b]).some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("CON-01 WARN for overlapping agency service visits", () => {
    const a = visit({ id: "v-1", serviceCode: "T1019", start: "2026-10-05T09:00", end: "2026-10-05T11:00" });
    const b = visit({ id: "v-2", serviceCode: "T1019", start: "2026-10-05T10:00", end: "2026-10-05T12:00" });
    expect(ruleCON01SameServiceOverlap([a, b]).some((r) => r.severity === "WARN")).toBe(true);
  });

  it("TC-08b: CON-02 none for CDS + NURSE overlap", () => {
    const cds = visit({ id: "v-1", serviceCode: "T1019U2", start: "2026-10-05T09:00", end: "2026-10-05T11:00" });
    const nurse = visit({ id: "v-2", serviceCode: "T1001", start: "2026-10-05T10:00", end: "2026-10-05T10:30" });
    expect(ruleCON02DifferentServiceOverlap([cds, nurse], MO_2026_07)).toEqual([]);
  });

  it("TC-08c: CON-02 REVIEW for AGENCY_PC + HOMEMAKER overlap", () => {
    const apc = visit({ id: "v-1", serviceCode: "T1019", start: "2026-10-05T09:00", end: "2026-10-05T11:00" });
    const hm = visit({ id: "v-2", serviceCode: "S5130", start: "2026-10-05T10:00", end: "2026-10-05T12:00" });
    expect(ruleCON02DifferentServiceOverlap([apc, hm], MO_2026_07).some((r) => r.severity === "REVIEW")).toBe(true);
  });

  it("TC-07: CON-03 BLOCK for Respite overlapping CDS", () => {
    const respite = visit({ id: "v-1", serviceCode: "S5150", start: "2026-10-05T13:00", end: "2026-10-05T17:00" });
    const cds = visit({ id: "v-2", serviceCode: "T1019U2", start: "2026-10-05T14:00", end: "2026-10-05T15:00" });
    expect(ruleCON03RespiteOverlap([respite, cds]).some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("CON-03 BLOCK for a Basic respite block overlapping an Advanced respite block", () => {
    const basic = visit({ id: "v-basic", serviceCode: "S5150", start: "2026-10-05T13:00", end: "2026-10-05T17:00" });
    const advanced = visit({ id: "v-adv", serviceCode: "S5150TF", start: "2026-10-05T14:00", end: "2026-10-05T15:00" });
    expect(ruleCON03RespiteOverlap([basic, advanced]).some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("TC-32: CON-04 BLOCK for caregiver overlap across participants", () => {
    const a = visit({ id: "v-1", participantId: "P-1", caregiverId: "C-A", serviceCode: "T1019U2", start: "2026-10-05T09:00", end: "2026-10-05T11:00" });
    const b = visit({ id: "v-2", participantId: "P-2", caregiverId: "C-A", serviceCode: "T1019U2", start: "2026-10-05T10:00", end: "2026-10-05T12:00" });
    expect(ruleCON04CaregiverOverlap([a, b]).some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("TC-33: CON-05 WARN only when caregiver exceeds 40 h in a workweek", () => {
    const v = visit({ id: "v-1", serviceCode: "T1019U2", start: "2026-10-05T00:00", end: "2026-10-06T18:00" });
    const results = ruleCON05CaregiverHours([v], 0);
    expect(results.some((r) => r.severity === "WARN")).toBe(true);
    expect(results.some((r) => r.severity !== "WARN")).toBe(false);
  });

  it("TC-14: CON-06 BLOCK for CDS spouse, none for child", () => {
    const a = auth({ id: "a-1", program: "CDS", serviceCode: "T1019U2" });
    const v = visit({ id: "v-1", serviceCode: "T1019U2", start: "2026-10-05T09:00", end: "2026-10-05T10:00" });
    expect(ruleCON06AttendantRelationship([a], [
      caregiver({ id: "C-1", relationships: { "P-TEST-01": "child" } }),
    ], [v])).toEqual([]);
    expect(ruleCON06AttendantRelationship([a], [
      caregiver({ id: "C-1", relationships: { "P-TEST-01": "spouse" } }),
    ], [v]).some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("CON-06 REVIEW for ILW spouse", () => {
    const a = auth({ id: "a-1", program: "ILW", serviceCode: "T1019U6" });
    const spouse = caregiver({ id: "C-1", relationships: { "P-TEST-01": "spouse" } });
    const v = visit({ id: "v-1", serviceCode: "T1019U6", start: "2026-10-05T09:00", end: "2026-10-05T10:00" });
    expect(ruleCON06AttendantRelationship([a], [spouse], [v]).some((r) => r.severity === "REVIEW")).toBe(true);
  });

  it("TC-13: CON-07 BLOCK for AGENCY_PC aide who is a grandchild", () => {
    const a = auth({ id: "a-1", program: "AGENCY_PC", serviceCode: "T1019" });
    const c = caregiver({ id: "C-1", relationships: { "P-TEST-01": "grandchild" } });
    const v = visit({ id: "v-1", serviceCode: "T1019", start: "2026-10-05T09:00", end: "2026-10-05T10:00" });
    expect(ruleCON07AgencyAide([a], [c], [v]).some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("TC-11: CON-09 no result at exactly 49 h across a month boundary", () => {
    const daily: Record<string, number> = {
      "2029-01-28": 420, "2029-01-29": 420, "2029-01-30": 420, "2029-01-31": 420,
      "2029-02-01": 420, "2029-02-02": 420, "2029-02-03": 420,
    };
    expect(ruleCON09WeeklyHours(daily)).toEqual([]);
  });

  it("TC-25: CON-09 REVIEW when a Sunday-Saturday week exceeds 49 h", () => {
    const daily: Record<string, number> = {
      "2026-12-27": 450, "2026-12-28": 450, "2026-12-29": 450, "2026-12-30": 450,
      "2026-12-31": 450, "2027-01-01": 450, "2027-01-02": 450,
    };
    expect(ruleCON09WeeklyHours(daily).some((r) => r.severity === "REVIEW")).toBe(true);
  });

  it("TC-26: CON-09 WARN only for a rolling 7-day window over 49 h", () => {
    const daily: Record<string, number> = {
      "2026-12-27": 285, "2026-12-28": 285, "2026-12-29": 285, "2026-12-30": 285,
      "2026-12-31": 600, "2027-01-01": 600, "2027-01-02": 600,
      "2027-01-03": 600, "2027-01-04": 600, "2027-01-05": 600, "2027-01-06": 600,
      "2027-01-07": 180, "2027-01-08": 180, "2027-01-09": 180,
    };
    const results = ruleCON09WeeklyHours(daily);
    expect(results.some((r) => r.severity === "WARN")).toBe(true);
    expect(results.some((r) => r.severity === "REVIEW")).toBe(false);
  });

  it("TC-15: CON-10 BLOCK for two nurse visits on one date", () => {
    const v1 = visit({ id: "v-1", serviceCode: "T1001", start: "2026-10-05T09:00", end: "2026-10-05T09:30" });
    const v2 = visit({ id: "v-2", serviceCode: "T1001", start: "2026-10-05T10:00", end: "2026-10-05T10:30" });
    expect(ruleCON10NurseVisits([v1, v2]).some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("TC-15: CON-10 BLOCK for more than 26 nurse visits in 6 months", () => {
    const many: Visit[] = [];
    for (let d = 0; d < 27; d++) {
      const date = `2026-10-${String(d + 1).padStart(2, "0")}`;
      many.push(visit({ id: `v-${d}`, serviceCode: "T1001", start: `${date}T09:00`, end: `${date}T09:30` }));
    }
    expect(ruleCON10NurseVisits(many).some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("TC-11: CON-13 WARN when first visit is 12 days after receivedDate", () => {
    const a = auth({ id: "a-1", program: "AGENCY_PC", serviceCode: "T1019", receivedDate: "2026-10-01" });
    const v = visit({ id: "v-1", serviceCode: "T1019", start: "2026-10-13T09:00", end: "2026-10-13T10:00" });
    expect(ruleCON13FirstVisit([a], [v]).some((r) => r.severity === "WARN")).toBe(true);
  });

  it("CON-13 REVIEW when receivedDate is missing", () => {
    const a = auth({ id: "a-1", program: "AGENCY_PC", serviceCode: "T1019" });
    expect(ruleCON13FirstVisit([a], []).some((r) => r.severity === "REVIEW")).toBe(true);
  });

  it("TC-18: CON-16 BLOCK for overlapping waiver enrollments", () => {
    const results = ruleCON16WaiverEnrollments([
      enrollment("ILW", "2026-10-01", "2027-03-31"),
      enrollment("ADW", "2026-10-15", "2027-03-31"),
    ], []);
    expect(results.some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("TC-29: CON-16 no BLOCK for sequential, BLOCK for overlap", () => {
    const sequential = ruleCON16WaiverEnrollments([
      enrollment("ADW", "2026-09-01", "2026-10-10"),
      enrollment("ILW", "2026-10-11", "2027-03-31"),
    ], []);
    expect(sequential.filter((r) => r.severity === "BLOCK")).toEqual([]);

    const overlapping = ruleCON16WaiverEnrollments([
      enrollment("ADW", "2026-09-01", "2026-10-12"),
      enrollment("ILW", "2026-10-11", "2027-03-31"),
    ], []);
    expect(overlapping.some((r) => r.severity === "BLOCK")).toBe(true);
  });

  it("TC-30: CON-16 REVIEW for ILW visit with no enrollment", () => {
    const v = visit({ id: "v-1", serviceCode: "T1019U6", start: "2026-10-05T09:00", end: "2026-10-05T10:00" });
    expect(ruleCON16WaiverEnrollments([], [v]).some((r) => r.severity === "REVIEW")).toBe(true);
  });

  it("TC-35: CON-17 REVIEW for ILW attendant missing FCSR registration", () => {
    const a = auth({ id: "a-1", program: "ILW", serviceCode: "T1019U6" });
    const c = caregiver({ id: "C-1", relationships: { "P-TEST-01": "none" } });
    const v = visit({ id: "v-1", serviceCode: "T1019U6", start: "2026-10-05T09:00", end: "2026-10-05T10:00" });
    expect(ruleCON17QualificationData([a], [c], [v]).some((r) => r.severity === "REVIEW")).toBe(true);
  });
});
