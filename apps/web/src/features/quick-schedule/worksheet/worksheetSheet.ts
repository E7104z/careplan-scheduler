import {
  CHORE_TASK_LABELS, NURSE_TASK_LABELS, dollars, type RulePack, type Worksheet3cIlwExtrasResult,
} from "@careplan/engine";
import { niceDate } from "../../../lib/format";
import type { QuickState } from "../types";
import { COST_NOTE_3A, WORKSHEET_COPY, costNote3c, displayLabel, notOfficialBanner, overMaximum } from "./worksheetCopy";
import type { WorksheetFields, WorksheetLine } from "./worksheetState";
import type { Worksheet3aView, Worksheet3cView, WorksheetTableRow } from "./worksheetView";

/** One table on the printout: DSDS's columns, every row of the form, and the descriptions typed. */
export interface PrintTable {
  title: string;
  columns: string[];
  rows: { cells: string[]; note: string; description: string }[];
  /** Lines printed under the table: a subtotal, its cost. */
  after: string[];
}

/** Everything the worksheet printout shows, as text (Phase 3, Prompt 6). */
export interface WorksheetSheet {
  title: string;
  banner: string;
  /** Label and value pairs; people fields appear only when typed (W-4). */
  header: [string, string][];
  tables: PrintTable[];
  /** Short blocks of lines: totals, ILW services, nurse visits, the 3a's other lines. */
  blocks: { title: string; lines: string[] }[];
  comments: string;
  signature: string;
  prepared: string;
  footer: string;
}

const COLUMNS_3C = ["Task", "Suggested time", "Suggested frequency", "Min/Day", "Units/Day", "Days/Wk", "Max Days/Mo", "Units/Wk", "Total Units"];
const COLUMNS_3A = ["Task", "Suggested time", "Suggested frequency", "Min/Day", "Units/Day", "Days/Wk", "Max Days/Mo", "Min/Wk", "Units/Wk", "Total Units"];

function tableRows(rows: WorksheetTableRow[], fields: WorksheetFields, minPerWeek: boolean): PrintTable["rows"] {
  return rows.map(({ guidance, task, result, underPersonalCare }) => {
    const label = displayLabel(guidance.label);
    const has = task !== null && result !== null;
    const cells = [
      label, guidance.time, guidance.freq ?? "",
      has ? String(task.minPerDay ?? "") : "", has ? result.unitsPerDayDisplay : "", has ? String(task.daysPerWeek) : "",
      has ? String(result.maxDaysPerMonth ?? "") : "",
      ...(minPerWeek ? [has ? String(result.minPerWeek ?? "") : ""] : []),
      has ? result.unitsPerWeekDisplay : "", has ? String(result.totalUnits ?? "") : "",
    ];
    return { cells, note: underPersonalCare ? WORKSHEET_COPY.underPersonalCare : "", description: task ? (fields.descriptions[task.id] ?? "").trim() : "" };
  });
}

function header(fields: WorksheetFields, extra: [string, string][]): [string, string][] {
  const typed = (label: string, value: string): [string, string][] => (value.trim() ? [[label, value.trim()]] : []);
  return [
    ...typed("Participant name", fields.name), ...typed("DCN", fields.dcn),
    ...typed("Provider agency name", fields.providerName), ...typed("Provider agency phone", fields.providerPhone),
    ...extra,
    ...typed("Emergency contact", [fields.emergencyName.trim(), fields.emergencyPhone.trim()].filter(Boolean).join(" · ")),
  ];
}

function common(edition: string, pack: RulePack, today: string) {
  return {
    banner: notOfficialBanner(edition),
    prepared: `Prepared with CarePlan Scheduler on ${niceDate(today)}. Not an official DSDS form.`,
    footer: `Rule pack ${pack.id} · Follows ${edition}`,
  };
}

const EXTRA_LINES: [keyof Worksheet3cIlwExtrasResult, string][] = [
  ["fmsCents", "Financial Management Services"], ["caseManagementCents", "Case Management (CM)"],
  ["smsCents", "Specialized Medical Supplies (SMS)"], ["smeCents", "Specialized Medical Equipment (SME)"],
  ["eaaCents", "Environmental Accessibility Adaptations"],
];

/** The HCBS-3c printout: one form, its table with transportation, total, cost and (ILW) service lines. */
export function buildWorksheet3cSheet(view: Worksheet3cView, state: QuickState, fields: WorksheetFields, pack: RulePack, today: string): WorksheetSheet {
  const { result } = view;
  const ilw = view.form === "3c-ilw";
  const rows = tableRows(view.rows.filter((row) => row.guidance.taskCode !== "ESSENTIAL_TRANSPORTATION"), fields, false);
  const transport = view.rows.find((row) => row.guidance.taskCode === "ESSENTIAL_TRANSPORTATION");
  if (transport) {
    rows.push({ cells: [displayLabel(transport.guidance.label), transport.guidance.time, transport.guidance.freq ?? "", `${result.transport.minutesPerMonth.toLocaleString("en-US")} minutes a month ÷ 15`, "", "", "", "", String(result.transport.units)], note: "", description: "" });
  }
  const blocks: WorksheetSheet["blocks"] = [{
    title: "Totals",
    lines: [
      `Total units a month: ${result.totalUnits.toLocaleString("en-US")}${result.overCeiling ? ` (${overMaximum(result.ceiling)})` : ""}`,
      `${costNote3c(pack.worksheet3c!.unitRateCents)}: ${dollars(result.costCents)}`,
    ],
  }];
  if (ilw && result.ilwExtras) {
    const extras = result.ilwExtras;
    blocks.push({
      title: "ILW services",
      lines: [...EXTRA_LINES.flatMap(([key, label]) => (extras[key] ? [`${label}: ${dollars(extras[key]!)}`] : [])), WORKSHEET_COPY.bfp],
    });
  }
  return {
    title: `Consumer Directed Services Worksheet (HCBS-3c), ${ilw ? "ILW" : "CDS"} tab`,
    ...common(result.edition, pack, today),
    header: header(fields, [
      ["IHS (other HCBS besides CDS)", fields.ihs ? "Yes" : "No"],
      ["Personal care assistance", `${ilw ? "Independent Living Waiver" : "State Plan"} · ${result.totalUnits.toLocaleString("en-US")} units a month`],
      ["Start date", niceDate(state.plan.start)],
    ]),
    tables: [{ title: `${ilw ? "ILW" : "CDS"} tab`, columns: COLUMNS_3C, rows, after: [] }],
    blocks,
    comments: fields.comments.trim(),
    signature: WORKSHEET_COPY.signature3c + (fields.assessorName.trim() ? ` · Assessor: ${fields.assessorName.trim()}` : ""),
  };
}

const LINE_TITLES: Record<WorksheetLine, string> = {
  respiteBasic: "Respite care: Basic", respiteAdvanced: "Respite care: Advanced", adultDayCare: "Adult Day Care (ages 63 and older)",
  adultDayCareWaiver: "Adult Day Care Waiver (ages 18–62)", chore: "Chore services",
};

/** The HCBS-3a printout: its three task sections with subtotals and costs, then the other lines. */
export function buildWorksheet3aSheet(view: Worksheet3aView, state: QuickState, fields: WorksheetFields, pack: RulePack, today: string): WorksheetSheet {
  const { result } = view;
  const units = { personalCare: result.subtotals.personalCareUnits, homemaker: result.subtotals.homemakerUnits, apc: result.subtotals.apcUnits } as const;
  const rcf = { personalCare: fields.personalCareRcfAlf, homemaker: fields.homemakerRcfAlf, apc: fields.apcRcfAlf } as const;
  const tables: PrintTable[] = view.sections.map(({ section, name, rows }) => {
    const key = section as keyof typeof units;
    const cost = result.costs[key];
    return {
      title: `${displayLabel(name)}${rcf[key] ? " · RCF/ALF" : ""}${section === "homemaker" && view.input.flags.medRelHousehold ? " · Medically related household tasks" : ""}`,
      columns: COLUMNS_3A,
      rows: tableRows(rows, fields, true),
      after: [`Total ${displayLabel(name)}: ${units[key].toLocaleString("en-US")} units${cost === null ? "" : ` · ${dollars(cost)}`}`],
    };
  });
  const lines = (Object.keys(LINE_TITLES) as WorksheetLine[]).flatMap((line) => {
    const lineUnits = result.lineUnits[line];
    if (lineUnits === null) return [];
    const extra = line === "chore" && fields.choreTasks.length > 0 ? ` · ${fields.choreTasks.map((t) => displayLabel(CHORE_TASK_LABELS[t])).join(", ")}` : "";
    return [`${LINE_TITLES[line]}: ${lineUnits.toLocaleString("en-US")} units · ${dollars(result.costs[line] ?? 0)}${extra}`];
  });
  const nurse = [
    fields.nurseVisits === null ? "Visits a month: not entered" : `Visits a month: ${fields.nurseVisits}${fields.nurseRcfAlf ? " (RCF/ALF)" : ""}${result.costs.nurseVisits === null ? "" : ` · ${dollars(result.costs.nurseVisits)}`}`,
    ...(fields.nurseTasks.length > 0 ? [`Tasks: ${fields.nurseTasks.map((t) => displayLabel(NURSE_TASK_LABELS[t])).join(", ")}`] : []),
  ];
  const meals = result.hdm && result.hdm.totalUnits !== null
    ? [`Home delivered meals: ${result.hdm.totalUnits.toLocaleString("en-US")} meals a month · ${dollars(result.costs.homeDeliveredMeals ?? 0)}`]
    : [];
  return {
    title: "In-Home Services Worksheet (HCBS-3a)",
    ...common(result.edition, pack, today),
    header: header(fields, [["CDS (Personal Care Assistance, Consumer-Directed)", fields.cdsBox ? "Yes" : "No"], ["Plan starts", niceDate(state.plan.start)]]),
    tables,
    blocks: [
      { title: "Authorized nurse visits", lines: nurse },
      { title: "Other services", lines: [...lines, ...meals].length > 0 ? [...lines, ...meals] : ["None entered."] },
      { title: "Total", lines: [`Total cost: ${dollars(result.totalCostCents)} (${COST_NOTE_3A})`, ...(fields.ilwRequest ? ["Part of an ILW request."] : [])] },
      { title: "Notes", lines: [WORKSHEET_COPY.ilwRequestNote] },
    ],
    comments: fields.comments.trim(),
    signature: WORKSHEET_COPY.signature3a,
  };
}
