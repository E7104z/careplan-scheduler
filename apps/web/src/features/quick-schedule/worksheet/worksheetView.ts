import {
  GUIDANCE, calculate3a, calculate3c, validateWorksheet3a, validateWorksheet3c,
  type GuidanceRow, type RulePack, type ScheduleValidationResult, type ServiceCode,
  type Worksheet3aInput, type Worksheet3aResult, type Worksheet3aRowInput, type Worksheet3aSection,
  type Worksheet3cInput, type Worksheet3cResult, type WorksheetForm, type WorksheetRowMath,
} from "@careplan/engine";
import type { QuickModel, QuickState, QuickTask } from "../types";
import type { WorksheetFields, WorksheetLine } from "./worksheetState";

/** Which DSDS form a service is laid out on (Phase 3, Prompt 5). */
export function formFor(code: ServiceCode): WorksheetForm {
  if (code === "T1019U2") return "3c-cds";
  if (code === "T1019U6") return "3c-ilw";
  return "3a";
}

const SECTION_NAMES: Record<string, Worksheet3aSection> = {
  "PERSONAL CARE": "personalCare",
  HOMEMAKER: "homemaker",
  "ADVANCED PERSONAL CARE": "apc",
};

/** The 3a section that holds a service's own tasks; respite and chore are one-row lines. */
const OWN_SECTION: Partial<Record<ServiceCode, Worksheet3aSection>> = {
  T1019: "personalCare", T1019TF: "apc", S5130: "homemaker",
};
const RESPITE_LINE: Record<string, WorksheetLine> = { BASIC_RESPITE: "respiteBasic", ADVANCED_RESPITE: "respiteAdvanced" };

/** One row of DSDS's table: the form's row, and the care plan task on it (if any). */
export interface WorksheetTableRow {
  guidance: GuidanceRow;
  task: QuickTask | null;
  /** The engine's numbers for the row; the 3a's rows also carry its Min/Wk column. */
  result: (WorksheetRowMath & { minPerWeek?: number }) | null;
  /** 3a Homemaker row done under the Personal Care authorization (the Med Rel box, WS-A03). */
  underPersonalCare: boolean;
}

interface Placement {
  rows: WorksheetTableRow[];
  notOnForm: QuickTask[];
  /** Index into the calculator's input rows for each placed task. */
  placed: { task: QuickTask; guidance: GuidanceRow | null; line?: WorksheetLine }[];
}

/** The care plan's tasks on the form's rows, in DSDS's order; the rest are "not on the DSDS form". */
function place(state: QuickState, form: WorksheetForm): Placement {
  const own = OWN_SECTION[state.serviceCode];
  const rows = GUIDANCE[form].filter((row) => row.taskCode !== null);
  const used = new Set<string>();
  const placed: Placement["placed"] = [];
  const notOnForm: QuickTask[] = [];
  for (const task of state.tasks) {
    const line = form === "3a" && task.taskCode ? RESPITE_LINE[task.taskCode] : undefined;
    if (line) {
      placed.push({ task, guidance: null, line });
      continue;
    }
    const sections = own === "personalCare" ? ["personalCare", "homemaker"] : own ? [own] : [];
    const guidance = rows.find((row) => row.taskCode === task.taskCode && !used.has(`${row.row}`) &&
      (form !== "3a" || sections.includes(SECTION_NAMES[row.section ?? ""] ?? "")));
    if (!guidance) {
      notOnForm.push(task);
      continue;
    }
    used.add(`${guidance.row}`);
    placed.push({ task, guidance });
  }
  const byRow = new Map(placed.filter((p) => p.guidance).map((p) => [p.guidance!.row, p.task]));
  return {
    rows: rows.map((guidance) => ({ guidance, task: byRow.get(guidance.row) ?? null, result: null, underPersonalCare: false })),
    notOnForm,
    placed,
  };
}

export interface Worksheet3cView {
  form: "3c-cds" | "3c-ilw";
  input: Worksheet3cInput;
  result: Worksheet3cResult;
  rows: WorksheetTableRow[];
  notOnForm: QuickTask[];
  checks: ScheduleValidationResult[];
}

/** QuickState + the worksheet's own fields → the HCBS-3c's input, numbers and checks. Reads nothing else. */
export function worksheet3c(state: QuickState, model: QuickModel, fields: WorksheetFields, pack: RulePack): Worksheet3cView {
  const form = formFor(state.serviceCode) === "3c-ilw" ? "3c-ilw" : "3c-cds";
  const { rows, notOnForm, placed } = place(state, form);
  const input: Worksheet3cInput = {
    tab: form === "3c-ilw" ? "ILW" : "CDS",
    rows: placed.map(({ task }) => ({
      taskCode: task.taskCode!, minPerDay: task.minPerDay, daysPerWeek: task.daysPerWeek,
      description: fields.descriptions[task.id] ?? "",
    })),
    transportMinutesPerMonth: model.allowance?.minutesPerMonth ?? null,
    ...(form === "3c-ilw" ? { ilwExtras: fields.ilwExtras } : {}),
  };
  const result = calculate3c(input, pack);
  const resultByTask = new Map(placed.map(({ task }, i) => [task.id, result.rows[i]!]));
  return {
    form, input, result, notOnForm,
    rows: rows.map((row) => ({ ...row, result: row.task ? resultByTask.get(row.task.id) ?? null : null })),
    checks: validateWorksheet3c(input, pack),
  };
}

export interface Worksheet3aView {
  input: Worksheet3aInput;
  result: Worksheet3aResult;
  /** The 3a's task sections, in DSDS's order. */
  sections: { section: Worksheet3aSection; name: string; rows: WorksheetTableRow[] }[];
  /** The 3a section or line that is the care plan's own service (null for chore: it has no tasks). */
  own: Worksheet3aSection | null;
  notOnForm: QuickTask[];
  checks: ScheduleValidationResult[];
}

/** QuickState + the worksheet's own fields → the HCBS-3a's input, numbers and checks. Reads nothing else. */
export function worksheet3a(state: QuickState, fields: WorksheetFields, pack: RulePack): Worksheet3aView {
  const { rows, notOnForm, placed } = place(state, "3a");
  const medRelHousehold = state.serviceCode === "T1019" && rows.some((row) => row.task && row.guidance.section === "HOMEMAKER");
  const planLines = new Set(placed.flatMap((p) => (p.line ? [p.line] : [])));
  const taskRows: Worksheet3aRowInput[] = placed.map(({ task, guidance, line }) => ({
    section: line ?? SECTION_NAMES[guidance!.section!]!,
    ...(line ? {} : { taskCode: task.taskCode! }),
    minPerDay: task.minPerDay, daysPerWeek: task.daysPerWeek, description: fields.descriptions[task.id] ?? "",
  }));
  const lineRows: Worksheet3aRowInput[] = (Object.keys(fields.lines) as WorksheetLine[])
    .filter((line) => !planLines.has(line))
    .map((line) => ({ section: line, ...fields.lines[line], description: fields.descriptions[line] ?? "" }));
  const input: Worksheet3aInput = {
    flags: {
      personalCareRcfAlf: fields.personalCareRcfAlf, apcRcfAlf: fields.apcRcfAlf, nurseRcfAlf: fields.nurseRcfAlf,
      medRelHousehold, homemakerRcfAlf: fields.homemakerRcfAlf, cdsBox: fields.cdsBox,
    },
    rows: [...taskRows, ...lineRows],
    hdm: { unitsPerDay: fields.hdmUnitsPerDay, daysPerWeek: fields.hdmDaysPerWeek, description: fields.descriptions.hdm ?? "" },
    nurse: { visitsPerMonth: fields.nurseVisits, firstMonthVisits: fields.nurseFirstMonthVisits, tasks: fields.nurseTasks, comments: fields.comments },
    chore: { tasks: fields.choreTasks },
    ilwRequest: fields.ilwRequest,
  };
  const result = calculate3a(input, pack);
  const resultByTask = new Map(placed.map(({ task }, i) => [task.id, result.rows[i]!]));
  const withResults = rows.map((row) => ({
    ...row,
    result: row.task ? resultByTask.get(row.task.id) ?? null : null,
    underPersonalCare: medRelHousehold && row.task !== null && row.guidance.section === "HOMEMAKER",
  }));
  const sections = Object.entries(SECTION_NAMES).map(([name, section]) => ({
    section, name, rows: withResults.filter((row) => row.guidance.section === name),
  }));
  const own = OWN_SECTION[state.serviceCode] ?? [...planLines][0] ?? null;
  return { input, result, sections, own, notOnForm, checks: validateWorksheet3a(input, pack) };
}

/** The plan's own units on the worksheet's 31-day basis, for the reconcile line (WS-X06). */
export function worksheetUnits(view: Worksheet3cView | Worksheet3aView): number | null {
  if ("form" in view) return view.result.totalUnits;
  const { result, own } = view;
  if (own === "personalCare") return result.subtotals.personalCareUnits;
  if (own === "homemaker") return result.subtotals.homemakerUnits;
  if (own === "apc") return result.subtotals.apcUnits;
  if (own === "respiteBasic" || own === "respiteAdvanced") return result.lineUnits[own];
  return null;
}
