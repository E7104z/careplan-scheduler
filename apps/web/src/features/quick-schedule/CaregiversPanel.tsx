import { useId, type Dispatch } from "react";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { Select } from "../../ui/Select";
import { TextInput } from "../../ui/TextInput";
import { caregiverLabel, isSfc, planCaregivers, RELATIONSHIP_LABELS } from "./caregivers";
import { serviceName } from "./carePlan";
import { quietButtonClass } from "./NurseVisits";
import { otherName, planOthers } from "./others";
import type { CaregiverRelationship, CarePlan, PlanCaregiver, QuickModel } from "./types";
import type { QuickFeedback, StoreAction } from "./useQuickStore";

const RELATIONSHIPS = Object.keys(RELATIONSHIP_LABELS) as CaregiverRelationship[];
type FlagKey = "agencyEmployee" | "nurseLicense" | "fcsrRegistered";
const FLAGS: [FlagKey, string][] = [
  ["agencyEmployee", "Agency employee"],
  ["nurseLicense", "Nurse license"],
  ["fcsrRegistered", "On the Family Care Safety Registry"],
];

function flagValue(value: boolean | null): string {
  return value === null ? "" : value ? "yes" : "no";
}

interface CardProps {
  plan: CarePlan;
  models: QuickModel[];
  caregiver: PlanCaregiver;
  dispatch: Dispatch<StoreAction>;
}

function CaregiverCard({ plan, models, caregiver, dispatch }: CardProps) {
  const id = useId();
  const label = caregiverLabel(plan, caregiver.id);
  const numbered = caregiverLabel(plan, caregiver.id, false);
  const update = (patch: Partial<Omit<PlanCaregiver, "id">>) => dispatch({ type: "updateCaregiver", id: caregiver.id, patch });
  return (
    <li className="grid gap-3 rounded-sm border border-line px-3 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <strong className="text-ink">{label}</strong>
        <button type="button" className={quietButtonClass} aria-label={`Remove ${numbered}`} onClick={() => dispatch({ type: "removeCaregiver", id: caregiver.id })}>
          Remove caregiver
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <label htmlFor={`${id}-name`} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
          {`Name of ${numbered} (kept in this tab only, never saved)`}
          <TextInput
            id={`${id}-name`}
            className="w-[240px] max-w-full"
            autoComplete="off"
            maxLength={80}
            value={caregiver.name ?? ""}
            onChange={(event) => update({ name: event.target.value })}
          />
        </label>
        <label htmlFor={`${id}-rel`} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
          {`Relationship of ${numbered} to the participant`}
          <Select
            id={`${id}-rel`}
            className="w-[200px]"
            value={caregiver.relationship ?? ""}
            onChange={(event) => update({ relationship: event.target.value === "" ? null : (event.target.value as CaregiverRelationship) })}
          >
            <option value="">Not entered</option>
            {RELATIONSHIPS.map((relationship) => (
              <option key={relationship} value={relationship}>
                {RELATIONSHIP_LABELS[relationship]}
              </option>
            ))}
          </Select>
        </label>
        {FLAGS.map(([key, text]) => (
          <label key={key} htmlFor={`${id}-${key}`} className="grid gap-0.5 text-[13px] font-semibold text-ink-2">
            {`${text}: ${numbered}`}
            <Select
              id={`${id}-${key}`}
              className="w-[150px]"
              value={flagValue(caregiver[key])}
              onChange={(event) => update({ [key]: event.target.value === "" ? null : event.target.value === "yes" })}
            >
              <option value="">Not entered</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </label>
        ))}
      </div>
      <fieldset className="grid gap-1">
        <legend className="text-[13px] font-semibold text-ink-2">{`Services ${numbered} is assigned to`}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {plan.services.map((state, index) => (
            <label key={state.id} className="flex items-center gap-2 text-ink max-sm:min-h-11">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={state.caregiverIds?.includes(caregiver.id) ?? false}
                onChange={(event) => dispatch({ type: "assignCaregiver", service: index, id: caregiver.id, on: event.target.checked })}
              />
              {serviceName(state, models[index]!)}
            </label>
          ))}
        </div>
      </fieldset>
      {planOthers(plan).filter(isSfc).map((other) => (
        <label key={other.id} htmlFor={`${id}-sfc-${other.id}`} className="grid w-fit gap-0.5 text-[13px] font-semibold text-ink-2">
          {`${otherName(other)} covered days: ${numbered} is`}
          <Select
            id={`${id}-sfc-${other.id}`}
            className="w-[220px]"
            value={other.sfcCaregivers?.primary === caregiver.id ? "primary" : other.sfcCaregivers?.backup === caregiver.id ? "backup" : ""}
            onChange={(event) => {
              if (other.id === undefined) return;
              const role = event.target.value;
              if (role === "primary" || role === "backup") dispatch({ type: "setSfcCaregiver", otherId: other.id, role, id: caregiver.id });
              else {
                if (other.sfcCaregivers?.primary === caregiver.id) dispatch({ type: "setSfcCaregiver", otherId: other.id, role: "primary", id: null });
                if (other.sfcCaregivers?.backup === caregiver.id) dispatch({ type: "setSfcCaregiver", otherId: other.id, role: "backup", id: null });
              }
            }}
          >
            <option value="">Not the caregiver</option>
            <option value="primary">The primary caregiver</option>
            <option value="backup">The backup caregiver</option>
          </Select>
        </label>
      ))}
    </li>
  );
}

export interface CaregiversPanelProps {
  plan: CarePlan;
  models: QuickModel[];
  feedback: QuickFeedback | null;
  dispatch: Dispatch<StoreAction>;
}

const CAREGIVER_ACTIONS = new Set(["updateCaregiver", "assignCaregiver", "setSfcCaregiver", "addCaregiver", "removeCaregiver"]);

/**
 * APP-SPEC 5.8 "Caregivers": who gives the care, what was entered about each, and which services
 * each is assigned to. Qualifications are entered, never guessed from a name or a role. A name is
 * kept in this tab's memory only and is never saved; after a reload a caregiver is "Caregiver 1".
 * Every change goes through the guard.
 */
export function CaregiversPanel({ plan, models, feedback, dispatch }: CaregiversPanelProps) {
  const caregivers = planCaregivers(plan);
  const refusal = feedback && CAREGIVER_ACTIONS.has(feedback.action.type) ? (feedback.refusal ?? null) : null;
  return (
    <Panel title="Caregivers" meta={caregivers.length === 0 ? "None added" : `${caregivers.length} added`} className="min-w-0 print:hidden">
      <p className="mb-3 text-sm text-ink-2">
        Optional. Add the people who give the care to check who can serve this participant and whether anyone is booked
        twice. Enter what you know about each; nothing is guessed. Names stay in this tab and are never saved.
      </p>
      {caregivers.length > 0 ? (
        <ul className="mb-3 grid gap-2">
          {caregivers.map((caregiver) => (
            <CaregiverCard key={caregiver.id} plan={plan} models={models} caregiver={caregiver} dispatch={dispatch} />
          ))}
        </ul>
      ) : null}
      <Button variant="secondary" onClick={() => dispatch({ type: "addCaregiver" })}>
        Add a caregiver
      </Button>
      {refusal ? (
        <p role="alert" className="mt-3 border-l-4 border-l-block pl-2 text-sm text-ink">
          {refusal}
        </p>
      ) : null}
    </Panel>
  );
}
