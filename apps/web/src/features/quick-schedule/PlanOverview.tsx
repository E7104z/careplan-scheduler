import { Fragment, useId, type ReactNode } from "react";
import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";
import type { ImportIssue } from "@careplan/import";
import { cn } from "../../lib/cn";
import { formatDuration, formatUnits, monthName, niceDate, weekdayName } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { READ_SUMMARY_TITLE_ID } from "../import/ReadSummary";
import { figureMonth, planWeek, serviceDayWarning, serviceDays, serviceName, type PlanDay } from "./carePlan";
import { checksumLines } from "./checksumText";
import { monthBalance, monthFigures } from "./model";
import { otherAmount, otherDetail, otherName, otherReasonLine, otherService, planOthers } from "./others";
import { scheduleStatus } from "./status";
import type { CarePlan, PlanOther, QuickModel } from "./types";

interface PlanProps {
  plan: CarePlan;
  models: QuickModel[];
}

/** "Dressing/Grooming" may wrap after the slash rather than mid-word. */
function TaskName({ name }: { name: string }) {
  const parts = name.split("/");
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 ? (
            <>
              /<wbr />
            </>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid">
      <dt className="text-[13px] text-ink-3">{term}</dt>
      <dd className="font-semibold text-ink">{children}</dd>
    </div>
  );
}

/**
 * APP-SPEC 5.8: switch between the whole care plan and each service's detail, on the same page.
 * Toggle buttons; the pressed one is what the page shows.
 */
export function ServiceTabs({ plan, models, onView }: PlanProps & { onView: (view: "plan" | number) => void }) {
  const item = "grid min-h-11 rounded-sm border px-3.5 py-1.5 text-left text-sm";
  const on = "border-brand bg-brand-tint text-ink";
  const off = "border-line-2 bg-surface text-ink-2 hover:border-brand";
  return (
    <nav aria-label="Care plan views" className="flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        aria-pressed={plan.view === "plan"}
        className={cn(item, plan.view === "plan" ? on : off)}
        onClick={() => onView("plan")}
      >
        <span className="font-semibold text-ink">Whole care plan</span>
        <span className="text-[13px]">{`${plan.services.length} services in one week`}</span>
      </button>
      {plan.services.map((state, index) => (
        <button
          key={index}
          type="button"
          aria-pressed={plan.view === index}
          className={cn(item, plan.view === index ? on : off)}
          onClick={() => onView(index)}
        >
          <span className="font-semibold text-ink">{serviceName(state, models[index]!)}</span>
          <span className="text-[13px]">{state.headerUnits !== null ? `${state.headerUnits} units a month` : models[index]!.svc.code}</span>
        </button>
      ))}
    </nav>
  );
}

/** One note, with the service it's about when the plan has several. */
function noteText(note: ImportIssue): string {
  if (note.code === "incomplete") {
    return `Built from ${note.have} of the plan's ${note.total} rows. The missing tasks aren't scheduled.`;
  }
  return note.message;
}

/**
 * IMP-19: what was read and what became of it: "6 authorizations read: 1 scheduled in the week,
 * 1 nurse visit by month, 4 kept without a schedule (1 not recognized)". Counted from the plan,
 * never fixed numbers.
 */
export function coverageLine(plan: CarePlan): string {
  const others = planOthers(plan);
  const visits = new Set(plan.visits.map((visit, index) => visit.pa ?? `#${index}`)).size;
  const unknown = others.filter((other) => !otherService(other) && other.code !== null).length;
  const total = plan.services.length + visits + others.length;
  const parts = [
    `${plan.services.length} scheduled in the week`,
    visits > 0 ? `${visits} nurse ${visits === 1 ? "visit" : "visits"} by month` : null,
    others.length > 0 ? `${others.length} kept without a schedule${unknown > 0 ? ` (${unknown} not recognized)` : ""}` : null,
  ].filter(Boolean);
  return `${total} ${total === 1 ? "authorization" : "authorizations"} read: ${parts.join(", ")}.`;
}

/**
 * APP-SPEC 5.8 read summary for a care plan with several authorizations: who, the plan's dates,
 * each authorization and whether our total matches Fusion's, the visits, and the reader's notes.
 */
export function PlanSummary({ plan, models, onNewPlan }: PlanProps & { onNewPlan: () => void }) {
  const first = plan.services[0]!;
  const title = first.identity?.name ?? "Care plan from Fusion";
  const start = plan.services.map((state) => state.plan.start).sort()[0]!;
  const end = plan.services.map((state) => state.plan.end).sort().at(-1)!;
  const scheduleStart = models.map((model) => model.auth.start).sort()[0]!;
  const tasks = plan.services.reduce((sum, state) => sum + state.tasks.length, 0);
  const providers = [...new Set(plan.services.map((state) => state.provider).filter((p): p is string => p !== null))];
  const notes = [
    ...plan.notes.map(noteText),
    ...plan.services.flatMap((state, index) =>
      state.notes.map((note) => `${serviceName(state, models[index]!)}: ${noteText(note)}`),
    ),
  ];

  return (
    <section
      aria-labelledby={READ_SUMMARY_TITLE_ID}
      className="grid gap-3 rounded-md border border-line bg-surface px-5 py-4 max-sm:px-4"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <div className="min-w-0">
          <h2 id={READ_SUMMARY_TITLE_ID} tabIndex={-1} className="text-[17px] font-bold text-ink">
            {title}
          </h2>
          <p className="text-[13px] text-ink-2">{`Read from Fusion${first.identity ? ` · DCN ${first.identity.dcn}` : ""}`}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="quiet" size="sm" onClick={onNewPlan}>
            New care plan
          </Button>
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-7 gap-y-2">
        <Fact term="Plan">{`${niceDate(start)} to ${niceDate(end)}`}</Fact>
        {scheduleStart > start ? <Fact term="Schedule starts">{niceDate(scheduleStart)}</Fact> : null}
        <Fact term="Services">{String(plan.services.length)}</Fact>
        <Fact term="Tasks">{String(tasks)}</Fact>
        {plan.visits.length > 0 ? <Fact term="Nurse visits">{String(plan.visits.length)}</Fact> : null}
        {planOthers(plan).length > 0 ? <Fact term="Kept, not scheduled">{String(planOthers(plan).length)}</Fact> : null}
        {providers.length === 1 ? <Fact term="Provider">{providers[0]}</Fact> : null}
      </dl>

      <p className="text-sm text-ink">
        <strong>One schedule for the whole care plan.</strong> Each service keeps its own authorization, units and
        checks; the week shows them together. {coverageLine(plan)}
      </p>

      <ul className="grid gap-1.5 text-sm">
        {plan.services.map((state, index) => {
          const model = models[index]!;
          const checksum = model.checksum;
          const lines = checksum ? checksumLines(checksum) : null;
          return (
            <li key={index} className={cn("flex items-start gap-2", checksum && !checksum.matches ? "text-review" : "text-brand")}>
              {checksum && !checksum.matches ? (
                <CircleHelp className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              ) : (
                <CircleCheck className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              )}
              <span className="text-ink">
                <strong>{`${serviceName(state, model)} · ${model.svc.code}`}</strong>
                {state.headerUnits !== null ? `: ${state.headerUnits} units a month.` : "."}{" "}
                {lines ? `${lines.lead} ${lines.detail}` : ""}
              </span>
            </li>
          );
        })}
      </ul>

      {notes.length > 0 ? (
        <ul className="grid list-disc gap-0.5 pl-[18px] text-sm text-ink-2">
          {notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * APP-SPEC 5.8 authorizations: each service's own units for the month, what the week uses of
 * them, and its checks, with a way into its detail.
 */
export function AuthorizationsPanel({ plan, models, onView }: PlanProps & { onView: (view: number) => void }) {
  const cell = "border-b border-line px-2.5 py-2 align-top";
  const number = cn(cell, "text-right");
  return (
    <Panel title="Authorizations" meta="Each keeps its own units" className="min-w-0">
      <div role="region" aria-label="Authorizations" tabIndex={0} className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="sr-only">Each service's authorization and what the schedule uses of it</caption>
          <thead className="bg-sunk text-[13px] text-ink-2">
            <tr>
              <th scope="col" className={cn(cell, "font-semibold")}>Service</th>
              <th scope="col" className={cn(cell, "font-semibold")}>Prior authorization</th>
              <th scope="col" className={cn(number, "font-semibold")}>Authorized</th>
              <th scope="col" className={cn(number, "font-semibold")}>Scheduled</th>
              <th scope="col" className={cn(number, "font-semibold")}>Left</th>
              <th scope="col" className={cn(cell, "font-semibold")}>Checks</th>
              <th scope="col" className={cell}>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.services.map((state, index) => {
              const model = models[index]!;
              const name = serviceName(state, model);
              const month = figureMonth(plan, index, model);
              const figures = month ? monthFigures(model, month) : null;
              const balance = figures ? monthBalance(figures) : null;
              const status = scheduleStatus(state, model);
              const monthWord = month ? monthName(month).split(" ")[0] : "";
              return (
                <tr key={index}>
                  <th scope="row" className={cn(cell, "font-normal")}>
                    <span className="font-semibold text-ink">{name}</span>
                    <span className="block text-[13px] text-ink-3">{`${model.svc.name} · ${model.svc.code}`}</span>
                  </th>
                  <td className={cell}>{state.pa ?? "—"}</td>
                  <td className={number}>{figures ? `${figures.authorizedUnits} units in ${monthWord}` : "—"}</td>
                  <td className={number}>{balance ? formatUnits(balance.scheduledMinutes) : "—"}</td>
                  <td className={cn(number, balance && balance.leftMinutes < 0 ? "font-semibold text-block" : "")}>
                    {balance
                      ? balance.leftMinutes >= 0
                        ? formatUnits(balance.leftMinutes)
                        : `${formatUnits(-balance.leftMinutes)} over`
                      : "—"}
                  </td>
                  <td className={cn(cell, status.blocked ? "font-semibold text-block" : "text-ink")}>{status.title}</td>
                  <td className={cell}>
                    <Button variant="secondary" size="sm" onClick={() => onView(index)}>
                      Open <span className="sr-only">{name}</span>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function DayCard({ day, names }: { day: PlanDay; names: string[] }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 grid-cols-1 content-start gap-2 rounded-sm border border-line p-3 break-inside-avoid">
      <h3 id={headingId} className="text-[15px] font-semibold text-ink">
        {weekdayName(day.weekday)}
      </h3>
      {day.minutes === 0 ? (
        <p className="text-sm text-ink-3">No service</p>
      ) : (
        <>
          {day.byService.map((minutes, service) =>
            minutes === 0 ? null : (
              <div key={service} className="grid gap-0.5">
                <p className="flex justify-between gap-3 text-[13px] font-semibold text-ink-2">
                  <span className="min-w-0 break-words">{names[service]}</span>
                  <span className="shrink-0 whitespace-nowrap">{formatDuration(minutes)}</span>
                </p>
                <ul className="grid min-w-0 grid-cols-1 gap-0.5 text-sm text-ink">
                  {day.items
                    .filter((item) => item.service === service)
                    .map((item) => (
                      <li key={item.name} className={cn("flex justify-between gap-3", item.transport ? "italic text-ink-2" : "")}>
                        <span className="min-w-0 break-words">
                          <TaskName name={item.name} />
                        </span>
                        <span className="shrink-0 whitespace-nowrap">{item.minutes} min</span>
                      </li>
                    ))}
                </ul>
              </div>
            ),
          )}
          <p className="border-t border-line pt-1.5 text-sm text-ink">
            <strong>{`Total ${formatDuration(day.minutes)}`}</strong>
            <span className="block text-[13px] text-ink-2">
              {day.minutes} minutes = {formatUnits(day.minutes)}
            </span>
          </p>
        </>
      )}
    </section>
  );
}

/**
 * APP-SPEC 5.8 the participant's week: every service on each day, each task under the service
 * that authorizes it, so no one has to switch between schedules to see a day.
 */
export function PlanWeekPanel({ plan, models }: PlanProps) {
  const week = planWeek(plan, models);
  const names = plan.services.map((state, index) => serviceName(state, models[index]!));
  const total = week.reduce((sum, day) => sum + day.minutes, 0);
  const warning = serviceDayWarning(plan, models);
  return (
    <Panel title="The participant's week" meta={`${formatDuration(total)} a week, all services`} className="min-w-0">
      <p className="mb-3 text-sm text-ink-2">
        Every service on each day, under the service that authorizes it. Set each EVV visit window from that
        service's minutes. To move a task, open its service above.
      </p>
      <p className="mb-3 text-sm font-semibold text-ink">Service days this week: {serviceDays(plan, models)}</p>
      {warning ? (
        <p role="note" className="mb-3 flex items-start gap-2 rounded-sm bg-warn-bg px-3.5 py-2.5 text-sm text-ink">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-none text-warn" aria-hidden="true" />
          <span>{warning}</span>
        </p>
      ) : null}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {week.map((day) => (
          <DayCard key={day.weekday} day={day} names={names} />
        ))}
      </div>
    </Panel>
  );
}

function OtherItem({ plan, other, placing }: { plan: CarePlan; other: PlanOther; placing?: (other: PlanOther) => ReactNode }) {
  const recognized = otherService(other) !== undefined || other.code === null;
  return (
    <li className={cn("grid gap-1 rounded-sm border border-l-4 border-line px-3 py-2 text-sm", recognized ? "border-l-info" : "border-l-review")}>
      <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="min-w-0">
          <strong className="text-ink">{otherName(other)}</strong>
          <span className="text-ink-2">{` · ${otherDetail(other)}`}</span>
        </span>
        <span className={cn("text-[13px] font-semibold", recognized ? "text-ink-2" : "text-review")}>{otherReasonLine(plan, other)}</span>
      </span>
      <span className="text-ink">{otherAmount(other)}</span>
      <span className="text-[13px] text-ink-3">
        {[other.pa ? `PA ${other.pa}` : null, other.provider].filter(Boolean).join(" · ") || "No authorization number read"}
      </span>
      {other.rows.length > 0 ? (
        <details className="text-[13px] text-ink-2">
          <summary className="cursor-pointer text-brand">As read from Fusion</summary>
          <ul className="mt-1 grid gap-0.5">
            {other.rows.map((row, index) => (
              <li key={index} className="whitespace-pre-wrap break-words font-mono">
                {row.replace(/\t/g, "  ")}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {placing?.(other)}
    </li>
  );
}

/**
 * IMP-19: authorizations in the care plan that aren't in the week, kept so nothing read is lost:
 * services arranged by date or with no caregiver time, and any service we don't recognize.
 */
export function OthersPanel({ plan, placing }: { plan: CarePlan; placing?: (other: PlanOther) => ReactNode }) {
  const others = planOthers(plan);
  if (others.length === 0) return null;
  return (
    <Panel title="Other authorizations" meta="Kept with the plan, not in the week" className="min-w-0">
      <p className="mb-3 text-sm text-ink-2">
        These are in the care plan but Quick Schedule doesn't place them in the week. Each keeps its own
        authorization. Arrange the ones by date with the provider; check any marked not recognized against Fusion.
      </p>
      <ul className="grid gap-2">
        {others.map((other, index) => (
          <OtherItem key={other.id ?? index} plan={plan} other={other} placing={placing} />
        ))}
      </ul>
    </Panel>
  );
}
