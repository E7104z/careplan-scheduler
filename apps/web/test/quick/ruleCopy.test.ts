import { describe, expect, it } from "vitest";
import { RULE_CATALOG } from "@careplan/engine";
import { RULE_COPY, copyFor } from "../../src/features/quick-schedule/ruleCopy";

const EXEMPT = new Set(["AUTH-13", "SCH-15", "SCH-17"]);

describe("Quick Schedule rule copy", () => {
  it("has an entry for every rule id and severity except the exempt rules", () => {
    for (const entry of RULE_CATALOG) {
      if (EXEMPT.has(entry.id)) continue;
      for (const severity of entry.severities) {
        expect(RULE_COPY[`${entry.id}/${severity}`]).toBeDefined();
      }
    }
  });

  it("omits only AUTH-13, SCH-15 and SCH-17", () => {
    expect(RULE_COPY["AUTH-13/INFO"]).toBeUndefined();
    expect(RULE_COPY["SCH-15/BLOCK"]).toBeUndefined();
    expect(RULE_COPY["SCH-17/BLOCK"]).toBeUndefined();
  });

  it("uses the task-level copy for SCH-08 with a taskId", () => {
    expect(copyFor("SCH-08", "BLOCK", { taskId: "t1" })).toBe(RULE_COPY["SCH-08/task"]);
    expect(copyFor("SCH-08", "BLOCK")).toBe(RULE_COPY["SCH-08/BLOCK"]);
    expect(copyFor("SCH-02", "BLOCK")).toBe(RULE_COPY["SCH-02/BLOCK"]);
  });
});
