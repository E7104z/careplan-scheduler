import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APPENDIX_1, MO_2026_07, findAppendix1, normalizeProcedureCode } from "../src/index.js";

// INV-01: every row of 3.00 Appendix 1 (rev. Jul 2026) is known, once, with one schedule class.
const REGISTRY = fileURLToPath(
  new URL("../../../docs/All Schedules/CarePlan_Service_Registry_2026-10-31.json", import.meta.url),
);

interface RegistryEntry { id: string; program: string; code: string; unit: string; monthly_max_units: number | null }
const registry = (JSON.parse(readFileSync(REGISTRY, "utf8")) as { services: RegistryEntry[] }).services;

// The table as DHSS printed it, read Oct 31, 2026 (https://health.mo.gov/book/export/html/3116).
const DHSS_TABLE: [code: string, unit: string, limit: string | null][] = [
  ["T1019TF", "15min", null],
  ["T1019U3 TF", "15min", null],
  ["T1001", "visit", "1 visit/day"],
  ["T1001U3", "visit", "1 visit/day"],
  ["T1019", "15min", "412 units/mo"],
  ["T1019U3", "15min", "438 units/mo"],
  ["T1019U2", "15min", "641 units/mo"],
  ["S5100HC", "15min", "1-40 units (10 hrs/day), 5 days per week"],
  ["S5130", "15min", null],
  ["S5120", "15min", null],
  ["S5170", "meal", "2/day"],
  ["S5150", "15min", "868 units/mo"],
  ["S5150TF", "15min", "868 units/mo"],
  ["T1019U6", "15min", "868 units/mo"],
  ["T2024U6", "month", null],
  ["T2040U6", "month", null],
  ["T2029U6", "actual_cost", null],
  ["T2028U6", "actual_cost", null],
  ["S5165U6", "actual_cost", null],
  ["S5100HB", "15min", "1-40 units (10 hrs/day), 5 days per week"],
  ["S5126HB", "day", "1 unit/day"],
];

const REGISTRY_UNIT: Record<string, string> = {
  "15_minutes": "15min", visit: "visit", meal: "meal", month: "month", actual_cost: "actual_cost", day: "day",
};

describe("INV-01 Appendix 1: all 21 services", () => {
  it("has DHSS's 21 rows in the table's order, with its codes, units and limits", () => {
    expect(APPENDIX_1.map((service) => [service.code, service.unit, service.limit])).toEqual(DHSS_TABLE);
  });

  it("has every service in the owner's registry exactly once, with the same program, code and unit", () => {
    expect(APPENDIX_1).toHaveLength(21);
    expect(new Set(APPENDIX_1.map((service) => service.id)).size).toBe(21);
    expect([...APPENDIX_1.map((service) => service.id)].sort()).toEqual(registry.map((entry) => entry.id).sort());
    for (const entry of registry) {
      const service = APPENDIX_1.find((candidate) => candidate.id === entry.id)!;
      expect([service.program, normalizeProcedureCode(service.code), service.unit], entry.id).toEqual([
        entry.program, normalizeProcedureCode(entry.code), REGISTRY_UNIT[entry.unit],
      ]);
    }
  });

  it("gives each service one schedule class: 10 from tasks, 6 by date, 5 with no caregiver time", () => {
    const count = (cls: string) => APPENDIX_1.filter((service) => service.scheduleClass === cls).length;
    expect([count("AUTO"), count("APPOINTMENT"), count("CONTEXT")]).toEqual([10, 6, 5]);
  });

  it("links a service to an engine service only when the rule pack has that code and unit", () => {
    for (const service of APPENDIX_1) {
      if (service.engineCode === null) continue;
      const def = MO_2026_07.services.find((candidate) => candidate.code === service.engineCode);
      expect(def, service.id).toBeDefined();
      expect(normalizeProcedureCode(service.code)).toBe(def!.code);
      expect(def!.unit === "visit" ? "visit" : "15min").toBe(service.unit);
    }
    // Every engine service is one of the 21.
    for (const def of MO_2026_07.services) {
      expect(APPENDIX_1.some((service) => service.engineCode === def.code), def.code).toBe(true);
    }
  });

  it("finds a service by its code without regard to case or spaces, and nothing for other codes", () => {
    expect(findAppendix1("T1019U3TF")?.id).toBe("MO_APC_RCF");
    expect(findAppendix1("t1019u3 tf")?.id).toBe("MO_APC_RCF");
    expect(findAppendix1("S5170")?.id).toBe("MO_ADW_HDM");
    expect(findAppendix1("T1019")?.id).toBe("MO_PC_AGENCY");
    expect(findAppendix1("H2015")).toBeUndefined();
    expect(findAppendix1("")).toBeUndefined();
  });

  it("never schedules a meal, a month, a cost or a covered day as 15-minute units", () => {
    for (const service of APPENDIX_1.filter((candidate) => !["15min", "visit"].includes(candidate.unit))) {
      expect(service.engineCode, service.id).toBeNull();
      expect(service.scheduleClass, service.id).not.toBe("AUTO");
    }
  });
});
