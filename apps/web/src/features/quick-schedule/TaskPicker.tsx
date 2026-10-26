import { useId, useState, type KeyboardEvent } from "react";
import type { RulePack, TaskDef } from "@careplan/engine";
import { cn } from "../../lib/cn";
import type { QuickModel, QuickState } from "./types";

/** The picker's input id, so the page can put focus there ("Build a schedule by hand"). */
export const TASK_PICKER_ID = "qs-task-picker";

export interface TaskPickerProps {
  state: QuickState;
  model: QuickModel;
  pack: RulePack;
  onAdd: (task: TaskDef) => void;
}

/** QS-04: the service's tasks (not transportation, not already added) matching the name or an alias. */
function matches(pack: RulePack, state: QuickState, model: QuickModel, query: string): TaskDef[] {
  const used = new Set(state.tasks.map((task) => task.taskCode));
  const q = query.trim().toLowerCase();
  return pack.tasks.filter(
    (def) =>
      def.programs.includes(model.svc.program) &&
      def.isTransport !== true &&
      !used.has(def.taskCode) &&
      (q === "" || def.name.toLowerCase().includes(q) || def.aliases.some((alias) => alias.toLowerCase().includes(q))),
  );
}

/**
 * QS-04 "Add a task": an ARIA 1.2 combobox with a list popup. Arrow keys move the highlight,
 * Enter adds the highlighted task, Escape closes the list.
 */
export function TaskPicker({ state, model, pack, onAdd }: TaskPickerProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = matches(pack, state, model, query);
  const highlighted = options.length > 0 ? Math.min(active, options.length - 1) : -1;
  const optionId = (index: number) => `${listId}-option-${index}`;

  const add = (def: TaskDef) => {
    setQuery("");
    setActive(0);
    setOpen(false);
    onAdd(def);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (options.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((highlighted + step + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const def = open ? options[highlighted] : undefined;
      if (def) add(def);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  const empty =
    query.trim() === ""
      ? "Every task for this service is already added"
      : `No ${model.svc.name} task matches "${query.trim()}"`;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={TASK_PICKER_ID} className="text-sm font-medium text-ink-2">
        Add a task
      </label>
      <input
        id={TASK_PICKER_ID}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && highlighted >= 0 ? optionId(highlighted) : undefined}
        autoComplete="off"
        placeholder="Type a task name, like Bathing"
        className="h-10 w-full rounded-sm border border-line-2 bg-surface px-3 text-ink placeholder:text-ink-3 focus:border-brand"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Tasks"
        hidden={!open}
        className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[280px] overflow-auto rounded-sm border border-line-2 bg-surface p-1 shadow-pop"
      >
        {options.length > 0 ? (
          options.map((def, index) => (
            <li
              key={def.taskCode}
              id={optionId(index)}
              role="option"
              aria-selected={index === highlighted}
              // Keep focus in the input so the list doesn't close before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(def)}
              className={cn(
                "cursor-pointer rounded-[4px] px-2.5 py-2 text-ink hover:bg-brand-tint max-sm:min-h-11",
                index === highlighted && "bg-brand-tint",
              )}
            >
              {def.name}
            </li>
          ))
        ) : (
          <li role="option" aria-selected={false} aria-disabled="true" className="px-2.5 py-2 text-ink-3">
            {empty}
          </li>
        )}
      </ul>
    </div>
  );
}
