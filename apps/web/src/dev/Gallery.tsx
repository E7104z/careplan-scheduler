import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "../ui/Button";
import { DayToggle } from "../ui/DayToggle";
import { Dialog } from "../ui/Dialog";
import { EmptyState } from "../ui/EmptyState";
import { Field } from "../ui/Field";
import { FileDrop } from "../ui/FileDrop";
import { Logo } from "../ui/Logo";
import { Menu } from "../ui/Menu";
import { NumberField } from "../ui/NumberField";
import { Panel } from "../ui/Panel";
import { Select } from "../ui/Select";
import { SeverityPill } from "../ui/SeverityPill";
import { SkipLink } from "../ui/SkipLink";
import { Spinner } from "../ui/Spinner";
import { Textarea } from "../ui/Textarea";
import { Toast, ToastProvider, ToastViewport } from "../ui/Toast";
import { getTheme, setTheme, type Theme } from "../lib/theme";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const ALL_SEVERITIES = ["BLOCK", "REVIEW", "WARN", "INFO"] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

export function Gallery() {
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [busy, setBusy] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [days, setDays] = useState<boolean[]>([
    true,
    false,
    false,
    true,
    false,
    false,
    false,
  ]);
  const autoDays = [false, false, false, true, false, false, false];

  const pickTheme = (next: Theme) => {
    setTheme(next);
    setThemeState(next);
  };

  const showBusy = () => {
    setBusy(true);
    window.setTimeout(() => setBusy(false), 2000);
  };

  return (
    <>
      <SkipLink />
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-paper px-5 py-3">
        <Logo />
        <div className="flex items-center gap-1" role="group" aria-label="Color theme">
          {THEME_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={theme === option.value ? "secondary" : "quiet"}
              size="sm"
              aria-pressed={theme === option.value}
              onClick={() => pickTheme(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </header>

      <main id="main" className="mx-auto flex max-w-[960px] flex-col gap-8 px-5 py-8">
        <div>
          <h1 className="text-[28px] font-bold text-ink">UI gallery</h1>
          <p className="text-sm text-ink-2">
            Development-only preview of the component kit. Open at /?gallery.
          </p>
          <Link to="/" className="mt-1 inline-block rounded-sm font-semibold text-brand hover:underline">
            Back to app
          </Link>
        </div>

        <Section title="Buttons">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
          <Button busy={busy} onClick={showBusy}>
            {busy ? "Saving" : "Save changes"}
          </Button>
        </Section>

        <Section title="Fields">
          <div className="flex w-full max-w-[360px] flex-col gap-4">
            <Field label="Units" hint="Whole minutes" required>
              <NumberField min={1} max={9999} step={1} />
            </Field>
            <Field label="Hours" hint="How many hours a week" error="Enter a number">
              <NumberField />
            </Field>
            <Field label="Agency">
              <Select defaultValue="north">
                <option value="north">North County</option>
                <option value="south">South County</option>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea />
            </Field>
          </div>
        </Section>

        <Section title="Day toggle">
          <DayToggle
            value={days}
            auto={autoDays}
            onChange={(i) => setDays((d) => d.map((v, j) => (j === i ? !v : v)))}
          />
        </Section>

        <Section title="Severity pills">
          {ALL_SEVERITIES.map((severity) => (
            <SeverityPill key={severity} severity={severity} />
          ))}
        </Section>

        <Section title="Panel">
          <Panel
            title="Week of Nov 3, 2026"
            meta="590 min, 39 units"
            tools={<Button size="sm" variant="secondary">Edit</Button>}
          >
            <p className="text-sm text-ink-2">A section with a header row and a body.</p>
          </Panel>
        </Section>

        <Section title="Dialog, toast and menu">
          <Dialog
            title="Remove task"
            description="This task will be removed from the week."
            trigger={<Button variant="danger">Remove</Button>}
          >
            <div className="flex justify-end gap-2">
              <Button variant="secondary">Cancel</Button>
              <Button variant="danger">Remove from week</Button>
            </div>
          </Dialog>
          <Button variant="secondary" onClick={() => setToastOpen(true)}>
            Show toast
          </Button>
          <Menu
            trigger={<Button variant="secondary">Account</Button>}
            label="scheduler@example.com"
            items={[
              { label: "Your account" },
              { label: "Agency details" },
              { label: "Sign out", destructive: true },
            ]}
          />
        </Section>

        <Section title="Empty state">
          <EmptyState
            title="Your team will appear here once you send an invite."
            action={<Button>Copy invite link</Button>}
          />
        </Section>

        <Section title="File drop">
          <FileDrop
            onFile={() => {}}
            title="Open the care plan PDF"
            acceptLabel="PDF from Fusion"
            hint="Reads the plan on your computer. Nothing is uploaded."
          />
        </Section>

        <Section title="Spinner and logo">
          <Spinner className="h-6 w-6 text-brand" />
          <Logo />
          <Logo showWordmark={false} />
        </Section>

        <ToastProvider>
          <Toast open={toastOpen} onOpenChange={setToastOpen} message="Invite link copied" />
          <ToastViewport />
        </ToastProvider>
      </main>
    </>
  );
}
