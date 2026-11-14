import { useId, useMemo, useState, type Dispatch } from "react";
import type { RulePack } from "@careplan/engine";
import { clockTime, niceDate } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { Select } from "../../ui/Select";
import { TextInput } from "../../ui/TextInput";
import { candidates, planBackup, PRIORITY_LABELS, uncoveredVisits, type UncoveredVisit } from "./backup";
import { caregiverLabel, planCaregivers } from "./caregivers";
import { serviceName } from "./carePlan";
import { quietButtonClass } from "./NurseVisits";
import type { CarePlan, CoopPriority, QuickModel } from "./types";
import type { QuickFeedback, StoreAction } from "./useQuickStore";

const PRIORITIES = Object.keys(PRIORITY_LABELS) as CoopPriority[];
const BACKUP_ACTIONS = new Set(["markUnavailable", "removeUnavailable", "setTaskPriority", "chooseReplacement", "undoReplacement"]);
const label = "grid gap-0.5 text-[13px] font-semibold text-ink-2";

interface RowProps {
  plan: CarePlan;
  models: QuickModel[];
  pack: RulePack;
  entry: UncoveredVisit;
  dispatch: Dispatch<StoreAction>;
}

function UncoveredRow({ plan, models, pack, entry, dispatch }: RowProps) {
  const id = useId();
  const service = serviceName(plan.services[entry.service]!, models[entry.service]!);
  const when = `${niceDate(entry.date)}, ${clockTime(entry.visit.start.slice(11, 16))}`;
  const found = useMemo(() => candidates(plan, models, pack, entry), [plan, models, pack, entry]);
  const offered = found.filter((candidate) => candidate.reason === null);
  const [choice, setChoice] = useState("");
  const chosen = offered.some((candidate) => candidate.caregiverId === choice) ? choice : (offered[0]?.caregiverId ?? "");
  return (
    <li className="grid gap-2 rounded-sm border border-line px-3 py-3 text-sm">
      <div>
        <strong className="text-ink">{service} · {when}</strong>
        <span className="block text-ink-2">{caregiverLabel(plan, entry.visit.caregiverId)} is away</span>
      </div>
      {entry.tasks.length > 0 ? (
        <ul className="grid gap-1">
          {entry.tasks.map((task) => (
            <li key={task.taskId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <label htmlFor={`${id}-${task.taskId}`} className="text-ink">{`Priority of ${task.name} if missed`}</label>
              <Select
                id={`${id}-${task.taskId}`}
                className="w-[160px]"
                value={task.priority ?? ""}
                onChange={(event) => dispatch({ type: "setTaskPriority", taskId: task.taskId, priority: (event.target.value || null) as CoopPriority | null })}
              >
                <option value="">Not entered</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
                ))}
              </Select>
            </li>
          ))}
        </ul>
      ) : null}
      {offered.length > 0 ? (
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className={label}>
            <label htmlFor={`${id}-replacement`}>{`Replacement for ${service} on ${niceDate(entry.date)}`}</label>
            <Select id={`${id}-replacement`} className="w-[220px]" value={chosen} onChange={(event) => setChoice(event.target.value)}>
              {offered.map((candidate) => (
                <option key={candidate.caregiverId} value={candidate.caregiverId}>{caregiverLabel(plan, candidate.caregiverId)}</option>
              ))}
            </Select>
          </div>
          <Button variant="secondary" onClick={() => dispatch({ type: "chooseReplacement", visitId: entry.visit.id, caregiverId: chosen })}>
            Use this caregiver
          </Button>
        </div>
      ) : (
        <p className="text-ink-2">No caregiver on this plan can cover this visit. Use the participant's backup plan.</p>
      )}
      {found.some((candidate) => candidate.reason !== null) ? (
        <ul className="grid gap-0.5 text-[13px] text-ink-3">
          {found.filter((candidate) => candidate.reason !== null).map((candidate) => (
            <li key={candidate.caregiverId}>{`Not offered: ${caregiverLabel(plan, candidate.caregiverId)}. ${candidate.reason}.`}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export interface BackupPanelProps {
  plan: CarePlan;
  models: QuickModel[];
  pack: RulePack;
  feedback: QuickFeedback | null;
  dispatch: Dispatch<StoreAction>;
}

/**
 * APP-SPEC 5.8 "Backup coverage" (CP4-8; Manual 4.15 and 4.20): mark a caregiver away, see the
 * visits left uncovered in the order of the priority the person gives each task, and choose who
 * covers each from the caregivers who can. Nothing is assigned until the person chooses, and the
 * approved authorization never changes.
 */
export function BackupPanel({ plan, models, pack, feedback, dispatch }: BackupPanelProps) {
  const id = useId();
  const caregivers = planCaregivers(plan);
  const backup = planBackup(plan);
  const uncovered = useMemo(() => uncoveredVisits(plan, models, pack), [plan, models, pack]);
  const [away, setAway] = useState({ caregiverId: "", start: "", end: "" });
  const who = caregivers.some((caregiver) => caregiver.id === away.caregiverId) ? away.caregiverId : (caregivers[0]?.id ?? "");
  const refusal = feedback && BACKUP_ACTIONS.has(feedback.action.type) ? (feedback.refusal ?? null) : null;
  const names = (service: string) => {
    const index = plan.services.findIndex((state) => state.id === service);
    return index < 0 ? "Service" : serviceName(plan.services[index]!, models[index]!);
  };
  return (
    <Panel
      title="Backup coverage"
      meta={uncovered.length === 0 ? "Nothing uncovered" : `${uncovered.length} uncovered`}
      className="min-w-0 print:hidden"
    >
      {caregivers.length === 0 ? (
        <p className="text-sm text-ink-2">
          Add caregivers and visit times first. Then mark a caregiver away to see the visits left uncovered and who can
          cover them.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-2">
            When a caregiver can't come, mark the days they're away. The visits left uncovered are listed, most urgent
            first by the priority you give each task, with who can cover them. Nothing changes until you choose, and the
            authorization never changes.
          </p>
          <div className="mb-3 flex flex-wrap items-end gap-x-3 gap-y-2">
            <div className={label}>
              <label htmlFor={`${id}-who`}>Caregiver</label>
              <Select id={`${id}-who`} className="w-[220px]" value={who} onChange={(event) => setAway({ ...away, caregiverId: event.target.value })}>
                {caregivers.map((caregiver) => (
                  <option key={caregiver.id} value={caregiver.id}>{caregiverLabel(plan, caregiver.id)}</option>
                ))}
              </Select>
            </div>
            <div className={label}>
              <label htmlFor={`${id}-start`}>First day away</label>
              <TextInput id={`${id}-start`} type="date" className="w-[180px]" value={away.start} onChange={(event) => setAway({ ...away, start: event.target.value })} />
            </div>
            <div className={label}>
              <label htmlFor={`${id}-end`}>Last day away</label>
              <TextInput id={`${id}-end`} type="date" className="w-[180px]" value={away.end} onChange={(event) => setAway({ ...away, end: event.target.value })} />
            </div>
            <Button variant="secondary" onClick={() => dispatch({ type: "markUnavailable", caregiverId: who, start: away.start, end: away.end || away.start })}>
              Mark away
            </Button>
          </div>
          {refusal ? (
            <p role="alert" className="mb-3 border-l-4 border-l-block pl-2 text-sm text-ink">{refusal}</p>
          ) : null}
          {backup.unavailable.length > 0 ? (
            <ul className="mb-3 grid gap-1 text-sm">
              {backup.unavailable.map((entry, index) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-3">
                  <span className="text-ink">{`${caregiverLabel(plan, entry.caregiverId)} away ${niceDate(entry.start)} to ${niceDate(entry.end)}`}</span>
                  <button type="button" className={quietButtonClass} aria-label={`Remove absence ${index + 1}`} onClick={() => dispatch({ type: "removeUnavailable", id: entry.id })}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {uncovered.length > 0 ? (
            <ul className="mb-3 grid gap-2" aria-label="Uncovered visits">
              {uncovered.map((entry) => (
                <UncoveredRow key={entry.visit.id} plan={plan} models={models} pack={pack} entry={entry} dispatch={dispatch} />
              ))}
            </ul>
          ) : null}
          {backup.substitutes.length > 0 ? (
            <ul className="grid gap-1 text-sm" aria-label="Replacements chosen">
              {backup.substitutes.map((sub, index) => (
                <li key={sub.id} className="flex flex-wrap items-center gap-x-3">
                  <span className="text-ink">{`${names(sub.serviceAuthId ?? "")} on ${niceDate(sub.date)}: ${caregiverLabel(plan, sub.caregiverId ?? "")} instead`}</span>
                  <button type="button" className={quietButtonClass} aria-label={`Undo replacement ${index + 1}`} onClick={() => dispatch({ type: "undoReplacement", id: sub.id })}>
                    Undo
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Panel>
  );
}
