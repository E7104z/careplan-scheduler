import { findAppendix1, type RulePack, type ServiceCode } from "@careplan/engine";
import { MDY, ymd } from "./dates.js";
import { lineAt } from "./provenance.js";
import { buildService, type ResultParts } from "./result.js";
import { readRow, type ReadRow } from "./rows.js";
import { serviceCodeForLabel } from "./services.js";
import type { ImportedOther, ImportedVisit, ImportIssue, SourceRef } from "./types.js";

// Fusion's care plan report ("Home & Community Based Services Care Plan"), IMPORT-SPEC 1.3.
// Cells are separated by tabs (its PDF) or single spaces (copied from a PDF viewer).
const PLAN_RE = new RegExp(`Care Plan Information\\s+${MDY}\\s*-\\s*${MDY}`);
const PARTICIPANT_RE = /^\s*Participant Information:\s*(.+?)\s*$/m;
const DCN_RE = /\bDCN:\s*(\d{6,12})\b/;
// The header at the top of every page after the first: "NAME - DCN:12345678".
const PAGE_HEADER_RE = /^\s*(.{1,120}?)\s+-\s+DCN:\s*(\d{6,12})\s*$/m;
const FOOTER_RE = /^\s*Date Generated:/;
// The service table's heading wraps over three lines, and a copy from a viewer can break it
// differently ("Service GHE GHE Prior", "Start Date End Date Provider", "Type Date 1 2 Authorization").
const SERVICE_HEAD_RE =
  /^\s*Service\b.*\b(?:Start|GHE|Prior)\b|^\s*(?:Start\s+)?(?:Date\s+)?End Date\s+Provider\b|^\s*Type\b.*\bAuthorization\s*$/;
const MONTH_HEAD_RE = /^\s*Start Date\s+End Date\s+Procedure Code\s+Authorized Units\s*$/;
const TASK_HEAD_RE = /^\s*Task\s+#Min\/Day\b/;
// A code's modifiers may be spaced, as Appendix 1 prints "T1019U3 TF".
const MONTH_ROW_RE = new RegExp(`^\\s*${MDY}\\s+${MDY}\\s+([A-Z]\\d{4}[A-Z0-9]*(?: [A-Z][A-Z0-9])*)\\s+(\\d{1,5})\\s*$`);
// The service row's middle line: "PC - Agency⇥N/A⇥N/A⇥20260000000005" (dates and provider wrap above and below).
const LABEL_RE = /^\s*([A-Z]{2,6}(?:\s*-\s*[A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*)?)(?=\t|\s+N\/A\b|\s+\d{6,}|\s*$)/;
// The service row's top line: "04/01⇥01/31⇥PROVIDER NAME , (555) 555-", or "PROVIDER NAME," when
// the phone number is on the bottom line.
const PROVIDER_RE = /^\s*\d{1,2}\/\d{1,2}\s+\d{1,2}\/\d{1,2}\s+(.+?)\s*,\s*(?:\(|$)/;

// Procedure codes Fusion's report shows for more than one service (T1019: agency and CDS).
const AMBIGUOUS_CODES: ReadonlySet<string> = new Set(["T1019"]);

/** True for the text of Fusion's care plan report rather than the care plan screen. */
export function isReport(text: string): boolean {
  return PLAN_RE.test(text) || text.split("\n").some((line) => TASK_HEAD_RE.test(line) || MONTH_HEAD_RE.test(line));
}

interface Block {
  label: string | null;
  pa: string | null;
  provider: string | null;
  months: { start: string; end: string; code: string; units: number }[];
  rows: string[];
  /** 1-based line of the month-table heading, where the authorization was read (SOURCE-01). */
  line: number;
  /** 1-based line of each row in `rows` (SOURCE-01). */
  rowLines: number[];
}

/** The task name at the start of a report row: the first cell, or the text before the first number. */
function rowName(line: string): string {
  return (line.split(/\t| {2,}/)[0] ?? "").replace(/\s+\d.*$/, "").trim();
}

/**
 * A nurse visit's task row: its name and its visits a month. The row has only #Units/Month
 * filled ("Eval APC Plan⇥2⇥N/A"), so its one number is that; anything else is null.
 */
function visitTask(line: string): { name: string; unitsPerMonth: number | null } {
  const numbers = line.replace(/\s+N\/A\s*$/, "").slice(rowName(line).length).match(/\d+/g) ?? [];
  return { name: rowName(line), unitsPerMonth: numbers.length === 1 ? Number(numbers[0]) : null };
}

/**
 * When a nurse visit authorization's tasks add up to a different number of visits a month than
 * Fusion authorized, a note asks for it to be checked; the plan keeps Fusion's figure. A note
 * only when every task has a number: a row without one can't be added up.
 */
function visitUnitsIssue(
  label: string | null,
  pa: string | null,
  tasks: { name: string; unitsPerMonth: number | null }[],
  authorized: number,
): ImportIssue | null {
  if (tasks.length === 0 || tasks.some((task) => task.unitsPerMonth === null)) return null;
  const total = tasks.reduce((sum, task) => sum + task.unitsPerMonth!, 0);
  if (total === authorized) return null;
  const who = `${label ?? "A nurse visit"}${pa ? ` (PA ${pa})` : ""}`;
  const parts = tasks.map((task) => `${task.name} ${task.unitsPerMonth}`).join(", ");
  return {
    level: "warn", code: "visit-units", label: label ?? undefined,
    message:
      `${who}: its tasks add up to ${total} ${total === 1 ? "visit" : "visits"} a month (${parts}), but Fusion authorized ` +
      `${authorized} a month. Ask the care manager which is right; the plan keeps Fusion's ${authorized}.`,
  };
}

/** The most common value, the first seen on a tie. */
function mostCommon(values: number[]): number {
  let best = values[0] ?? 0;
  for (const value of values) {
    if (values.filter((v) => v === value).length > values.filter((v) => v === best).length) best = value;
  }
  return best;
}

/** The label, authorization and provider in the lines just above a service's month table. */
function serviceRow(above: string[]): Pick<Block, "label" | "pa" | "provider"> {
  const nearest = [...above].reverse();
  const labelLine = nearest.find((line) => LABEL_RE.test(line)) ?? null;
  const label = labelLine ? LABEL_RE.exec(labelLine)![1]!.replace(/\s*-\s*/, " - ") : null;
  const pa = labelLine ? ([...labelLine.matchAll(/\b(\d{10,})\b/g)].at(-1)?.[1] ?? null) : null;
  // The provider only when its line ends at the comma before the phone number: then the name isn't cut short.
  const providerLine = nearest.find((line) => PROVIDER_RE.test(line));
  const provider = providerLine ? PROVIDER_RE.exec(providerLine)![1]!.trim() : null;
  return { label, pa, provider };
}

/** Split the report into services: a month table, then the task table that follows it. */
function readBlocks(text: string): Block[] {
  const rawLines = text.split("\n");
  const lines: { line: number; text: string }[] = [];
  rawLines.forEach((text, i) => {
    if (text.trim() === "" || FOOTER_RE.test(text) || PAGE_HEADER_RE.test(text)) return;
    lines.push({ line: i + 1, text });
  });
  const blocks: Block[] = [];
  let mode: "none" | "months" | "tasks" = "none";
  lines.forEach(({ line, text: lineText }, i) => {
    const block = blocks[blocks.length - 1];
    if (MONTH_HEAD_RE.test(lineText)) {
      blocks.push({
        ...serviceRow(lines.slice(Math.max(0, i - 6), i).map((entry) => entry.text)),
        months: [],
        rows: [],
        line,
        rowLines: [],
      });
      mode = "months";
    } else if (TASK_HEAD_RE.test(lineText)) {
      mode = block ? "tasks" : "none";
    } else if (SERVICE_HEAD_RE.test(lineText)) {
      mode = "none";
    } else if (mode === "months" && block) {
      const m = MONTH_ROW_RE.exec(lineText);
      if (m) {
        const [, m1, d1, y1, m2, d2, y2, code, units] = m;
        block.months.push({ start: ymd(m1!, d1!, y1!), end: ymd(m2!, d2!, y2!), code: code!, units: Number(units) });
      } else {
        mode = "none";
      }
    } else if (mode === "tasks" && block) {
      block.rows.push(lineText.trim());
      block.rowLines.push(line);
    }
  });
  return blocks;
}

/**
 * IMP-17: one task row. The Comments cell ("N/A") is dropped; an unread row keeps its full text.
 * Essential transportation has one number, its units a month ("Essential Transportation⇥40⇥N/A").
 */
function readReportRow(line: string, pack: RulePack, source: SourceRef): ReadRow | null {
  const cells = line.replace(/\s+N\/A\s*$/i, "");
  const row = readRow(cells, pack, source);
  if (row?.kind === "task") return { kind: "task", task: { ...row.task, raw: line } };
  if (row?.kind === "unread" && row.reason === "transport-numbers") {
    const units = /^\D*?\s(\d{1,4})\s*$/.exec(cells)?.[1];
    if (units !== undefined) {
      return { kind: "transport", raw: line, unitsPerMonth: Number(units), minutesPerMonth: Number(units) * 15 };
    }
  }
  return row?.kind === "unread" ? { ...row, raw: line } : row;
}

/**
 * IMP-11: a label we haven't seen is named by the code in its month table, when the rule pack has
 * that code as a 15-minute service and no other label in the report uses it. Fusion shows T1019
 * under both "PC - Agency" and "PC - CDS", so T1019, or any code shared by labels, says nothing.
 * The code is read through Appendix 1, since Fusion prints some with a space ("T1019U3 TF").
 */
function codeFallback(block: Block, blocks: Block[], pack: RulePack): ServiceCode | null {
  const code = block.months[0]?.code;
  if (!code || AMBIGUOUS_CODES.has(code)) return null;
  const scheduled = findAppendix1(code)?.engineCode ?? code;
  const service = pack.services.find((s) => s.code === scheduled && s.unit === "15min");
  const shared = blocks.some((other) => other.label !== block.label && other.months[0]?.code === code);
  return service && !shared ? service.code : null;
}

/**
 * IMP-19: whether a block the schedule can't place is kept rather than offered as a service to
 * choose. A label we know, or a code the rule pack schedules, is a service; T1019 (or a code shared
 * by labels) is left for the person to say. Any other code is kept: an Appendix 1 service Quick
 * Schedule doesn't schedule (meals, adult day care, RCF/ALF nurse visits, ILW supports), or a
 * code outside it.
 */
function isKept(block: Block, blocks: Block[], pack: RulePack): boolean {
  const code = block.months[0]?.code;
  if (!code || (block.label !== null && serviceCodeForLabel(block.label) !== null)) return false;
  if (codeFallback(block, blocks, pack) !== null || AMBIGUOUS_CODES.has(code)) return false;
  const engineCode = findAppendix1(code)?.engineCode ?? null;
  return engineCode === null;
}

/**
 * IMP-17/18: read Fusion's care plan report. Participant from "Participant Information" and the
 * first DCN (else the page header), plan dates from "Care Plan Information", and for each
 * service its label, authorization, provider, each month's authorized units and its tasks.
 * A service whose procedure code is a visit in the rule pack (a nurse visit, such as GHE) goes in
 * `visits`, by month, with one note per label. A service the schedule can't place is kept in
 * `others` with its rows as read (IMP-19). The address, date of birth and phone numbers are never read.
 */
export function readReport(text: string, pack: RulePack, page = 1): ResultParts {
  const planMatch = PLAN_RE.exec(text);
  const participantMatch = PARTICIPANT_RE.exec(text);
  const name = participantMatch?.[1];
  const dcn = DCN_RE.exec(text)?.[1];
  const pageHeader = PAGE_HEADER_RE.exec(text);
  const participant =
    name && dcn ? { name, dcn } : pageHeader ? { name: pageHeader[1]!.trim(), dcn: pageHeader[2]! } : null;

  const duplicates: ImportIssue[] = [];
  const skipped: ImportIssue[] = [];
  const services: ResultParts["services"] = [];
  const visits: ImportedVisit[] = [];
  const others: ImportedOther[] = [];
  const blocks = readBlocks(text);
  // Each nurse visit label's task names, across its authorizations, for one note per label.
  const visitLabels = new Map<string, string[]>();
  for (const block of blocks) {
    const source: SourceRef = { page, line: block.line };
    const code = block.months[0]?.code ?? null;
    const label = block.label ?? code;
    const visitService = code ? pack.services.find((service) => service.code === code && service.unit === "visit") : undefined;
    if (visitService) {
      const tasks = block.rows.map(visitTask).filter((task) => task.name !== "");
      const what = tasks.map((task) => task.name).join(", ");
      for (const month of block.months) {
        visits.push({
          label, serviceCode: visitService.code, name: what || null, tasks, provider: block.provider,
          start: month.start, end: month.end, units: month.units, pa: block.pa, source,
        });
      }
      const mismatch = visitUnitsIssue(label, block.pa, tasks, mostCommon(block.months.map((month) => month.units)));
      if (mismatch) skipped.push(mismatch);
      visitLabels.set(label ?? "", [...new Set([...(visitLabels.get(label ?? "") ?? []), ...tasks.map((task) => task.name)])]);
      continue;
    }
    const monthly = block.months.map(({ start, end, units }) => ({ start, end, units }));
    if (isKept(block, blocks, pack)) {
      others.push({
        label: block.label, code, registryId: code ? (findAppendix1(code)?.id ?? null) : null,
        provider: block.provider, pa: block.pa,
        start: monthly.map((m) => m.start).sort()[0] ?? null, end: monthly.map((m) => m.end).sort().at(-1) ?? null,
        monthly, rows: block.rows, source,
      });
      continue;
    }
    const rows = block.rows.flatMap((line, i) => {
      const row = readReportRow(line, pack, { page, line: block.rowLines[i] ?? block.line });
      return row ? [row] : [];
    });
    const service = buildService({
      label,
      provider: block.provider,
      phone: null,
      start: monthly.length ? monthly.map((m) => m.start).sort()[0]! : null,
      end: monthly.length ? monthly.map((m) => m.end).sort().at(-1)! : null,
      units: mostCommon(monthly.map((m) => m.units)),
      cost: null,
      pa: block.pa,
      monthly,
      source,
    }, rows, duplicates);
    service.serviceCode ??= codeFallback(block, blocks, pack);
    services.push(service);
  }

  for (const [label, names] of visitLabels) {
    skipped.push({
      level: "warn", code: "not-scheduled", label: label || undefined,
      message: `${label}${names.length > 0 ? ` (${names.join(", ")})` : ""} is a nurse visit, so it's listed by month, not in the week.`,
    });
  }

  const participantRef: SourceRef | null = participantMatch
    ? { page, line: lineAt(text, participantMatch.index) }
    : pageHeader ? { page, line: lineAt(text, pageHeader.index) } : null;

  return {
    participant,
    bannerPlan: planMatch ? { start: ymd(planMatch[1]!, planMatch[2]!, planMatch[3]!), end: ymd(planMatch[4]!, planMatch[5]!, planMatch[6]!) } : null,
    totalCost: null,
    paging: [],
    services,
    visits,
    others,
    duplicates,
    skipped,
    sources: {
      participant: participantRef,
      plan: planMatch ? { page, line: lineAt(text, planMatch.index) } : null,
      totalCost: null,
    },
  };
}
