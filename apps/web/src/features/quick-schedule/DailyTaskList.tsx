import { Fragment, useId } from "react";
import type { Weekday } from "@careplan/engine";
import { formatDuration, formatUnits, weekdayName } from "../../lib/format";
import { Panel } from "../../ui/Panel";
import { hasSchedule } from "./model";
import type { QuickModel, QuickState } from "./types";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

interface DayVisit {
  weekday: Weekday;
  tasks: { name: string; minutes: number }[];
  taskMinutes: number;
  transportMinutes: number;
}

/** Each weekday's tasks in care plan order, with the transportation set aside on its usual day. */
export function dailyVisits(state: QuickState, model: QuickModel): DayVisit[] {
  const order = new Map(model.tasks.map((task, index) => [task.id, index]));
  const names = new Map(model.tasks.map((task) => [task.id, task.name]));
  return WEEKDAYS.map((weekday) => {
    const tasks = model.entries
      .filter((entry) => entry.weekday === weekday)
      .sort((a, b) => (order.get(a.taskId) ?? 0) - (order.get(b.taskId) ?? 0))
      .map((entry) => ({ name: names.get(entry.taskId) ?? entry.taskId, minutes: entry.minutes }));
    return {
      weekday,
      tasks,
      taskMinutes: tasks.reduce((sum, task) => sum + task.minutes, 0),
      transportMinutes: model.allowance && state.transport.day === weekday ? model.allowance.weeklyMinutes : 0,
    };
  });
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

function DayCard({ visit }: { visit: DayVisit }) {
  const headingId = useId();
  const total = visit.taskMinutes + visit.transportMinutes;
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 grid-cols-1 content-start gap-1.5 rounded-sm border border-line p-3 break-inside-avoid">
      <h3 id={headingId} className="text-[15px] font-semibold text-ink">
        {weekdayName(visit.weekday)}
      </h3>
      {total === 0 ? (
        <p className="text-sm text-ink-3">No visit</p>
      ) : (
        <>
          <ul className="grid min-w-0 grid-cols-1 gap-0.5 text-sm text-ink">
            {visit.tasks.map((task) => (
              <li key={task.name} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">
                  <TaskName name={task.name} />
                </span>
                <span className="shrink-0 whitespace-nowrap">{task.minutes} min</span>
              </li>
            ))}
            {visit.transportMinutes ? (
              <li className="flex justify-between gap-3 italic text-ink-2">
                <span className="min-w-0 break-words">Essential transportation</span>
                <span className="shrink-0 whitespace-nowrap">{visit.transportMinutes} min</span>
              </li>
            ) : null}
          </ul>
          <p className="border-t border-line pt-1.5 text-sm text-ink">
            <strong>Visit length {formatDuration(total)}</strong>
            <span className="block text-[13px] text-ink-2">
              {total} minutes = {formatUnits(total)}
              {visit.transportMinutes ? ` (${visit.taskMinutes} for tasks, ${visit.transportMinutes} for transportation)` : ""}
            </span>
          </p>
        </>
      )}
    </section>
  );
}

/**
 * APP-SPEC 5.4 daily task list, for the caregiver, the participant and EVV: each day's tasks and
 * minutes, and a visit length that is their total, so an EVV visit window can be set from it.
 * Printed with the schedule.
 */
export function DailyTaskList({ state, model }: { state: QuickState; model: QuickModel }) {
  if (!hasSchedule(model)) return null;
  const visits = dailyVisits(state, model);
  return (
    <Panel title="Daily task list" meta="For the caregiver and EVV" className="min-w-0 print:break-before-page">
      <p className="mb-3 text-sm text-ink-2">
        The tasks for each visit and their minutes. Set each EVV visit window to its visit length.
        {model.trims.length > 0
          ? " On the dates marked in Month, the visit is shorter because the month's units run out."
          : ""}
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-4">
        {visits.map((visit) => (
          <DayCard key={visit.weekday} visit={visit} />
        ))}
      </div>
    </Panel>
  );
}
