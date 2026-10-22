import type { RulePack, TaskDef } from "@careplan/engine";

const squash = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, " ");

const names = (task: TaskDef): string[] => [task.name, ...task.aliases].map(squash);

/**
 * IMP-09: match a Fusion task name to the rule pack, ignoring case and extra spaces.
 * An exact name or alias wins; otherwise a unique prefix of 6 or more characters matches
 * (Fusion truncates long names). No match returns null.
 */
export function matchTask(pack: RulePack, name: string): TaskDef | null {
  const wanted = squash(name);
  const exact = pack.tasks.find((task) => names(task).includes(wanted));
  if (exact) return exact;
  if (wanted.length < 6) return null;
  const prefixed = pack.tasks.filter((task) => names(task).some((candidate) => candidate.startsWith(wanted)));
  return prefixed.length === 1 ? prefixed[0]! : null;
}
