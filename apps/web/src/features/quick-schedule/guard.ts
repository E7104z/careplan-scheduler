import type { RulePack, ValidationResult } from "@careplan/engine";
import type { QuickModel, QuickState } from "./types.js";
import { buildQuickModel, monthFigures } from "./model.js";
import { copyFor } from "./ruleCopy.js";
import { monthName } from "../../lib/format";

export type TryChangeResult =
  | { ok: true; model: QuickModel }
  | { ok: false; blocks: ValidationResult[]; model: QuickModel };

/** APP-SPEC 5.7: accept a person's change only if it keeps zero BLOCK results. */
export function tryChange(next: QuickState, pack: RulePack): TryChangeResult {
  const model = buildQuickModel(next, pack);
  const blocks = model.results.filter((result) => result.severity === "BLOCK");
  return blocks.length > 0 ? { ok: false, blocks, model } : { ok: true, model };
}

/** Largest minutes (<= requested) a weekly-grid cell can hold without a BLOCK, in 5-minute steps. */
export function maxCellMinutes(
  state: QuickState,
  key: string,
  requested: number,
  pack: RulePack,
): number {
  const fits = (value: number): boolean => {
    const next = structuredClone(state);
    next.edits[key] = value;
    return tryChange(next, pack).ok;
  };
  if (fits(requested)) return requested;
  let low = 0;
  let high = Math.floor(requested / 5);
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(mid * 5)) low = mid;
    else high = mid - 1;
  }
  return low * 5;
}

/**
 * APP-SPEC 5.7 refusal sentence from the first BLOCK, preferring the viewed month and then a
 * task-level result.
 */
export function refusalText(blocks: ValidationResult[], state: QuickState, model: QuickModel): string {
  const block =
    blocks.find((b) => b.refs.month === state.viewMonth && b.refs.taskId) ??
    blocks.find((b) => b.refs.month === state.viewMonth) ??
    blocks.find((b) => b.refs.taskId) ??
    blocks[0];
  if (!block) return "";
  const task = block.refs.taskId ? state.tasks.find((t) => t.id === block.refs.taskId) : undefined;

  if (block.ruleId === "SCH-08" && task) {
    const units = /\((\d+) units\)/.exec(block.message)?.[1];
    return `That would put ${task.name} over its ${units} units in ${monthName(block.refs.month ?? "")}.`;
  }
  if (block.ruleId === "SCH-08") {
    const figures = monthFigures(model, block.refs.month ?? state.viewMonth);
    return `That would put ${monthName(block.refs.month ?? "")} over the ${figures.authorizedUnits} units ${
      figures.source === "fusion" ? "Fusion authorizes" : "the plan allows"
    }.`;
  }
  if (block.ruleId === "SCH-02" && task) {
    return `${task.name} is authorized for ${task.daysPerWeek} ${task.daysPerWeek === 1 ? "day" : "days"} a week.`;
  }
  return (copyFor(block.ruleId, block.severity, block.refs)?.title ?? block.message) + ".";
}
