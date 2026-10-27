import { dollars } from "@careplan/engine";

/** W-3: shown at the top of every Worksheet view and printout, with the form's own edition. */
export function notOfficialBanner(edition: string): string {
  return `Follows ${edition}. Not an official DSDS form.`;
}

export const WORKSHEET_COPY = {
  title: "Worksheet view",
  memoryOnly:
    "What you type on the worksheet stays in this tab's memory only. It isn't saved anywhere, and it's gone when you reload or close the tab.",
  ongoing: "Services on the worksheet are task-oriented and generally authorized on an ongoing basis.",
  basis: "Based on a 31-day month.",
  showMath: "Show the math",
  hideMath: "Hide the math",
  notOnForm: "Not on the DSDS form",
  notOnFormNote: "These care plan tasks have no row on DSDS's form. They are still in the schedule.",
  signature3c: "Signature and date: for the person completing the form",
  signature3a: "DSDS staff signature and date",
  bfp: "ILW requests go to the Bureau of Federal Programs. BFP approval is required before authorizing ILW.",
  ilwRequestNote:
    "The manual makes Description of needs mandatory on the 3a only for ILW requests, and says to upload the 3a to the electronic case record only when it is used for an ILW authorization. When a paper copy is needed, make one copy.",
  considerIlw: "See it on the ILW worksheet",
  medRelBox: "Medically related household tasks (done under the Personal Care authorization)",
  medRelNote: "Checked because this personal care plan has household tasks. Their units count as Personal Care.",
  underPersonalCare: "Under Personal Care",
  otherSection: "Not part of this care plan. Its rows stay blank here; build its schedule as its own plan.",
  issuesTitle: "Fix these entries",
  checksTitle: "Worksheet checks",
  noChecks: "No worksheet checks to show.",
  checksNote: "These checks are for the worksheet only. They never change the schedule's status.",
  exportButton: "Download as DSDS's worksheet (.xlsx)",
  exportNote:
    "This is DSDS's own file with your numbers typed in. DSDS staff complete and sign it. What you typed above goes into the file you download and nowhere else.",
} as const;

export function overMaximum(ceiling: number): string {
  return `Over the ${ceiling.toLocaleString("en-US")}-unit maximum`;
}

export function costNote3c(unitRateCents: number): string {
  return `Estimated cost at ${dollars(unitRateCents)} a unit (the rate on DSDS's worksheet)`;
}

export const COST_NOTE_3A = "Estimated at the rates on DSDS's rate sheet";
export const COST_NOTE_3A_INLINE = "estimated at the rates on DSDS's rate sheet";

/** WS-X06: one line comparing the worksheet's total with the schedule's month and Fusion's figure. */
export function reconcileLine(worksheet: number, monthName: string, schedule: number, fusion: number | null): string {
  const parts = [
    `Worksheet (31-day basis): ${worksheet.toLocaleString("en-US")} units`,
    `Schedule, ${monthName}: ${schedule.toLocaleString("en-US")} units`,
    fusion === null ? "Fusion: not entered" : `Fusion: ${fusion.toLocaleString("en-US")} units`,
  ];
  return `${parts.join(" · ")}.`;
}

const ACRONYMS = /\b(apc|otc|rom|hc|rcf|alf|adc|adcw|ilw|cds|dsds)\b/g;

/**
 * A DSDS label for the screen: the 3a prints its labels in capitals, and APP-SPEC 4.1 allows no
 * all-caps labels, so those read in sentence case with their acronyms kept ("PASSIVE ROM" → "Passive
 * ROM"). The 3c's labels are already mixed case and stay exactly as DSDS prints them.
 */
export function displayLabel(label: string): string {
  if (label !== label.toUpperCase()) return label;
  const lower = label.toLowerCase().replace(ACRONYMS, (word) => word.toUpperCase());
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
