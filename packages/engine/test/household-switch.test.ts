import { describe, expect, it } from "vitest";
import {
  GUIDANCE, MO_2026_07, calculate3a, derivedServiceMonthUnits,
  type ServiceAuthorization, type StateParity3aFlags, type StateParity3aInput,
} from "../src/index.js";

// CP2-2 (audit correction 5): agency PC offers the 3a's 11 household rows (B33–B63), governed by
// the MED REL HC TASKS control row. The N29/N66 switch: a household task counts under Personal
// Care when "Medically Related Household tasks" is checked, else under Homemaker — never both.

const OFF: StateParity3aFlags = {
  personalCareRcfAlf: false, apcRcfAlf: false, nurseRcfAlf: false,
  medRelHousehold: false, homemakerRcfAlf: false, cdsBox: false,
};

/** The 3a's 11 household rows, in the sheet's order, at their low suggested minutes once a week. */
const HOUSEHOLD_ROWS: { taskCode: string; minPerDay: number; daysPerWeek: 1 }[] = GUIDANCE["3a"].flatMap((row) =>
  row.section === "HOMEMAKER" && row.taskCode !== null
    ? [{ taskCode: row.taskCode, minPerDay: row.minLow ?? 15, daysPerWeek: 1 }]
    : [],
);

function householdInput(medRel: boolean): StateParity3aInput {
  return {
    flags: { ...OFF, medRelHousehold: medRel },
    rows: HOUSEHOLD_ROWS.map(({ taskCode, minPerDay, daysPerWeek }) => ({
      section: "homemaker", taskCode, minPerDay, daysPerWeek,
    })),
    hdm: null,
    nurse: null,
    chore: { tasks: [] },
  };
}

/** The same rows as a by-hand agency PC authorization (what Quick Schedule builds). */
function agencyPcAuth(): ServiceAuthorization {
  return {
    id: "household-auth",
    participantId: "P-TEST-01",
    program: "AGENCY_PC",
    serviceCode: "T1019",
    start: "2027-01-01",
    end: "2027-12-31",
    state: "active",
    suspensions: [],
    revision: 1,
    tasks: HOUSEHOLD_ROWS.map((row, index) => ({
      id: `hh-${index}`,
      serviceAuthId: "household-auth",
      taskCode: row.taskCode,
      name: row.taskCode,
      minPerDay: row.minPerDay,
      daysPerWeek: row.daysPerWeek,
    })),
  };
}

describe("agency PC household rows (3a N29/N66 switch)", () => {
  it("takes exactly the 11 household rows the 3a prints (B33–B63)", () => {
    expect(HOUSEHOLD_ROWS.map((row) => row.taskCode)).toEqual([
      "CLEAN_BATH", "CLEAN_KITCHEN", "CLEAN_LIVING_AREA", "ESSENTIAL_CORRESPONDENCE",
      "IRON_MEND", "LAUNDRY", "MAKE_BED_CHANGE_LINENS", "MEALS_DISHES",
      "SHOPPING_ERRANDS", "TRASH", "WASH_WINDOWS_BLINDS",
    ]);
  });

  it("counts a household task under Personal Care, never Homemaker, when med-rel is on", () => {
    const result = calculate3a(householdInput(true), MO_2026_07);
    expect(result.subtotals.homemakerUnits).toBe(0);
    expect(result.subtotals.medRelHouseholdUnits).toBeGreaterThan(0);
    expect(result.subtotals.personalCareUnits).toBe(result.subtotals.medRelHouseholdUnits);
  });

  it("counts a household task under Homemaker, never Personal Care, when med-rel is off", () => {
    const result = calculate3a(householdInput(false), MO_2026_07);
    expect(result.subtotals.medRelHouseholdUnits).toBe(0);
    expect(result.subtotals.personalCareUnits).toBe(0);
    expect(result.subtotals.homemakerUnits).toBeGreaterThan(0);
  });

  it("the by-hand engine total equals the 3a N29 estimate for the same rows", () => {
    // By-hand agency PC sums the same per-task units the 3a puts into N29 when the household rows
    // are medically related.
    const engine = derivedServiceMonthUnits(agencyPcAuth(), 2027, 1);
    const worksheet = calculate3a(householdInput(true), MO_2026_07).subtotals.medRelHouseholdUnits;
    expect(engine).toBe(worksheet);
  });
});
