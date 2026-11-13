import { recordAmendment, removeAmendment } from "./amendments.js";
import { addCaregiver, assignCaregiver, removeCaregiver, setSfcCaregiver, updateCaregiver } from "./caregivers.js";
import { changeDay } from "./dayChanges.js";
import { buildQuickModel } from "./model.js";
import { applyEvent, dropEvent } from "./planEvents.js";
import { registerPlanExtras } from "./planExtraStore.js";
import { guardedPlanChange, setStartTime } from "./visits.js";
import { addWaiver, removeWaiver, updateWaiver } from "./waivers.js";

// The dated side of Quick Schedule (Coverage Phase 3 on), as one chunk: loaded with import() only
// for a plan that has visits or kept authorizations to place. Loading it registers how its
// actions change the plan, so the store applies them through the guard (APP-SPEC 5.7).
registerPlanExtras((plan, action, pack) => {
  if (action.type === "placeEvent") return applyEvent(plan, action.event, pack);
  if (action.type === "removeEvent") return { plan: dropEvent(plan, action.eventId) };
  if (action.type === "recordAmendment") return recordAmendment(plan, action.service, action.amendment, pack);
  if (action.type === "changeDay") return changeDay(plan, action.service, action.change, pack);
  const models = () => plan.services.map((state) => buildQuickModel(state, pack));
  if (action.type === "setStartTime") return setStartTime(plan, action.service, action.weekday, action.time, pack, models());
  // Caregivers: adding and removing can break nothing; what is entered and who is assigned go through the guard.
  if (action.type === "addCaregiver") return { plan: addCaregiver(plan) };
  if (action.type === "removeCaregiver") return { plan: removeCaregiver(plan, action.id) };
  if (action.type === "updateCaregiver") return guardedPlanChange(plan, updateCaregiver(plan, action.id, action.patch), pack, models());
  if (action.type === "assignCaregiver") return guardedPlanChange(plan, assignCaregiver(plan, action.service, action.id, action.on), pack, models());
  if (action.type === "setSfcCaregiver") return { plan: setSfcCaregiver(plan, action.otherId, action.role, action.id) };
  // Waivers: an enrollment the person enters; adding or changing one that overlaps another is refused.
  if (action.type === "addWaiver") return guardedPlanChange(plan, addWaiver(plan), pack, models());
  if (action.type === "updateWaiver") return guardedPlanChange(plan, updateWaiver(plan, action.index, action.patch), pack, models());
  if (action.type === "removeWaiver") return { plan: removeWaiver(plan, action.index) };
  return { plan: removeAmendment(plan, action.service, action.amendmentId) };
});

export { VisitsPanel } from "./NurseVisits";
export { OtherPlacing } from "./OtherPlacing";
export { AmendmentsPanel } from "./AmendmentsPanel";
export { ParticipantCalendar } from "./ParticipantCalendar";
export { VisitTimes } from "./VisitTimes";
export { PlanChecks } from "./PlanChecks";
export { CaregiversPanel } from "./CaregiversPanel";
export { WaiversPanel } from "./WaiversPanel";
