import { applyEvent, dropEvent } from "./planEvents.js";
import { registerPlanExtras } from "./planExtraStore.js";

// The dated side of Quick Schedule (Coverage Phase 3 on), as one chunk: loaded with import() only
// for a plan that has visits or kept authorizations to place. Loading it registers how its
// actions change the plan, so the store applies them through the guard (APP-SPEC 5.7).
registerPlanExtras((plan, action, pack) => {
  if (action.type === "placeEvent") return applyEvent(plan, action.event, pack);
  return { plan: dropEvent(plan, action.eventId) };
});

export { VisitsPanel } from "./NurseVisits";
export { OtherPlacing } from "./OtherPlacing";
