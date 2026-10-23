import { MO_2026_07, RULE_CATALOG, type RuleArea, type RuleStatus } from "@careplan/engine";
import { formatDate } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";
import { SeverityPill } from "../ui/SeverityPill";

const AREAS: RuleArea[] = ["Authorization", "Schedule", "Conflicts and eligibility"];

const STATUS_LEGEND: { status: RuleStatus; text: string }[] = [
  { status: "VERIFIED", text: "Checked against the cited DHSS source" },
  { status: "PARTIAL", text: "Partly confirmed; results show as Needs review" },
  { status: "APPROVED", text: "Product decision, documented" },
  { status: "OPEN", text: "Waiting on DHSS" },
];

const HEAD = "px-3 py-2 text-left text-[13px] font-semibold text-ink-2";
const CELL = "px-3 py-2 align-top text-sm text-ink";

export function Rules() {
  const headingRef = usePageTitle("Rules and sources | CarePlan Scheduler");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-[max(16px,env(safe-area-inset-left))] py-12">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold text-ink">
        Rules and sources
      </h1>
      <p className="mt-3 max-w-[62ch] text-ink-2">
        Every check CarePlan Scheduler runs, with the rule text, the results it can show, its
        status, and the source it cites.
      </p>
      <p className="mt-2 text-ink-2">
        Rule pack: Missouri home and community-based services, {MO_2026_07.id}, effective{" "}
        {formatDate(MO_2026_07.effectiveDate)}.
      </p>

      <section className="mt-8">
        <h2 className="text-[17px] font-bold text-ink">Statuses</h2>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {STATUS_LEGEND.map(({ status, text }) => (
            <div key={status} className="flex items-baseline gap-2">
              <dt className="shrink-0 font-semibold text-ink">{status}</dt>
              <dd className="text-ink-2">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {AREAS.map((area) => (
        <section key={area} className="mt-10">
          <h2 className="text-[17px] font-bold text-ink">{area}</h2>
          <div className="mt-3 overflow-x-auto rounded-md border border-line">
            <table className="w-full border-collapse">
              <thead className="bg-sunk">
                <tr>
                  <th scope="col" className={HEAD}>
                    Rule
                  </th>
                  <th scope="col" className={HEAD}>
                    What it checks
                  </th>
                  <th scope="col" className={HEAD}>
                    Results
                  </th>
                  <th scope="col" className={HEAD}>
                    Status
                  </th>
                  <th scope="col" className={HEAD}>
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {RULE_CATALOG.filter((rule) => rule.area === area).map((rule) => (
                  <tr key={rule.id} className="border-t border-line">
                    <th
                      scope="row"
                      className="whitespace-nowrap px-3 py-2 align-top font-semibold text-ink"
                    >
                      {rule.id}
                    </th>
                    <td className={CELL}>{rule.rule}</td>
                    <td className={CELL}>
                      <span className="flex flex-wrap gap-1">
                        {rule.severities.map((severity) => (
                          <SeverityPill key={severity} severity={severity} />
                        ))}
                      </span>
                    </td>
                    <td className={CELL}>{rule.status}</td>
                    <td className={CELL}>{rule.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="mt-10">
        <h2 className="text-[17px] font-bold text-ink">Services and monthly limits</h2>
        <div className="mt-3 overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse">
            <thead className="bg-sunk">
              <tr>
                <th scope="col" className={HEAD}>
                  Code
                </th>
                <th scope="col" className={HEAD}>
                  Service
                </th>
                <th scope="col" className={HEAD}>
                  Unit
                </th>
                <th scope="col" className={HEAD}>
                  Monthly ceiling
                </th>
                <th scope="col" className={HEAD}>
                  Weekly hour limit
                </th>
                <th scope="col" className={HEAD}>
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {MO_2026_07.services.map((service) => (
                <tr key={service.code} className="border-t border-line">
                  <th
                    scope="row"
                    className="whitespace-nowrap px-3 py-2 align-top font-semibold text-ink"
                  >
                    {service.code}
                  </th>
                  <td className={CELL}>{service.name}</td>
                  <td className={CELL}>{service.unit === "15min" ? "15 minutes" : "visit"}</td>
                  <td className={CELL}>{service.monthlyCeiling ?? "—"}</td>
                  <td className={CELL}>{service.weeklyHourLimit ?? "—"}</td>
                  <td className={CELL}>{service.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[17px] font-bold text-ink">Days-per-month factors</h2>
        <p className="mt-2 text-ink-2">
          Days scheduled a week, and the days a month they represent.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {Object.entries(MO_2026_07.daysPerMonthFactor).map(([days, factor]) => (
            <li
              key={days}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              {days} day{days === "1" ? "" : "s"} a week: {factor} days a month
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

