import type { AuthorizedTask, ServiceAuthorization, ValidationResult } from "../types.js";

// Policy 3.25 (rev. Jan 2026) CDS task rules. A task is flagged only from its label as the plan
// prints it (IMP-09 keeps a Fusion name it can't match), never inferred: a label that is nothing
// but an excluded activity is BLOCK, because the policy says outright that no time can be
// authorized for it; a label that only mentions one is REVIEW.

const FACILITY_PROGRAMS: ReadonlySet<string> = new Set(["RCF_PC", "RCF_APC"]);

/** A label's words, lower case, with "stand-by" as one word: "Stand-by assistance" → ["standby", "assistance"]. */
function words(label: string): string[] {
  return label.toLowerCase().replace(/stand[\s-]*by/g, "standby").match(/[a-z]+/g) ?? [];
}

type Match = "alone" | "mentioned" | null;

/** Whether a label is only `keys` (with filler words), mentions them, or neither. */
function labelMatch(label: string, keys: ReadonlySet<string>, filler: ReadonlySet<string>): Match {
  const all = words(label);
  if (!all.some((word) => keys.has(word))) return null;
  return all.every((word) => keys.has(word) || filler.has(word)) ? "alone" : "mentioned";
}

function cdsTasks(authorizations: ServiceAuthorization[]): { auth: ServiceAuthorization; task: AuthorizedTask }[] {
  return authorizations
    .filter((auth) => auth.program === "CDS")
    .flatMap((auth) => auth.tasks.map((task) => ({ auth, task })));
}

function taskResults(
  ruleId: string,
  authorizations: ServiceAuthorization[],
  keys: ReadonlySet<string>,
  filler: ReadonlySet<string>,
  says: { alone: string; mentioned: string },
): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const { auth, task } of cdsTasks(authorizations)) {
    const match = labelMatch(task.name, keys, filler);
    if (match === null) continue;
    results.push({
      ruleId,
      severity: match === "alone" ? "BLOCK" : "REVIEW",
      message: `CDS task "${task.name}" ${match === "alone" ? says.alone : says.mentioned}`,
      refs: { serviceAuthId: auth.id, taskId: task.id },
    });
  }
  return results;
}

const PROMPTING = new Set(["standby", "prompt", "prompts", "prompting", "cue", "cues", "cueing", "cuing", "encourage", "encouragement", "encouraging"]);
const PROMPTING_FILLER = new Set(["assistance", "assist", "and", "or", "only", "with", "for", "time", "of", "the", "a"]);

/**
 * No time can be authorized for stand-by assistance, prompting, or cueing (Policy 3.25).
 * Encouragement may be a component of a task but is not a task in itself (Policy 4.35.1).
 * @rule CDS-01
 * @source Policy 3.25 (rev. Jan 2026); Policy 4.35.1 (read Nov 13, 2026)
 */
export function ruleCDS01PromptingCueing(authorizations: ServiceAuthorization[]): ValidationResult[] {
  return taskResults("CDS-01", authorizations, PROMPTING, PROMPTING_FILLER, {
    alone: "is prompting, cueing or stand-by on its own",
    mentioned: "includes prompting, cueing or stand-by",
  });
}

const WAITING = new Set(["wait", "waits", "waiting", "respite"]);
const WAITING_FILLER = new Set(["time", "at", "appointment", "appointments", "for", "participant", "the", "a", "an", "any", "care", "and", "or", "during"]);

/**
 * No time can be authorized for respite care or for time spent waiting for a participant at any
 * appointment (Policy 3.25).
 * @rule CDS-02
 * @source Policy 3.25 (rev. Jan 2026)
 */
export function ruleCDS02WaitingTime(authorizations: ServiceAuthorization[]): ValidationResult[] {
  return taskResults("CDS-02", authorizations, WAITING, WAITING_FILLER, {
    alone: "is waiting or respite time",
    mentioned: "mentions waiting or respite",
  });
}

const LICENSED = new Set(["therapy", "therapies", "therapist", "therapeutic", "skilled", "licensed", "physician"]);

/**
 * CDS does not include any task that must be performed or trained by a licensed professional,
 * such as skilled nursing or therapies ordered by a physician (Policy 3.25).
 * @rule CDS-03
 * @source Policy 3.25 (rev. Jan 2026)
 */
export function ruleCDS03LicensedTasks(authorizations: ServiceAuthorization[]): ValidationResult[] {
  // A label can't show who must perform or order a task, so this is never a BLOCK.
  return taskResults("CDS-03", authorizations, LICENSED, new Set(), {
    alone: "names skilled or therapy care",
    mentioned: "names skilled or therapy care",
  }).map((result) => ({ ...result, severity: "REVIEW" }));
}

/**
 * CDS transportation does not include medical appointments covered under Non-Emergency Medical
 * Transportation (Policy 3.25). Whether NEMT covers a trip isn't on the plan, so this is REVIEW.
 * @rule CDS-04
 * @source Policy 3.25 (rev. Jan 2026)
 */
export function ruleCDS04NemtTrips(authorizations: ServiceAuthorization[]): ValidationResult[] {
  return authorizations
    .filter((auth) => auth.program === "CDS" && (auth.transportMinutesPerMonth ?? 0) > 0)
    .map((auth) => ({
      ruleId: "CDS-04",
      severity: "REVIEW" as const,
      message: "CDS transportation is on the plan; trips to medical appointments NEMT covers can't be CDS time",
      refs: { serviceAuthId: auth.id },
    }));
}

function overlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * Individuals who reside in a nursing facility, RCF or ALF are not eligible for CDS (Policy 3.25).
 * @rule CDS-05
 * @source Policy 3.25 (rev. Jan 2026)
 */
export function ruleCDS05FacilityResidents(authorizations: ServiceAuthorization[]): ValidationResult[] {
  // The setting is known only from the plan: RCF/ALF personal care on the same dates.
  const facility = authorizations.filter((auth) => FACILITY_PROGRAMS.has(auth.program));
  return authorizations
    .filter((auth) => auth.program === "CDS" && facility.some((other) => overlap(auth, other)))
    .map((auth) => ({
      ruleId: "CDS-05",
      severity: "BLOCK" as const,
      message: "CDS overlaps RCF/ALF personal care on the plan",
      refs: { serviceAuthId: auth.id },
    }));
}
