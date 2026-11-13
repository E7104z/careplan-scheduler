import { useState, type FormEvent } from "react";
import { niceDateFromMillis } from "../../lib/format";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { useToast } from "../../ui/ToastHost";
import { errorMessage } from "../auth/errors";
import { useAuth } from "../auth/authContext";
import { useAgency } from "./agencyContext";
import { BAA_SECTIONS, BAA_TITLE, BAA_VERSION } from "./baaText";
import { acceptBaa } from "./tenants";

/** `/app/agency/baa`: owners read and accept the business associate agreement (PHASE-3-SPEC §3). */
export function Baa() {
  const headingRef = usePageTitle(`${BAA_TITLE} | CarePlan Scheduler`);
  const { state, reload } = useAgency();
  const { user } = useAuth();
  const toast = useToast();

  const acceptedVersion = state.tenant?.baaVersion ?? "";
  const acceptedAt = state.tenant?.baaAcceptedAt ?? null;
  const isOwner = state.role === "owner";
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const accepted = acceptedVersion !== "";
  const statusText =
    accepted && acceptedAt !== null
      ? `Accepted on ${niceDateFromMillis(acceptedAt)} · version ${acceptedVersion}`
      : accepted
        ? `Accepted · version ${acceptedVersion}`
        : "Not accepted yet";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!state.tenantId || !user) return;
    setFormError(null);
    setBusy(true);
    try {
      await acceptBaa(state.tenantId, user);
      await reload();
      toast("Agreement accepted");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-6 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
        {BAA_TITLE}
      </h1>
      <p role="status" className="text-sm text-ink-2">
        {statusText}
      </p>
      {formError ? (
        <p role="alert" className="rounded-sm border border-line bg-sunk px-3.5 py-2.5 text-sm text-block">
          {formError}
        </p>
      ) : null}
      {!accepted && isOwner ? (
        <Panel title="Accept this agreement">
          <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
            <label className="flex items-start gap-3 text-sm text-ink-2">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 flex-none accent-brand"
                checked={authorized}
                onChange={(event) => setAuthorized(event.target.checked)}
              />
              <span>
                I am authorized to accept this agreement for {state.tenant?.name ?? "my agency"}.
              </span>
            </label>
            <div>
              <Button type="submit" busy={busy} disabled={!authorized}>
                Accept agreement
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}
      {!accepted && !isOwner ? (
        <p className="text-sm text-ink-2">Only an owner can accept this agreement.</p>
      ) : null}
      <section aria-labelledby="agreement-text" className="grid gap-6">
        <h2 id="agreement-text" className="sr-only">
          Agreement text
        </h2>
        {BAA_SECTIONS.map((section) => (
          <section key={section.heading} aria-label={section.heading}>
            <h3 className="text-[15px] font-bold text-ink">{section.heading}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-sm leading-relaxed text-ink-2">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <p className="text-sm text-ink-3">Version {BAA_VERSION}</p>
      </section>
    </div>
  );
}
