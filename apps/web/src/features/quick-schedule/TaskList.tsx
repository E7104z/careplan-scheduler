import type { Dispatch } from "react";
import type { RulePack, TaskDef } from "@careplan/engine";
import { PaneSection } from "./PaneSection";
import type { QuickAction } from "./state";
import { TASK_PICKER_ID, TaskPicker } from "./TaskPicker";
import { TaskRow } from "./TaskRow";
import type { QuickModel, QuickState } from "./types";
import { refusalPlace, type QuickFeedback } from "./useQuickStore";

export interface TaskListProps {
  state: QuickState;
  model: QuickModel;
  pack: RulePack;
  feedback: QuickFeedback | null;
  dispatch: Dispatch<QuickAction>;
  /** Where focus goes once the change lands: a task's minutes after adding, the picker after removing. */
  onFocusAfter: (selector: string) => void;
}

/** The refused task-day change for this task, if the last dispatch was one (APP-SPEC 5.7). */
function refusalFor(feedback: QuickFeedback | null, taskId: string): string | null {
  if (!feedback || feedback.refusal === undefined || refusalPlace(feedback.action) !== "task") return null;
  const action = feedback.action;
  return "taskId" in action && action.taskId === taskId ? feedback.refusal : null;
}

/** The Tasks section: one row per task, and the picker by hand (QS-04). */
export function TaskList({ state, model, pack, feedback, dispatch, onFocusAfter }: TaskListProps) {
  const count = state.tasks.length;
  const add = (def: TaskDef) => {
    // QS-04: focus moves to the new task's minutes (its id is the next one) once it's added.
    onFocusAfter(`[data-minutes-for="qt-${state.nextId}"]`);
    dispatch({ type: "addTask", taskCode: def.taskCode, name: def.name });
  };

  return (
    <PaneSection title="Tasks" hint={`${count} ${count === 1 ? "task" : "tasks"}`}>
      {count > 0 ? (
        <ul className="grid gap-2.5">
          {state.tasks.map((task) => (
            <li key={task.id}>
              <TaskRow
                task={task}
                state={state}
                placedDays={model.pattern.filter((entry) => entry.taskId === task.id).map((entry) => entry.weekday)}
                refusal={refusalFor(feedback, task.id)}
                seq={feedback?.seq ?? 0}
                dispatch={dispatch}
                onRemove={() => {
                  onFocusAfter(`#${TASK_PICKER_ID}`);
                  dispatch({ type: "removeTask", taskId: task.id });
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-2">No tasks yet. Add the first task from the care plan below.</p>
      )}
      {state.source === "manual" ? <TaskPicker state={state} model={model} pack={pack} onAdd={add} /> : null}
    </PaneSection>
  );
}
