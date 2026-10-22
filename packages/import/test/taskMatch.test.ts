import { describe, expect, it } from "vitest";
import { matchTask } from "../src/taskMatch.js";
import { PACK } from "./helpers.js";

const codeOf = (name: string) => matchTask(PACK, name)?.taskCode ?? null;

describe("IMP-09 matching a Fusion task name to the rule pack", () => {
  it("matches the rule-pack name ignoring case and extra spaces", () => {
    expect(codeOf("Bathing")).toBe("BATHING");
    expect(codeOf("  bathing ")).toBe("BATHING");
    expect(codeOf("MEAL   PREP/EATING")).toBe("MEAL_PREP_EATING");
  });

  it("matches the aliases Fusion uses", () => {
    expect(codeOf("Asst. with Toileting")).toBe("ASSISTANCE_WITH_TOILETING");
    expect(codeOf("Asstance with Toileting")).toBe("ASSISTANCE_WITH_TOILETING");
    expect(codeOf("Asst. Transfer Device")).toBe("ASSISTIVE_TRANSFER_DEVICE");
    expect(codeOf("Essential Correspond")).toBe("ESSENTIAL_CORRESPONDENCE");
  });

  it("matches a unique prefix of 6 or more characters (Fusion truncates long names)", () => {
    expect(codeOf("Meal Prep")).toBe("MEAL_PREP_EATING");
    expect(codeOf("Essential Correspon")).toBe("ESSENTIAL_CORRESPONDENCE");
    expect(codeOf("Dressing/Gro")).toBe("DRESSING_GROOMING");
  });

  it("does not match a prefix shorter than 6 characters", () => {
    expect(codeOf("Bath")).toBeNull();
    expect(codeOf("Trash".slice(0, 5))).toBe("TRASH"); // an exact name, not a prefix
    expect(codeOf("Medic")).toBeNull();
  });

  it("does not match a prefix that fits more than one task", () => {
    expect(codeOf("Laundry (")).toBeNull();
    // Also the start of the agency task "Mobility/Transfer/Position"; the full name still matches.
    expect(codeOf("Mobility/T")).toBeNull();
    expect(codeOf("Mobility/Transfer")).toBe("MOBILITY_TRANSFER");
    expect(codeOf("Clean Ba")).toBe("CLEAN_BATH");
    expect(codeOf("Clean ")).toBeNull();
  });

  it("does not match a name that merely contains a task name", () => {
    expect(codeOf("Extra Bathing")).toBeNull();
    expect(codeOf("Pet Care")).toBeNull();
  });

  it("finds the transportation task by its alias-free name", () => {
    expect(matchTask(PACK, "Essential Transportation")?.isTransport).toBe(true);
  });
});
