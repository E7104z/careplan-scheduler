import type { RuleCopy } from "./ruleCopy.js";

/** APP-SPEC 5.5 copy for the CDS task rules and program checks (CP4-7) and the cost cap (CP4-8), verbatim. */
export const PROGRAM_COPY: Record<string, RuleCopy> = {
  "CDS-01/BLOCK": {
    title: "Prompting or stand-by can't be a CDS task",
    whatToDo: "No CDS time can be authorized for stand-by, prompting or cueing on its own. Check this task against the care plan.",
  },
  "CDS-01/REVIEW": {
    title: "Check the prompting in this CDS task",
    whatToDo: "Prompting and cueing can be part of a hands-on task, but they can't be time on their own. Check that the minutes are for hands-on help.",
  },
  "CDS-02/BLOCK": {
    title: "Waiting or respite can't be CDS time",
    whatToDo: "No CDS time can be authorized for respite or for waiting for the participant at an appointment. Check this task against the care plan.",
  },
  "CDS-02/REVIEW": {
    title: "Check the waiting time in this CDS task",
    whatToDo: "Respite, and waiting for the participant at an appointment, can't be CDS time. Check what this task's minutes cover.",
  },
  "CDS-03/REVIEW": {
    title: "Check this CDS task isn't skilled care",
    whatToDo: "CDS can't include a task a licensed professional must do or train, such as skilled nursing or therapy a physician ordered. Check this task against the care plan.",
  },
  "CDS-04/REVIEW": {
    title: "Check CDS transportation against NEMT",
    whatToDo: "Trips to medical appointments that NEMT covers can't be CDS transportation. To check a trip, call NEMT at 1-866-269-5927.",
  },
  "CDS-05/BLOCK": {
    title: "CDS can't be given to an RCF or ALF resident",
    whatToDo: "People who live in a nursing facility, RCF or ALF aren't eligible for CDS. End CDS before the facility care starts.",
  },
  "PRG-01/BLOCK": {
    title: "HCBS can't be given during PACE",
    whatToDo: "A participant enrolled in PACE isn't eligible for any HCBS service. Check the PACE dates against the care plan.",
  },
  "PRG-02/BLOCK": {
    title: "This DMH program rules out this personal care",
    whatToDo:
      "DD Shared Living, Residential Habilitation and Individualized Supportive Living rule out State Plan personal care. DMH self-directed services rule out CDS and ILW. Check the program dates against the care plan.",
  },
  "CAP-01/REVIEW": {
    title: "Combined State Plan personal care and CDS are subject to the 60% cost maximum",
    whatToDo:
      "Together they can't go over 60% of the participant's cost maximum. Advanced Personal Care and nurse visits can take the plan past 60%, up to 100%. Over 100% with the ADW or ILW needs approval from the Bureau of Federal Programs.",
  },
  "PRG-03/REVIEW": {
    title: "State Plan personal care comes before DD waiver personal assistance",
    whatToDo: "State Plan personal care must be used up before a comparable DD waiver service. Check with the participant's DD support coordinator.",
  },
};
