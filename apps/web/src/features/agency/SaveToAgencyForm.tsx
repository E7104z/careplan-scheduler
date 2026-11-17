import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { shortMonth } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Select } from "../../ui/Select";
import { TextInput } from "../../ui/TextInput";
import type { CarePlan } from "../quick-schedule/types";
import { useAuth } from "../auth/authContext";
import { errorMessage } from "../auth/errors";
import { useAgency } from "./agencyContext";
import { openedPlanFor, rememberOpenedPlan, type OpenedPlanLink } from "./openedPlan";
import { listParticipants, type ParticipantAlias } from "./participants";
import { createParticipant, listPlans, PARTICIPANT_NAME_MAX, planDates, PLAN_NAME_MAX, savePlanFor } from "./savedPlans";
import { participantNameProblem } from "./storageGate";

const NEW = "new";

/** "Care plan Dec 2025 to Oct 2026": the plan's months, never a name. */
export function defaultPlanName(plan: CarePlan): string {
  const { planStart, planEnd } = planDates(plan);
  return `Care plan ${shortMonth(planStart.slice(0, 7))} to ${shortMonth(planEnd.slice(0, 7))}`;
}

interface Linked {
  link: OpenedPlanLink;
  participant: string;
  planName: string;
}

/** The form inside "Save to your agency": who the plan is for, its name, and update or copy. */
export function SaveToAgencyForm({ plan, onDone }: { plan: CarePlan; onDone: () => void }) {
  const { user } = useAuth();
  const { state } = useAgency();
  const tenantId = state.tenantId ?? "";
  const [participants, setParticipants] = useState<ParticipantAlias[] | null>(null);
  const [linked, setLinked] = useState<Linked | null>(null);
  const [update, setUpdate] = useState(true);
  const [participantId, setParticipantId] = useState("");
  const [newName, setNewName] = useState("");
  const [planName, setPlanName] = useState(() => defaultPlanName(plan));
  const [problems, setProblems] = useState<{ participant?: string; newName?: string; planName?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const list = await listParticipants(tenantId);
        const link = openedPlanFor(tenantId, plan);
        const owner = link ? list.find((participant) => participant.id === link.participantId) : undefined;
        const savedPlan = link && owner ? (await listPlans(tenantId, link.participantId)).find((entry) => entry.id === link.planId) : undefined;
        if (!live) return;
        setParticipants(list);
        setParticipantId(list.length === 0 ? NEW : (owner?.id ?? ""));
        if (link && owner && savedPlan) {
          setLinked({ link, participant: owner.displayName, planName: savedPlan.name });
          setPlanName(savedPlan.name);
        }
      } catch (error) {
        if (live) setProblems({ form: errorMessage(error) ?? undefined });
        if (live) setParticipants([]);
      }
    })();
    return () => {
      live = false;
    };
    // Read once, when the dialog opens: the plan can't change while the dialog is open.
  }, [tenantId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const updating = linked !== null && update;
    const found = {
      participant: !updating && participantId === "" ? "Choose who this plan is for." : undefined,
      newName: !updating && participantId === NEW ? (participantNameProblem(newName) ?? undefined) : undefined,
      planName: planName.trim() === "" ? "Give the plan a name, like the months it covers." : undefined,
    };
    setProblems(found);
    if (found.participant || found.newName || found.planName) return;
    setSaving(true);
    try {
      let target = updating ? linked.link.participantId : participantId;
      let targetName = updating ? linked.participant : (participants?.find((entry) => entry.id === participantId)?.displayName ?? "");
      if (!updating && participantId === NEW) {
        targetName = newName.trim();
        target = await createParticipant(tenantId, user, targetName);
      }
      const planId = await savePlanFor(tenantId, target, user, {
        planId: updating ? linked.link.planId : null,
        name: planName.trim(),
        plan,
      });
      rememberOpenedPlan({ tenantId, participantId: target, planId }, plan);
      setSaved({ id: target, name: targetName });
    } catch (error) {
      setProblems({ form: errorMessage(error) ?? undefined });
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="grid gap-4">
        <p role="status" className="text-ink">
          Saved to {saved.name}. Anyone on your team can open it from Participants.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            to={`/app/participants/${saved.id}`}
            className="inline-flex h-10 items-center rounded-sm border border-line-2 bg-surface px-4 font-semibold text-ink hover:bg-sunk max-sm:min-h-11"
          >
            View participant
          </Link>
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }

  if (participants === null) return <p className="text-ink-2">Loading your participants…</p>;

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
      {linked ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-ink-2">This plan was opened from {linked.participant}</legend>
          <label className="flex items-center gap-2 text-ink">
            <input type="radio" name="save-mode" className="h-4 w-4 accent-brand" checked={update} onChange={() => setUpdate(true)} />
            Update “{linked.planName}”
          </label>
          <label className="flex items-center gap-2 text-ink">
            <input type="radio" name="save-mode" className="h-4 w-4 accent-brand" checked={!update} onChange={() => setUpdate(false)} />
            Save as a new plan
          </label>
        </fieldset>
      ) : null}
      {linked && update ? null : (
        <Field label="Participant" error={problems.participant} required>
          <Select value={participantId} onChange={(event) => setParticipantId(event.target.value)}>
            <option value="">Choose a participant</option>
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.displayName}
              </option>
            ))}
            <option value={NEW}>A new participant</option>
          </Select>
        </Field>
      )}
      {!(linked && update) && participantId === NEW ? (
        <Field label="New participant's name or alias" hint="Leave the DCN out." error={problems.newName} required>
          <TextInput value={newName} maxLength={PARTICIPANT_NAME_MAX} autoComplete="off" onChange={(event) => setNewName(event.target.value)} />
        </Field>
      ) : null}
      <Field label="Plan name" error={problems.planName} required>
        <TextInput value={planName} maxLength={PLAN_NAME_MAX} autoComplete="off" onChange={(event) => setPlanName(event.target.value)} />
      </Field>
      <p className="text-sm text-ink-2">The name and DCN read from the PDF, and caregivers' names, aren't saved with the plan.</p>
      {problems.form ? (
        <p role="alert" className="text-sm text-block">
          {problems.form}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" busy={saving}>
          {linked && update ? "Update plan" : "Save plan"}
        </Button>
      </div>
    </form>
  );
}
