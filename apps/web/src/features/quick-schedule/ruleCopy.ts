import type { Severity, ValidationResult } from "@careplan/engine";

export interface RuleCopy {
  title: string;
  whatToDo: string;
}

const AUTH_SCH_COPY: Record<string, RuleCopy> = {
  "AUTH-03/REVIEW": {
    title: "Two state formulas give different units",
    whatToDo:
      "DHSS's published formula and the HCBS-3c form round this task differently. Compare with the Fusion care plan.",
  },
  "AUTH-03/INFO": {
    title: "Task units calculated",
    whatToDo: "Units for this task use the DHSS published formula.",
  },
  "AUTH-05/INFO": {
    title: "How monthly units are figured",
    whatToDo:
      "Daily tasks are prorated by the days in each month. Other tasks use the DHSS weekly frequency factor.",
  },
  "AUTH-06/WARN": {
    title: "Monthly figures are calculated, not imported",
    whatToDo:
      "This plan came from the old web tool, so each month's units are our calculation. Check them against Fusion.",
  },
  "AUTH-07/REVIEW": {
    title: "Fusion's monthly figure differs from this month's task units",
    whatToDo:
      "We schedule against Fusion's figure. If the tasks need more, the last days of the month are cut, and the month view lists them. If that happens every month, ask the care plan change team for a change.",
  },
  "AUTH-08/INFO": {
    title: "Transportation time is set aside",
    whatToDo: "Transportation minutes come off the monthly units before tasks are counted.",
  },
  "AUTH-09/BLOCK": {
    title: "Respite is over its combined monthly limit",
    whatToDo: "Basic and Advanced Respite together can't go over the monthly limit.",
  },
  "AUTH-09/REVIEW": {
    title: "Fusion units are above the program limit",
    whatToDo:
      "The units entered are higher than this service's monthly limit. Confirm the number with Fusion.",
  },
  "AUTH-09/WARN": {
    title: "More units than this service allows",
    whatToDo:
      "These tasks add up to more units in a month than this service's monthly limit. Check the minutes and days against the care plan.",
  },
  "AUTH-11/INFO": {
    title: "When ILW starts this month",
    whatToDo: "This projects the day State Plan units run out and ILW units begin.",
  },
  "AUTH-12/BLOCK": {
    title: "ILW isn't approved yet",
    whatToDo: "Don't schedule ILW units until the ILW authorization is approved.",
  },
  "SCH-02/BLOCK": {
    title: "A task is on more days than authorized",
    whatToDo: "Unselect the extra day, or check the days per week on the care plan.",
  },
  "SCH-02/WARN": {
    title: "A task is on fewer days than authorized",
    whatToDo: "Add care days or choose more days for this task so it gets all its authorized days.",
  },
  "SCH-03/WARN": {
    title: "A day has more minutes than the task allows",
    whatToDo:
      "One day's minutes for this task are above its minutes per day. That's allowed while the month stays within its units.",
  },
  "SCH-08/BLOCK": {
    title: "The schedule goes over the month's authorization",
    whatToDo: "Lower some minutes or days, or check the monthly units against Fusion.",
  },
  "SCH-08/task": {
    title: "A task goes over its monthly units",
    whatToDo: "Lower this task's minutes on the longer days.",
  },
  "SCH-11/WARN": {
    title: "The same change two months running",
    whatToDo: "DSDS says a consistent need to change a task should prompt a request to the care plan change team. Ask them for a care plan change.",
  },
  "SCH-12/REVIEW": {
    title: "Partial month without a Fusion figure",
    whatToDo:
      "The plan starts or ends mid-month, so Fusion's monthly figure doesn't apply. Check that month's units in Fusion.",
  },
  "SCH-14/BLOCK": {
    title: "A visit falls outside the authorization",
    whatToDo: "Move the visit to a date the authorization covers.",
  },
  "SCH-14/INFO": {
    title: "Future authorization",
    whatToDo: "Visits for this authorization are drafts until it starts.",
  },
};


const CON_COPY: Record<string, RuleCopy> = {
  "CON-01/BLOCK": {
    title: "Two visits for the same service overlap",
    whatToDo:
      "A participant can't get the same CDS or ILW service twice at once. Change one visit's time.",
  },
  "CON-01/WARN": {
    title: "Two agency visits for the same service overlap",
    whatToDo: "Check the times; overlapping agency visits are usually a mistake.",
  },
  "CON-02/BLOCK": {
    title: "These two services can't overlap",
    whatToDo: "Change one visit's time.",
  },
  "CON-02/REVIEW": {
    title: "These services overlap and the rule isn't confirmed",
    whatToDo: "DHSS hasn't said whether these services may overlap. Avoid it until it's confirmed.",
  },
  "CON-03/BLOCK": {
    title: "Respite overlaps another service",
    whatToDo: "Respite can't happen at the same time as any other service.",
  },
  "CON-04/BLOCK": {
    title: "A caregiver is booked in two places at once",
    whatToDo: "Change one visit's time or caregiver.",
  },
  "CON-05/WARN": {
    title: "A caregiver is over 40 hours this workweek",
    whatToDo: "Overtime may apply. Check the caregiver's total hours.",
  },
  "CON-06/BLOCK": {
    title: "This attendant can't be paid for this participant",
    whatToDo: "A spouse or legal guardian can't be the CDS attendant.",
  },
  "CON-06/REVIEW": {
    title: "Check this attendant's relationship",
    whatToDo: "A spouse or guardian as ILW attendant needs review.",
  },
  "CON-07/BLOCK": {
    title: "This aide can't serve this participant",
    whatToDo: "A close family member or a non-employee can't provide this agency service.",
  },
  "CON-07/REVIEW": {
    title: "Check this Chore worker's relationship",
    whatToDo: "Family members providing Chore need review.",
  },
  "CON-09/REVIEW": {
    title: "Over 49 hours in a Sunday–Saturday week",
    whatToDo: "ILW and Respite are limited to 49 hours a week. Review this week.",
  },
  "CON-09/WARN": {
    title: "Over 49 hours in a 7-day stretch",
    whatToDo: "A 7-day window crossing two weeks goes over 49 hours.",
  },
  "CON-10/BLOCK": {
    title: "Too many nurse visits",
    whatToDo: "Nurse visits are limited to one a day and 26 in six months.",
  },
  "CON-13/WARN": {
    title: "First visit is late",
    whatToDo: "Agency personal care should start within 10 days of the referral.",
  },
  "CON-13/REVIEW": {
    title: "Referral date is missing",
    whatToDo: "Enter the date the referral was received.",
  },
  "CON-16/BLOCK": {
    title: "Two waiver enrollments overlap",
    whatToDo: "A participant can't be in two waivers on the same dates.",
  },
  "CON-16/REVIEW": {
    title: "No waiver enrollment on file",
    whatToDo: "This waiver service needs an enrollment record.",
  },
  "CON-17/REVIEW": {
    title: "Caregiver details are missing",
    whatToDo:
      "Add the caregiver's relationship and qualifications so we can check eligibility.",
  },
};

const STATE_FORMULA_COPY: Record<string, RuleCopy> = {
  "WS-R01/INFO": {
    title: "Outside DSDS's suggested range",
    whatToDo: "Describe the need.",
  },
  "WS-R02/REVIEW": {
    title: "Description of needs is missing",
    whatToDo: "Describe why this task is needed and why this time is right.",
  },
  "WS-R03/INFO": {
    title: "Needs more than the State Plan maximum",
    whatToDo: "The manual says to consider the Independent Living Waiver.",
  },
  "WS-R04/BLOCK": {
    title: "One Advanced Personal Care task needs 15-minute steps",
    whatToDo: "With one Advanced Personal Care task, enter its minutes in 15-minute steps.",
  },
  "WS-R05/REVIEW": {
    title: "Two nurse visits in Advanced Personal Care's first month",
    whatToDo: "Plan two nurse visits in the first month, unless the plan has ongoing nurse visits.",
  },
  "WS-R06/WARN": {
    title: "General Health Evaluation needs its months",
    whatToDo: "Check this only for semi-annual visits and name the months in Comments.",
  },
  "WS-R07/INFO": {
    title: "This nurse task needs prior approval",
    whatToDo: "Needs prior approval and authorization from DSDS or its designee.",
  },
  "WS-R08/BLOCK": {
    title: "Adult day care is outside its limits",
    whatToDo: "Enter adult day care in 15-minute steps, at most 10 hours a day and 5 days a week.",
  },
  "WS-R09/REVIEW": {
    title: "More than 2 meals a day",
    whatToDo: "State guidance sets a maximum of 2 meals a day. Check the number.",
  },
};

/**
 * APP-SPEC 5.5 copy table, verbatim, and the State formula checks. Keys are `ID/SEVERITY`;
 * `SCH-08/task` is the task-level variant of SCH-08. AUTH-13, SCH-15 and SCH-17 emit nothing
 * and are intentionally absent.
 */
export const RULE_COPY: Record<string, RuleCopy> = {
  ...AUTH_SCH_COPY,
  ...CON_COPY,
  ...STATE_FORMULA_COPY,
};

/** The copy for a result, or null when the rule/severity has no plain-language entry. */
export function copyFor(
  ruleId: string,
  severity: Severity,
  refs?: ValidationResult["refs"],
): RuleCopy | null {
  if (ruleId === "SCH-08" && refs?.taskId) return RULE_COPY["SCH-08/task"] ?? null;
  return RULE_COPY[`${ruleId}/${severity}`] ?? null;
}
