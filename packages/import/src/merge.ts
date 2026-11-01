import type { RulePack } from "@careplan/engine";
import { readPaste, parseFusionText } from "./parse.js";
import { addTask, buildResult } from "./result.js";
import type { ImportIssue, ImportResult } from "./types.js";

/**
 * IMP-12: combine several pastes of the same plan (Fusion page 1, page 2, ...). Rows join the
 * service with the same label and units; a task already read is not added twice; a page for a
 * different participant (different DCN) is refused. Issues are worked out again for the whole
 * plan, so a row or task from any page is checked.
 */
export function mergeFusionText(texts: string[], pack: RulePack): ImportResult {
  const [firstText, ...rest] = texts;
  if (firstText === undefined) return parseFusionText("", pack);

  const merged = readPaste(firstText, pack, 1);
  const refused: ImportIssue[] = [];

  rest.forEach((text, i) => {
    const next = readPaste(text, pack, i + 2);
    if (merged.participant && next.participant && merged.participant.dcn !== next.participant.dcn) {
      refused.push({ level: "error", code: "different-participant", message: `Page ${i + 2} is for a different participant.` });
      return;
    }
    merged.participant ??= next.participant;
    merged.bannerPlan ??= next.bannerPlan;
    merged.totalCost ??= next.totalCost;
    merged.paging.push(...next.paging);
    merged.duplicates.push(...next.duplicates);
    for (const visit of next.visits) {
      if (!merged.visits.some((kept) => kept.pa === visit.pa && kept.start === visit.start)) merged.visits.push(visit);
    }
    for (const other of next.others) {
      if (!merged.others.some((kept) => kept.pa === other.pa && kept.code === other.code && kept.start === other.start)) {
        merged.others.push(other);
      }
    }
    for (const note of next.skipped) {
      if (!merged.skipped.some((kept) => kept.label === note.label)) merged.skipped.push(note);
    }

    for (const service of next.services) {
      const target = merged.services.find((s) => s.label === service.label && s.units === service.units);
      if (!target) {
        merged.services.push(service);
        continue;
      }
      for (const task of service.tasks) addTask(target, task, merged.duplicates);
      target.transport ??= service.transport;
      for (const unread of service.unread) {
        if (!target.unread.some((u) => u.raw === unread.raw)) target.unread.push(unread);
      }
    }
  });

  return buildResult(merged, refused);
}
