import { describe, expect, it } from "vitest";
import { composeWeek, type AuthorizedTask } from "../src/index.js";

function task(id: string, name: string, minPerDay: number, daysPerWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7): AuthorizedTask {
  return { id, serviceAuthId: "auth-1", taskCode: id.toUpperCase(), name, minPerDay, daysPerWeek };
}

describe("composeWeek", () => {
  it("TC-09: active Sun/Tue/Thu/Sat with Bathing override", () => {
    const result = composeWeek({
      tasks: [
        task("toileting", "Toileting", 15, 7),
        task("meal", "Meal Prep/Eating", 45, 7),
        task("bathing", "Bathing", 30, 3),
        task("laundry", "Laundry (Home)", 30, 2),
      ],
      activeDays: [true, false, true, false, true, false, true],
      overrides: { bathing: [0, 2, 4] },
      weeklyTransportMinutes: 0,
      transportDay: 0,
    });

    const weekdays = new Set(result.entries.map((e) => e.weekday));
    expect([...weekdays].sort()).toEqual([0, 2, 4, 6]);

    const bathingDays = result.entries.filter((e) => e.taskId === "bathing").map((e) => e.weekday).sort();
    expect(bathingDays).toEqual([0, 2, 4]);
  });

  it("auto placement never exceeds daysPerWeek for any task", () => {
    const tasks = [
      task("toileting", "Toileting", 15, 7),
      task("meal", "Meal Prep/Eating", 45, 7),
      task("bathing", "Bathing", 30, 3),
      task("laundry", "Laundry (Home)", 30, 2),
    ];
    const result = composeWeek({
      tasks,
      activeDays: [true, false, true, false, true, false, true],
      overrides: { bathing: [0, 2, 4] },
      weeklyTransportMinutes: 0,
      transportDay: 0,
    });
    for (const t of tasks) {
      const count = result.entries.filter((e) => e.taskId === t.id).length;
      expect(count).toBeLessThanOrEqual(t.daysPerWeek);
    }
  });

  it("dayTotals equal the sum of each day's entries", () => {
    const result = composeWeek({
      tasks: [
        task("toileting", "Toileting", 15, 7),
        task("meal", "Meal Prep/Eating", 45, 7),
        task("bathing", "Bathing", 30, 3),
        task("laundry", "Laundry (Home)", 30, 2),
      ],
      activeDays: [true, false, true, false, true, false, true],
      overrides: { bathing: [0, 2, 4] },
      weeklyTransportMinutes: 0,
      transportDay: 0,
    });
    const sums = [0, 0, 0, 0, 0, 0, 0];
    for (const e of result.entries) sums[e.weekday] = (sums[e.weekday] ?? 0) + e.minutes;
    expect(result.dayTotals).toEqual(sums);
  });

  it("TC-31: override keyed by task id leaves the agency Bathing unchanged", () => {
    const result = composeWeek({
      tasks: [
        task("bathing-cds", "Bathing", 30, 3),
        task("bathing-agency", "Bathing", 30, 3),
      ],
      activeDays: [true, true, true, true, true, true, true],
      overrides: { "bathing-cds": [0, 2, 4] },
      weeklyTransportMinutes: 0,
      transportDay: 0,
    });

    const cdsDays = result.entries.filter((e) => e.taskId === "bathing-cds").map((e) => e.weekday).sort();
    const agencyDays = result.entries.filter((e) => e.taskId === "bathing-agency").map((e) => e.weekday).sort();

    expect(cdsDays).toEqual([0, 2, 4]);
    expect(agencyDays).toEqual([1, 3, 5]);
  });
});
