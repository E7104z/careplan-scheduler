import type { ServiceCode } from "../types.js";
import type { RulePack, ServiceDef, TaskDef } from "./types.js";

export function findTaskByName(pack: RulePack, name: string): TaskDef | undefined {
  const lower = name.trim().toLowerCase();
  return pack.tasks.find(
    (task) =>
      task.name.toLowerCase() === lower ||
      task.aliases.some((alias) => alias.toLowerCase() === lower),
  );
}

export function serviceByCode(pack: RulePack, code: ServiceCode): ServiceDef | undefined {
  return pack.services.find((service) => service.code === code);
}
