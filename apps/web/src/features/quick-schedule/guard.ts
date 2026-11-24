import { type RulePack, type ValidationResult, type Weekday } from "@careplan/engine";
import type { QuickModel, QuickState } from "./types.js";
import { buildQuickModel } from "./model.js";
import { copyFor } from "./ruleCopy.js";
import { weekdayName } from "../../lib/format";

export type TryChangeResult =
  | { ok: true; model: QuickModel }
  | { ok: false; blocks: ValidationResult[]; model: QuickModel };

/** A result's identity: rule, severity, refs and message (so its amounts too). */
function resultKey(result: ValidationResult): string {
  return JSON.stringify([result.ruleId, result.severity, result.refs, result.message]);
}

function blocksOf(model: QuickModel): ValidationResult[] {
  return model.results.filter((result) => result.severity === "BLOCK");
}

/** The Must-fix results a state already has: only possible when the care plan itself breaks a rule. */
function standingBlocks(current: QuickState | null, pack: RulePack): Set<string> {
  return new Set(current ? blocksOf(buildQuickModel(current, pack)).map(resultKey) : []);
}

function check(next: QuickState, pack: RulePack, standing: Set<string>): TryChangeResult {
  const model = buildQuickModel(next, pack);
  const blocks = blocksOf(model).filter((result) => !standing.has(resultKey(result)));
  return blocks.length > 0 ? { ok: false, blocks, model } : { ok: true, model };
}

/**
 * APP-SPEC 5.7: accept a person's change only if it adds no Must-fix (BLOCK) result. A break the
 * plan already had (in `current`) may stay exactly as it was; any other BLOCK, including a change
 * to an existing one, refuses. Without `current`, every BLOCK refuses. `blocks` lists only the
 * new results, so the refusal sentence names what the change would break.
 */
export function tryChange(next: QuickState, pack: RulePack, current: QuickState | null = null): TryChangeResult {
  return check(next, pack, standingBlocks(current, pack));
}

/** Largest minutes (<= requested) a weekly-grid cell can hold without a new BLOCK, in 5-minute steps. */
export function maxCellMinutes(
  state: QuickState,
  key: string,
  requested: number,
  pack: RulePack,
): number {
  const standing = standingBlocks(state, pack);
  const fits = (value: number): boolean => {
    const next = structuredClone(state);
    next.edits[key] = value;
    return check(next, pack, standing).ok;
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
export function refusalText(blocks: ValidationResult[], state: QuickState): string {
  const block =
    blocks.find((b) => b.refs.month === state.viewMonth && b.refs.taskId) ??
    blocks.find((b) => b.refs.month === state.viewMonth) ??
    blocks.find((b) => b.refs.taskId) ??
    blocks[0];
  if (!block) return "";
  const task = block.refs.taskId ? state.tasks.find((t) => t.id === block.refs.taskId) : undefined;

  if (block.ruleId === "SCH-02" && task) {
    return `${task.name} is authorized for ${task.daysPerWeek} ${task.daysPerWeek === 1 ? "day" : "days"} a week.`;
  }
  return (copyFor(block.ruleId, block.severity, block.refs)?.title ?? block.message) + ".";
}

export interface CellRefusal {
  /** Why the change was refused, from {@link refusalText}. */
  sentence: string;
  /** The largest value that fits, or why nothing more fits on that day. */
  hint: string;
  /** The value the "Use N minutes" button applies; null when nothing more fits. */
  useMinutes: number | null;
}

function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

/**
 * APP-SPEC 5.7 cell refusal box for setting a weekly-grid cell (`taskId:weekday`) to `requested`
 * minutes: null when the change fits, else the sentence and either the largest value that fits
 * or the reason nothing more fits.
 */
export function cellRefusal(
  state: QuickState,
  key: string,
  requested: number,
  pack: RulePack,
): CellRefusal | null {
  const next = structuredClone(state);
  next.edits[key] = requested;
  const result = tryChange(next, pack, state);
  if (result.ok) return null;

  const sentence = refusalText(result.blocks, next);
  const [taskId, weekdayText] = key.split(":");
  const weekday = Number(weekdayText);
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || !isWeekday(weekday)) return { sentence, hint: "", useMinutes: null };

  const current = buildQuickModel(state, pack).entries.find(
    (entry) => entry.taskId === task.id && entry.weekday === weekday,
  )?.minutes ?? 0;
  const most = maxCellMinutes(state, key, requested, pack);
  const day = weekdayName(weekday);
  if (most > current) {
    return { sentence, hint: `The most ${task.name} can have on ${day} is ${most} minutes.`, useMinutes: most };
  }
  return {
    sentence,
    hint: `${task.name} can't have more than ${current} minutes on ${day}. To add time here, take it from another day first.`,
    useMinutes: null,
  };
}
