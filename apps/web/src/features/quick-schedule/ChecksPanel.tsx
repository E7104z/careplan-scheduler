import { CircleCheck } from "lucide-react";
import { ruleById, type Severity } from "@careplan/engine";
import { shortMonth } from "../../lib/format";
import { Panel } from "../../ui/Panel";
import { SeverityPill } from "../../ui/SeverityPill";
import { contextFor, groupResults } from "./grouping";
import { copyFor } from "./ruleCopy";
import type { CheckGroup } from "./types";
import type { QuickModel, QuickState } from "./types";

const SEVERITIES: Severity[] = ["BLOCK", "REVIEW", "WARN", "INFO"];

const GROUP_LABELS: Record<Severity, string> = {
  BLOCK: "Must fix before you use this schedule",
  REVIEW: "Needs review",
  WARN: "Worth checking",
  INFO: "Good to know",
};

interface CheckCardProps {
  group: CheckGroup;
  taskName: string | undefined;
  monthCount: number;
  onShowInWeek: (taskId: string) => void;
}

function CheckCard({ group, taskName, monthCount, onShowInWeek }: CheckCardProps) {
  const copy = copyFor(group.ruleId, group.severity, group.taskId ? { taskId: group.taskId } : undefined);
  const title = copy?.title ?? group.messages[0] ?? group.ruleId;
  const whatToDo = copy?.whatToDo ?? "";
  const context = contextFor(group, taskName, monthCount);
  const source = ruleById(group.ruleId)?.source;

  return (
    <details className="rounded-md border border-line bg-surface">
      <summary className="grid cursor-pointer gap-1 px-4 py-3">
        <span className="font-semibold text-ink">
          {title}
          {context ? <span className="font-normal text-ink-2"> · {context}</span> : null}
        </span>
        {whatToDo ? <span className="text-sm text-ink-2">{whatToDo}</span> : null}
      </summary>
      <div className="grid gap-1.5 border-t border-line px-4 py-3 text-sm text-ink-2">
        {group.months.length > 1 ? <p>Months: {group.months.map(shortMonth).join(", ")}</p> : null}
        <p>
          Rule <code className="rounded-sm bg-sunk px-1">{group.ruleId}</code> · {group.messages[0]}
        </p>
        {source ? <p>Source: {source}</p> : null}
        <p>Checked under {group.rulePackVersion}</p>
        {group.taskId ? (
          <p>
            <button
              type="button"
              className="rounded-sm font-semibold text-brand underline hover:text-brand-hover"
              onClick={() => onShowInWeek(group.taskId!)}
            >
              Show in week
            </button>
          </p>
        ) : null}
      </div>
    </details>
  );
}

interface ChecksPanelProps {
  state: QuickState;
  model: QuickModel;
  onShowInWeek: (taskId: string) => void;
}

/** APP-SPEC 5.5: grouped check cards in Must fix / Needs review / Check order, Good to know collapsed. */
export function ChecksPanel({ state, model, onShowInWeek }: ChecksPanelProps) {
  const groups = groupResults(model.results);
  const blocks = groups.filter((group) => group.severity === "BLOCK");
  const attention = groups.filter((group) => group.severity === "REVIEW" || group.severity === "WARN");
  const taskNames = new Map(state.tasks.map((task) => [task.id, task.name]));

  if (model.tasks.length === 0) {
    return (
      <Panel title="Checks" className="min-w-0">
        <p className="text-ink-2">Checks run as soon as there's a task.</p>
      </Panel>
    );
  }

  const renderGroup = (severity: Severity) => {
    const list = groups.filter((group) => group.severity === severity);
    if (list.length === 0) return null;
    const body = (
      <div className="grid gap-2">
        {list.map((group) => (
          <CheckCard
            key={`${group.ruleId}|${group.severity}|${group.taskId ?? ""}`}
            group={group}
            taskName={group.taskId ? taskNames.get(group.taskId) : undefined}
            monthCount={model.months.length}
            onShowInWeek={onShowInWeek}
          />
        ))}
      </div>
    );
    const heading = (
      <h3 className="flex items-center gap-2 text-[15px]">
        <SeverityPill severity={severity} />
        <span className="font-semibold text-ink">{GROUP_LABELS[severity]}</span>
        <span className="text-ink-3">({list.length})</span>
      </h3>
    );
    return (
      <div key={severity} className="grid gap-2">
        {heading}
        {body}
      </div>
    );
  };

  const infoGroups = groups.filter((group) => group.severity === "INFO");

  return (
    <Panel title="Checks" className="min-w-0">
      <div className="grid gap-4">
        {blocks.length === 0 && attention.length === 0 ? (
          <p className="flex items-center gap-2 text-ink">
            <CircleCheck className="h-5 w-5 text-brand" aria-hidden="true" />
            No problems found.
          </p>
        ) : null}
        {renderGroup("BLOCK")}
        {renderGroup("REVIEW")}
        {renderGroup("WARN")}
        {infoGroups.length > 0 ? (
          <details className="rounded-md border border-line bg-surface">
            <summary className="cursor-pointer px-4 py-3 font-semibold text-ink">
              Good to know ({infoGroups.length})
            </summary>
            <div className="grid gap-2 border-t border-line p-3">
              {infoGroups.map((group) => (
                <CheckCard
                  key={`${group.ruleId}|${group.severity}|${group.taskId ?? ""}`}
                  group={group}
                  taskName={group.taskId ? taskNames.get(group.taskId) : undefined}
                  monthCount={model.months.length}
                  onShowInWeek={onShowInWeek}
                />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </Panel>
  );
}
