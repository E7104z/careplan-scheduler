import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Panel } from "../../ui/Panel";
import { Select } from "../../ui/Select";
import { TextInput } from "../../ui/TextInput";
import { useToast } from "../../ui/ToastHost";
import { errorMessage } from "../auth/errors";
import { useAgency } from "./agencyContext";
import { validateAgencyName, WORKWEEK_HINT, WORKWEEK_OPTIONS } from "./agencyFields";
import { updateAgency } from "./tenants";

/** `/app/agency`: owners edit; everyone else sees read-only values (APP-SPEC 6.3). */
export function AgencyDetails() {
  const headingRef = usePageTitle("Agency details | CarePlan Scheduler");
  const { state, reload } = useAgency();
  const toast = useToast();
  const canEdit = state.role === "owner";
  const [name, setName] = useState(state.tenant?.name ?? "");
  const [workweekStart, setWorkweekStart] = useState(state.tenant?.workweekStart ?? 0);
  const [nameProblem, setNameProblem] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Switching agencies (or the first load) changes the tenant under this page.
  useEffect(() => {
    setName(state.tenant?.name ?? "");
    setWorkweekStart(state.tenant?.workweekStart ?? 0);
  }, [state.tenant?.name, state.tenant?.workweekStart]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!state.tenantId) return;
    setFormError(null);
    const problem = validateAgencyName(name);
    if (problem) {
      setNameProblem(problem);
      nameRef.current?.focus();
      return;
    }
    setNameProblem(undefined);
    setSaving(true);
    try {
      await updateAgency(state.tenantId, { name: name.trim(), workweekStart });
      await reload();
      toast("Changes saved");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
        Agency details
      </h1>
      {formError ? (
        <p role="alert" className="rounded-sm border border-line bg-sunk px-3.5 py-2.5 text-sm text-block">
          {formError}
        </p>
      ) : null}
      <Panel title="Agency details">
        <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
          <Field label="Agency name" required={canEdit} error={nameProblem}>
            <TextInput
              ref={nameRef}
              value={name}
              maxLength={120}
              autoComplete="organization"
              readOnly={!canEdit}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Workweek starts on" hint={WORKWEEK_HINT}>
            <Select
              value={workweekStart}
              disabled={!canEdit}
              onChange={(event) => setWorkweekStart(Number(event.target.value))}
            >
              {WORKWEEK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="State">
            <TextInput readOnly value="Missouri" />
          </Field>
          <Field label="Time zone">
            <TextInput readOnly value="Central (America/Chicago)" />
          </Field>
          {canEdit ? (
            <div>
              <Button type="submit" busy={saving}>
                Save changes
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-2">Only an owner can change agency details.</p>
          )}
        </form>
      </Panel>
    </div>
  );
}
