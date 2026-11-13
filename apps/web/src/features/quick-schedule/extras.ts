import { recordAmendment, removeAmendment } from "./amendments.js";
import { changeDay } from "./dayChanges.js";
import { buildQuickModel } from "./model.js";
import { applyEvent, dropEvent } from "./planEvents.js";
import { registerPlanExtras } from "./planExtraStore.js";
import { setStartTime } from "./visits.js";

// The dated side of Quick Schedule (Coverage Phase 3 on), as one chunk: loaded with import() only
// for a plan that has visits or kept authorizations to place. Loading it registers how its
// actions change the plan, so the store applies them through the guard (APP-SPEC 5.7).
registerPlanExtras((plan, action, pack) => {
  if (action.type === "placeEvent") return applyEvent(plan, action.event, pack);
  if (action.type === "removeEvent") return { plan: dropEvent(plan, action.eventId) };
  if (action.type === "recordAmendment") return recordAmendment(plan, action.service, action.amendment, pack);
  if (action.type === "changeDay") return changeDay(plan, action.service, action.change, pack);
  if (action.type === "setStartTime") {
    const models = plan.services.map((state) => buildQuickModel(state, pack));
    return setStartTime(plan, action.service, action.weekday, action.time, pack, models);
  }
  return { plan: removeAmendment(plan, action.service, action.amendmentId) };
});

export { VisitsPanel } from "./NurseVisits";
export { OtherPlacing } from "./OtherPlacing";
export { AmendmentsPanel } from "./AmendmentsPanel";
export { ParticipantCalendar } from "./ParticipantCalendar";
export { VisitTimes } from "./VisitTimes";
export { PlanChecks } from "./PlanChecks";
