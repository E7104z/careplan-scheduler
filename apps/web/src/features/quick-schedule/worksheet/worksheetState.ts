import type { ChoreTask, NurseTask, Worksheet3cIlwExtrasInput } from "@careplan/engine";
import type { QuickState } from "../types";

/** The 3a's one-row lines that aren't the care plan's own service. */
export type WorksheetLine = "respiteBasic" | "respiteAdvanced" | "adultDayCare" | "adultDayCareWaiver" | "chore";

export interface LineEntry {
  minPerDay: number | null;
  daysPerWeek: number | null;
}

/**
 * Everything the Worksheet view adds to the care plan. Memory only (W-4): it lives in React state
 * on the Quick Schedule page, is never written to sessionStorage, localStorage, Firestore, the URL
 * or the console, and starts over with each new care plan.
 */
export interface WorksheetFields {
  name: string;
  dcn: string;
  providerName: string;
  providerPhone: string;
  emergencyName: string;
  emergencyPhone: string;
  /** The 3c's optional typed assessor name; blank unless the person types it (W-3). */
  assessorName: string;
  ihs: boolean;
  cdsBox: boolean;
  /** 3a: "This is part of an ILW request" (Description of needs is then required). */
  ilwRequest: boolean;
  personalCareRcfAlf: boolean;
  homemakerRcfAlf: boolean;
  apcRcfAlf: boolean;
  nurseRcfAlf: boolean;
  /** Description of needs, by care plan task id or by line ("hdm", "nurse", a WorksheetLine). */
  descriptions: Record<string, string>;
  comments: string;
  ilwExtras: Worksheet3cIlwExtrasInput;
  nurseVisits: number | null;
  nurseFirstMonthVisits: number | null;
  nurseTasks: NurseTask[];
  hdmUnitsPerDay: number | null;
  hdmDaysPerWeek: number | null;
  lines: Record<WorksheetLine, LineEntry>;
  choreTasks: ChoreTask[];
}

const NO_LINE: LineEntry = { minPerDay: null, daysPerWeek: null };

/** A blank worksheet for a care plan; name, DCN and provider start from what was read from Fusion. */
export function emptyWorksheet(state: Pick<QuickState, "identity" | "provider">): WorksheetFields {
  return {
    name: state.identity?.name ?? "",
    dcn: state.identity?.dcn ?? "",
    providerName: state.provider ?? "",
    providerPhone: "",
    emergencyName: "",
    emergencyPhone: "",
    assessorName: "",
    ihs: false,
    cdsBox: false,
    ilwRequest: false,
    personalCareRcfAlf: false,
    homemakerRcfAlf: false,
    apcRcfAlf: false,
    nurseRcfAlf: false,
    descriptions: {},
    comments: "",
    ilwExtras: { fmsUnits: null, caseManagementUnits: null, smsUnits: null, smeUnits: null, eaaUnits: null },
    nurseVisits: null,
    nurseFirstMonthVisits: null,
    nurseTasks: [],
    hdmUnitsPerDay: null,
    hdmDaysPerWeek: null,
    lines: { respiteBasic: NO_LINE, respiteAdvanced: NO_LINE, adultDayCare: NO_LINE, adultDayCareWaiver: NO_LINE, chore: NO_LINE },
    choreTasks: [],
  };
}

export type WorksheetChange =
  | { type: "set"; patch: Partial<Omit<WorksheetFields, "descriptions" | "lines" | "ilwExtras">> }
  | { type: "describe"; key: string; text: string }
  | { type: "line"; line: WorksheetLine; entry: Partial<LineEntry> }
  | { type: "ilwExtra"; field: keyof Worksheet3cIlwExtrasInput; units: number | null }
  | { type: "toggleNurseTask"; task: NurseTask }
  | { type: "toggleChoreTask"; task: ChoreTask }
  | { type: "reset"; fields: WorksheetFields };

function toggled<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function worksheetReducer(fields: WorksheetFields, change: WorksheetChange): WorksheetFields {
  switch (change.type) {
    case "set":
      return { ...fields, ...change.patch };
    case "describe":
      return { ...fields, descriptions: { ...fields.descriptions, [change.key]: change.text } };
    case "line":
      return { ...fields, lines: { ...fields.lines, [change.line]: { ...fields.lines[change.line], ...change.entry } } };
    case "ilwExtra":
      return { ...fields, ilwExtras: { ...fields.ilwExtras, [change.field]: change.units } };
    case "toggleNurseTask":
      return { ...fields, nurseTasks: toggled(fields.nurseTasks, change.task) };
    case "toggleChoreTask":
      return { ...fields, choreTasks: toggled(fields.choreTasks, change.task) };
    case "reset":
      return change.fields;
  }
}
