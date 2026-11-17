import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { PageLoading } from "../../ui/PageLoading";
import { Panel } from "../../ui/Panel";
import { TextInput } from "../../ui/TextInput";
import { useToast } from "../../ui/ToastHost";
import { useAuth } from "../auth/authContext";
import { errorMessage } from "../auth/errors";
import { useAgency } from "./agencyContext";
import { listParticipants, type ParticipantAlias } from "./participants";
import { createParticipant, PARTICIPANT_NAME_MAX } from "./savedPlans";
import { canSave, participantNameProblem, VIEWER_NOTE } from "./storageGate";
import { StorageNotice } from "./StorageNotice";
import { useStorageGate } from "./useStorageGate";

const PAGE = "mx-auto grid w-full max-w-[720px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6";
const HEADING = "text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]";

/**
 * `/app/participants` (PHASE-3-SPEC section 6): the agency's participants by the name or alias it
 * uses, each with their saved care plans. Adding one needs the storage gate open.
 */
export function Participants() {
  const headingRef = usePageTitle("Participants | CarePlan Scheduler");
  const { user } = useAuth();
  const { state } = useAgency();
  const toast = useToast();
  const navigate = useNavigate();
  const gate = useStorageGate();
  const tenantId = state.tenantId ?? "";
  const writer = canSave(state.role);

  const [participants, setParticipants] = useState<ParticipantAlias[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameProblem, setNameProblem] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setProblem(null);
    try {
      setParticipants(await listParticipants(tenantId));
    } catch (error) {
      setProblem(errorMessage(error));
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !tenantId) return;
    const found = participantNameProblem(name);
    setNameProblem(found ?? undefined);
    if (found) {
      nameRef.current?.focus();
      return;
    }
    setAdding(true);
    try {
      const id = await createParticipant(tenantId, user, name.trim());
      toast("Participant added");
      void navigate(`/app/participants/${id}`);
    } catch (error) {
      setProblem(errorMessage(error));
      setAdding(false);
    }
  };

  if (participants === null && problem === null) return <PageLoading />;

  return (
    <div className={PAGE}>
      <div>
        <h1 ref={headingRef} tabIndex={-1} className={HEADING}>
          Participants
        </h1>
        <p className="mt-1 max-w-[64ch] text-ink-2">
          Save each participant's care plan here, so anyone on your team can open it again.
        </p>
      </div>
      <StorageNotice gate={gate} isOwner={state.role === "owner"} />
      {problem ? (
        <div role="alert" className="grid gap-2 rounded-sm border border-line bg-sunk px-3.5 py-2.5 text-sm">
          <p className="text-block">{problem}</p>
          <div>
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </div>
      ) : null}

      {gate === "open" && writer ? (
        <Panel title="Add a participant">
          <form noValidate onSubmit={(event) => void add(event)} className="grid gap-4">
            <Field
              label="Name or alias"
              hint="The name your agency knows them by. Leave the DCN out."
              error={nameProblem}
              required
            >
              <TextInput ref={nameRef} value={name} maxLength={PARTICIPANT_NAME_MAX} autoComplete="off" onChange={(event) => setName(event.target.value)} />
            </Field>
            <div>
              <Button type="submit" busy={adding}>
                Add participant
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}
      {gate === "open" && !writer ? <p className="text-ink-2">{VIEWER_NOTE}</p> : null}

      <section aria-labelledby="participants-list" className="grid gap-3">
        <h2 id="participants-list" className="text-[17px] font-bold text-ink">
          {participants ? `${participants.length} ${participants.length === 1 ? "participant" : "participants"}` : "Participants"}
        </h2>
        {participants && participants.length === 0 ? (
          <p className="text-ink-2">No participants yet.</p>
        ) : (
          <ul className="grid gap-1">
            {(participants ?? []).map((participant) => (
              <li key={participant.id}>
                <Link
                  to={`/app/participants/${participant.id}`}
                  className="flex min-h-11 items-center rounded-sm border border-line px-3 py-2 font-medium text-brand hover:bg-sunk"
                >
                  {participant.displayName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
