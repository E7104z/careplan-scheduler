import { usePageTitle } from "../lib/usePageTitle";

export function Privacy() {
  const headingRef = usePageTitle("Privacy | CarePlan Scheduler");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-[max(16px,env(safe-area-inset-left))] py-12">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold text-ink">
        Privacy
      </h1>
      <div className="mt-4 max-w-[62ch] space-y-4 text-ink-2">
        <p>
          Quick Schedule reads the care plan PDF you open, on your computer. Nothing you
          open is uploaded. The participant's name and DCN stay in
          the tab and are cleared when you reload the page or close it.
        </p>
        <p>
          An agency account stores your name, email address, and agency details with Google
          Firebase, in the United States.
        </p>
        <p>We run no advertising and no analytics trackers.</p>
        <p>
          Save plan in Quick Schedule saves the plan as an encrypted file on your computer.
          Only the passphrase you choose opens it, and we never see the file or the passphrase.
        </p>
        <p>
          Saving participants and their plans in an agency account stays turned off until a
          business associate agreement covers it: your agency's with us, and ours with Google
          Cloud. Saved plans never hold the participant's DCN or caregivers' names.
        </p>
        <p>
          Questions about privacy:{" "}
          <a
            href="mailto:support@thecdscloud.com"
            className="rounded-sm font-semibold text-brand hover:underline"
          >
            support@thecdscloud.com
          </a>
        </p>
      </div>
    </div>
  );
}
