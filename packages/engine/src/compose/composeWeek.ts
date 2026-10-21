import type { AuthorizedTask, TemplateEntry, Weekday } from "../types.js";

export interface ComposeInput {
  tasks: AuthorizedTask[];
  activeDays: boolean[];            // length 7, index 0 = Sunday
  overrides: Record<string, Weekday[]>;
  weeklyTransportMinutes: number;
  transportDay: Weekday;
}

export interface ComposeResult {
  entries: TemplateEntry[];
  dayTotals: number[];              // length 7
}

const MONDAY_FIRST: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** Port of Scheduler Lite composePCSSnapshot, keyed by task id. */
export function composeWeek(input: ComposeInput): ComposeResult {
  const load: number[] = [0, 0, 0, 0, 0, 0, 0];
  load[input.transportDay] = (load[input.transportDay] ?? 0) + input.weeklyTransportMinutes;
  const entries: TemplateEntry[] = [];

  const active = (weekday: Weekday): boolean => input.activeDays[weekday] === true;

  const place = (task: AuthorizedTask, days: Weekday[]): void => {
    const seen = new Set<Weekday>();
    for (const weekday of days) {
      if (!active(weekday)) continue;
      if (seen.has(weekday)) continue;
      seen.add(weekday);
      entries.push({ taskId: task.id, weekday, minutes: task.minPerDay });
      load[weekday] = (load[weekday] ?? 0) + task.minPerDay;
    }
  };

  const sevenDayTasks = input.tasks.filter((t) => t.daysPerWeek === 7);
  const otherTasks = input.tasks
    .filter((t) => t.daysPerWeek !== 7)
    .slice()
    .sort((a, b) => b.minPerDay - a.minPerDay);

  for (const task of sevenDayTasks) {
    const override = input.overrides[task.id];
    if (override && override.length > 0) {
      place(task, override);
    } else {
      place(task, MONDAY_FIRST.filter(active));
    }
  }

  for (const task of otherTasks) {
    const override = input.overrides[task.id];
    if (override && override.length > 0) {
      place(task, override);
      continue;
    }
    const lightestActive = MONDAY_FIRST
      .filter(active)
      .sort((a, b) => {
        const loadA = load[a] ?? 0;
        const loadB = load[b] ?? 0;
        if (loadA !== loadB) return loadA - loadB;
        return MONDAY_FIRST.indexOf(a) - MONDAY_FIRST.indexOf(b);
      });
    place(task, lightestActive.slice(0, task.daysPerWeek));
  }

  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of entries) {
    dayTotals[entry.weekday] = (dayTotals[entry.weekday] ?? 0) + entry.minutes;
  }

  return { entries, dayTotals };
}
