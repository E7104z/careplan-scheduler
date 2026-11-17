import { type ReactNode } from "react";
import { Link } from "react-router";
import {
  exampleDayTotals,
  exampleMatchLine,
  exampleRefusal,
  exampleRuleCard,
  exampleWeek,
} from "../features/landing/example";
import { usePageTitle } from "../lib/usePageTitle";
import { SeverityPill } from "../ui/SeverityPill";
import { UnitTiles } from "../ui/UnitTiles";

const primaryLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-brand px-4 font-semibold leading-none text-brand-on transition-colors hover:bg-brand-hover max-sm:min-h-11";
const secondaryLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-line-2 bg-surface px-4 font-semibold leading-none text-ink transition-colors hover:bg-sunk max-sm:min-h-11";

// What an agency account adds, each something the app does today (saved plans behind their BAA gate).
const AGENCY_FEATURES = [
  {
    title: "Your team, with roles",
    detail: "Invite schedulers and viewers by link. Owners decide who can change schedules.",
  },
  {
    title: "Every plan kept",
    detail:
      "Save each care plan under its participant so anyone on the team can open it again. Saved plans never hold the DCN.",
  },
  {
    title: "Worker load across participants",
    detail: "See a worker booked in two visits at once, or over 40 hours in a workweek, across every participant.",
  },
  {
    title: "Built for participant privacy",
    detail:
      "A business associate agreement for your agency, sessions that end after 30 idle minutes, and no analytics trackers.",
  },
];

function Section({
  heading,
  lead,
  detail,
  figure,
}: {
  heading: string;
  lead: string;
  detail: string;
  figure: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[22px] font-bold text-ink">{heading}</h2>
      <p className="text-ink-2">{lead}</p>
      <p className="text-ink-2">{detail}</p>
      <figure className="mt-1">{figure}</figure>
    </section>
  );
}

export function Landing() {
  const headingRef = usePageTitle("CarePlan Scheduler");
  const hero = exampleDayTotals();
  const matchLine = exampleMatchLine();
  const week = exampleWeek();
  const refusal = exampleRefusal();
  const card = exampleRuleCard();

  return (
    <div className="mx-auto w-full max-w-[1440px] px-[max(16px,env(safe-area-inset-left))]">
      <section className="grid gap-10 py-12 lg:grid-cols-2 lg:items-center">
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[40px] font-bold leading-tight text-ink max-sm:text-[32px]"
          >
            Open a Fusion care plan PDF. Get a schedule that follows Missouri's rules.
          </h1>
          <p className="mt-4 max-w-[62ch] text-[17px] text-ink-2">
            Open the care plan PDF from Fusion. CarePlan Scheduler reads every
            task, checks its total against Fusion's, builds the week, and won't let anyone
            change it in a way that breaks a rule. Every check names the policy it comes
            from.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/quick" className={primaryLink}>
              Try Quick Schedule
            </Link>
            <Link to="/sign-up" className={secondaryLink}>
              Create agency account
            </Link>
          </div>
          <p className="mt-3 text-sm text-ink-3">
            Quick Schedule needs no account. Nothing you open is uploaded.
          </p>
        </div>
        <figure
          aria-labelledby="hero-caption"
          className="rounded-md border border-line bg-surface p-5"
        >
          <UnitTiles dayTotals={hero.dayTotals} activeDays={hero.activeDays} />
          <figcaption id="hero-caption" className="mt-4 flex flex-col gap-1">
            <span className="flex items-center gap-2 text-sm font-medium text-ink-2">
              <span className="inline-block h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
              {hero.status}
            </span>
            <span className="text-[13px] text-ink-3">
              Day totals for the example care plan, built and checked on this page.
            </span>
          </figcaption>
        </figure>
      </section>

      <section className="grid gap-10 py-12 md:grid-cols-2">
        <Section
          heading="Reads the care plan PDF from Fusion"
          lead="Open the care plan PDF."
          detail="Fusion's care plan PDFs are read in your browser, every page, and the plan stays on your computer."
          figure={
            <div className="rounded-md border border-line bg-surface p-4">
              <p className="text-ink">{matchLine}</p>
            </div>
          }
        />
        <Section
          heading="Built from tasks, not averages"
          lead="Monthly units are never spread evenly across the days."
          detail="Each task goes on its own days, so a week's minutes come from the tasks themselves. These day totals were worked out on this page by the same engine that checks every schedule."
          figure={
            <div className="rounded-md border border-line bg-surface p-4">
              <p className="text-[28px] font-bold text-ink">{week.weekText}</p>
              <p className="mt-1 text-sm text-ink-3">Minutes, Sunday to Saturday</p>
            </div>
          }
        />
        <Section
          heading="Can't be edited out of compliance"
          lead="Schedules can be changed, but not into something that breaks a rule."
          detail="A change that would break a rule is refused, and the limit is named."
          figure={
            <div className="rounded-md border border-block bg-block-bg p-4 text-block">
              <p className="font-semibold">Not changed.</p>
              <p className="mt-1">{refusal.sentence}</p>
              <p className="mt-1">{refusal.fix}</p>
            </div>
          }
        />
        <Section
          heading="Every check names its source"
          lead="Every result names the rule it came from and the policy it cites."
          detail="State reviewers can check the whole catalog."
          figure={
            <div className="rounded-md border border-line bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">Rule {card.id}</span>
                {card.severities.map((severity) => (
                  <SeverityPill key={severity} severity={severity} />
                ))}
              </div>
              <p className="mt-2 text-sm text-ink">{card.rule}</p>
              <p className="mt-2 text-[13px] text-ink-3">Source: {card.source}</p>
            </div>
          }
        />
      </section>

      <section aria-labelledby="agencies-heading" className="grid gap-6 border-t border-line py-12">
        <div className="max-w-[62ch]">
          <h2 id="agencies-heading" className="text-[22px] font-bold text-ink">
            For agencies: one place for every participant's schedule
          </h2>
          <p className="mt-2 text-ink-2">
            An agency account adds what a team needs on top of Quick Schedule.
          </p>
        </div>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {AGENCY_FEATURES.map((feature) => (
            <li key={feature.title} className="rounded-md border border-line bg-surface p-4">
              <h3 className="font-semibold text-ink">{feature.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{feature.detail}</p>
            </li>
          ))}
        </ul>
        <div>
          <Link to="/sign-up" className={primaryLink}>
            Set up your agency
          </Link>
        </div>
      </section>

      <section className="flex flex-col items-start gap-3 py-12">
        <p className="text-ink-2">
          For state reviewers: every rule is listed with its status and the DHSS source it
          cites.
        </p>
        <Link to="/rules" className="rounded-sm font-semibold text-brand hover:underline">
          See every rule and its source
        </Link>
      </section>
    </div>
  );
}
