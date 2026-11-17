import { QuickSchedule } from "../quick-schedule/QuickSchedule";
import { SaveToAgency } from "./SaveToAgency";

const AGENCY_NOTE =
  "Nothing is saved to your agency until you choose Save to agency. The name and DCN read from the PDF stay in this tab and are never saved.";

/** `/app/quick`: Quick Schedule with "Save to agency" beside "Save plan" (PHASE-3-SPEC section 6). */
export function AgencyQuickSchedule() {
  return <QuickSchedule planActions={(plan) => <SaveToAgency plan={plan} />} privacyNote={AGENCY_NOTE} />;
}
