import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MO_2026_07, type Weekday } from "@careplan/engine";
import { buildQuickModel } from "../../src/features/quick-schedule/model";
import { saveQuickState } from "../../src/features/quick-schedule/persistence";
import { manualState, reduce, type QuickAction } from "../../src/features/quick-schedule/state";
import type { QuickState } from "../../src/features/quick-schedule/types";
import { renderQuick, setUpQuickTests, statusPanel, TODAY } from "./ui-helpers";

setUpQuickTests();

function run(state: QuickState, ...actions: QuickAction[]): QuickState {
  return actions.reduce((current, action) => {
    const result = reduce(current, action, MO_2026_07);
    if (result.refusal !== undefined) throw new Error(`Setup step refused: ${result.refusal}`);
    return result.state;
  }, state);
}

function placed(state: QuickState, taskId: string): Weekday[] {
  return buildQuickModel(state, MO_2026_07).pattern.filter((e) => e.taskId === taskId).map((e) => e.weekday);
}

/**
 * By hand, November 2026 (Sundays and Mondays come five times): Clean Bath on Mondays and Clean
 * Kitchen on Sundays at 21 of their 20 minutes, Trash (10 min, 1 day) unselected, and November's
 * Fusion figure at 17 units (255 min). The month holds 250 minutes; Trash on a Sunday adds 50
 * and goes over, on a Wednesday (four times) adds 40 and fits.
 */
function tightNovemberState(): QuickState {
  let state = run(
    manualState(TODAY),
    { type: "addTask", taskCode: "CLEAN_BATH", name: "Clean Bath" },
    { type: "addTask", taskCode: "CLEAN_KITCHEN", name: "Clean Kitchen" },
    { type: "addTask", taskCode: "TRASH", name: "Trash" },
  );
  const [bath, kitchen, trash] = state.tasks.map((task) => task.id) as [string, string, string];
  state = run(
    state,
    { type: "setDaysPerWeek", taskId: bath, days: 1 },
    { type: "setMinutes", taskId: bath, minutes: 20 },
    { type: "setDaysPerWeek", taskId: kitchen, days: 1 },
    { type: "setMinutes", taskId: kitchen, minutes: 20 },
    { type: "setDaysPerWeek", taskId: trash, days: 1 },
    { type: "setMinutes", taskId: trash, minutes: 10 },
  );
  for (const [taskId, day] of [[bath, 1], [kitchen, 0]] as const) {
    const days = placed(state, taskId);
    state = run(
      state,
      { type: "togglePinDay", taskId, weekday: days[0]!, placedDays: days },
      { type: "togglePinDay", taskId, weekday: day, placedDays: [] },
    );
  }
  const trashDays = placed(state, trash);
  return run(
    state,
    { type: "togglePinDay", taskId: trash, weekday: trashDays[0]!, placedDays: trashDays },
    { type: "setCell", key: `${bath}:1`, minutes: 21 },
    { type: "setCell", key: `${kitchen}:0`, minutes: 21 },
    { type: "setFusionUnits", month: "2026-11", units: 17 },
  );
}

function taskGroup(name: string): HTMLElement {
  return screen.getByRole("group", { name });
}

function dayButton(task: string, day: string): HTMLElement {
  return within(taskGroup(`${task} days`)).getByRole("button", { name: day });
}

async function startByHand(user: UserEvent): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: "Build a schedule by hand" }));
  const picker = screen.getByRole("combobox", { name: "Add a task" });
  await waitFor(() => expect(picker).toHaveFocus());
  return picker;
}

async function addTask(user: UserEvent, query: string, name: string): Promise<HTMLElement> {
  await user.click(screen.getByRole("combobox", { name: "Add a task" }));
  await user.keyboard(query);
  await user.keyboard("{Enter}");
  return screen.findByRole("group", { name });
}

describe("Quick Schedule: care plan pane from Fusion", () => {
  it("shows Fusion's values locked, with units in the viewed month and transportation", async () => {
    const { user } = renderQuick();
    await user.click(screen.getByRole("button", { name: "7-day plan" }));

    const bathing = await screen.findByRole("group", { name: "Bathing" });
    expect(within(bathing).getByText("45 min a day · every day")).toBeInTheDocument();
    expect(within(bathing).getByText("93 units in Oct")).toBeInTheDocument();
    expect(within(taskGroup("Clean Bath")).getByText("20 min a day · 1 day a week")).toBeInTheDocument();
    expect(screen.getByText("Minutes and days come from Fusion and can't be changed here.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Minutes per day" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Add a task" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "345 minutes a month from Fusion (23 units), about 60 minutes a week. This time comes off the monthly units before tasks.",
      ),
    ).toBeInTheDocument();

    // Usual day: the last weekday care day (7 care days: Friday). Changing it is guarded.
    const usualDay = screen.getByRole("combobox", { name: "Usual day" });
    expect(usualDay).toHaveValue("5");
    await user.selectOptions(usualDay, "1");
    expect(usualDay).toHaveValue("1");
  });

  it("QS-07: a task's non-care days can't be chosen (5-day plan: Wednesday and Sunday)", () => {
    renderQuick();
    for (const day of ["Wednesday", "Sunday"]) expect(dayButton("Bathing", day)).toBeDisabled();
    for (const day of ["Monday", "Saturday"]) expect(dayButton("Bathing", day)).toBeEnabled();
    expect(within(screen.getByRole("group", { name: "Care days" })).getByRole("button", { name: "Sunday" })).toBeEnabled();
  });

  it("AC-10: a second day for a 1-day task shows the limit and changes nothing", async () => {
    const { user } = renderQuick();
    await user.click(screen.getByRole("button", { name: "7-day plan" }));
    const days = await screen.findByRole("group", { name: "Clean Bath days" });
    const chosen = within(days).getAllByRole("button", { pressed: true });
    expect(chosen).toHaveLength(1);
    expect(
      within(taskGroup("Clean Bath")).getByText("We chose the lightest days. Select a day to choose yourself."),
    ).toBeInTheDocument();

    const other = within(days).getAllByRole("button", { pressed: false }).find((button) => !button.hasAttribute("disabled"))!;
    await user.click(other);
    expect(
      within(taskGroup("Clean Bath")).getByText("Clean Bath is authorized for 1 day a week. Unselect a day first."),
    ).toBeInTheDocument();
    expect(within(days).getAllByRole("button", { pressed: true })).toEqual(chosen);
  });

  it("QS-07: unselecting a 1-day task's day takes it off the week; the next day chosen is where it goes", async () => {
    const { user } = renderQuick();
    await user.click(screen.getByRole("button", { name: "7-day plan" }));
    const days = await screen.findByRole("group", { name: "Clean Bath days" });
    const [chosen] = within(days).getAllByRole("button", { pressed: true });
    // Our choice is the tinted "auto" style; a day the person chose is solid.
    expect(chosen).toHaveClass("bg-brand-tint");
    await user.click(chosen!);

    expect(within(days).queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect(within(taskGroup("Clean Bath")).getByText(/Your days/)).toBeInTheDocument();

    const target = chosen!.getAttribute("aria-label") === "Wednesday" ? "Thursday" : "Wednesday";
    await user.click(dayButton("Clean Bath", target));
    expect(dayButton("Clean Bath", target)).toHaveAttribute("aria-pressed", "true");
    expect(dayButton("Clean Bath", target)).toHaveClass("bg-brand");
    expect(dayButton("Clean Bath", target)).not.toHaveClass("bg-brand-tint");

    await user.click(within(taskGroup("Clean Bath")).getByRole("button", { name: "Let us choose" }));
    expect(
      within(taskGroup("Clean Bath")).getByText("We chose the lightest days. Select a day to choose yourself."),
    ).toBeInTheDocument();
  });

  it("a task-day change the guard refuses shows its sentence in that task's hint line", async () => {
    saveQuickState(tightNovemberState());
    const { user } = renderQuick();
    const trash = taskGroup("Trash");
    expect(within(taskGroup("Trash days")).queryAllByRole("button", { pressed: true })).toHaveLength(0);

    await user.click(dayButton("Trash", "Sunday"));
    expect(
      within(trash).getByText("That would put November 2026 over the 17 units Fusion authorizes."),
    ).toBeInTheDocument();
    expect(dayButton("Trash", "Sunday")).toHaveAttribute("aria-pressed", "false");

    // The next accepted change clears the sentence.
    await user.click(dayButton("Trash", "Wednesday"));
    expect(dayButton("Trash", "Wednesday")).toHaveAttribute("aria-pressed", "true");
    expect(within(trash).queryByText(/That would put/)).not.toBeInTheDocument();
  });
});

describe("Quick Schedule: care plan pane by hand", () => {
  it("picker: \"dress\" + Enter adds Dressing/Grooming and focuses its minutes with the value selected", async () => {
    const { user } = renderQuick();
    const picker = await startByHand(user);
    expect(screen.queryByRole("heading", { name: "Open the care plan PDF from Fusion" })).not.toBeInTheDocument();
    expect(within(statusPanel()).getByText("Add tasks to start")).toBeInTheDocument();

    await user.keyboard("dress");
    expect(picker).toHaveAttribute("aria-expanded", "true");
    const option = screen.getByRole("option", { name: "Dressing/Grooming" });
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(picker).toHaveAttribute("aria-activedescendant", option.id);
    await user.keyboard("{Enter}");

    const task = await screen.findByRole("group", { name: "Dressing/Grooming" });
    const minutes = within(task).getByRole("textbox", { name: "Minutes per day" }) as HTMLInputElement;
    await waitFor(() => expect(minutes).toHaveFocus());
    expect(minutes).toHaveValue("15");
    expect([minutes.selectionStart, minutes.selectionEnd]).toEqual([0, 2]);
    expect(within(statusPanel()).getByText("Ready to use")).toBeInTheDocument();
  });

  it("picker: arrow keys move the highlight, Escape closes, and no match says so", async () => {
    const { user } = renderQuick();
    const picker = await startByHand(user);
    await user.keyboard("clean");
    // Scoped to the picker's list: the page's native selects have options too.
    const options = within(screen.getByRole("listbox", { name: "Tasks" })).getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    await user.keyboard("{ArrowDown}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(picker).toHaveAttribute("aria-activedescendant", options[1]!.id);
    await user.keyboard("{Escape}");
    expect(picker).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.clear(picker);
    await user.keyboard("xyz");
    expect(within(screen.getByRole("listbox", { name: "Tasks" })).getByRole("option")).toHaveTextContent(
      'No CDS Personal Care Assistance (State Plan) task matches "xyz"',
    );
  });

  it("QS-02 and QS-09: transportation adds up, and switching to Homemaker removes tasks with a toast", async () => {
    const { user } = renderQuick();
    await startByHand(user);
    await addTask(user, "dress", "Dressing/Grooming");
    await addTask(user, "clean bath", "Clean Bath");

    await user.type(screen.getByRole("textbox", { name: "Minutes per trip" }), "60");
    await user.tab();
    expect(
      screen.getByText("300 minutes a month = 20 units. These come off the monthly units before tasks."),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Authorized service" }), "S5130");
    const toasts = await screen.findAllByText("Removed 1 task that isn't part of Homemaker (ADW)");
    expect(toasts.length).toBeGreaterThan(0);
    expect(screen.queryByRole("group", { name: "Dressing/Grooming" })).not.toBeInTheDocument();
    expect(taskGroup("Clean Bath")).toBeInTheDocument();
    // Homemaker has no essential transportation.
    expect(screen.queryByRole("textbox", { name: "Minutes per trip" })).not.toBeInTheDocument();
  });

  it("QS-05: empty minutes leave the task out with an error; odd minutes get a hint", async () => {
    const { user } = renderQuick();
    await startByHand(user);
    const task = await addTask(user, "bathing", "Bathing");
    const minutes = within(task).getByRole("textbox", { name: "Minutes per day" });

    await user.clear(minutes);
    await user.tab();
    expect(within(task).getByText("Enter whole minutes, like 15 or 30.")).toBeInTheDocument();
    expect(minutes).toHaveAttribute("aria-invalid", "true");
    expect(within(statusPanel()).getByText("Add tasks to start")).toBeInTheDocument();

    await user.type(minutes, "17");
    await user.keyboard("{Enter}");
    expect(within(task).queryByText("Enter whole minutes, like 15 or 30.")).not.toBeInTheDocument();
    expect(within(task).getByText("Most care plans use 5-minute steps.")).toBeInTheDocument();
    expect(within(statusPanel()).getByText("Ready to use")).toBeInTheDocument();
  });

  it("QS-03 and QS-08: the plan ends 11 months after it starts; no care days says so", async () => {
    const { user } = renderQuick();
    await startByHand(user);
    expect(screen.getByLabelText("Plan starts")).toHaveValue("2026-11");
    expect(screen.getByText("October 2027")).toBeInTheDocument();

    const careDays = screen.getByRole("group", { name: "Care days" });
    for (const button of within(careDays).getAllByRole("button")) await user.click(button);
    expect(screen.getByText("Choose at least one care day.")).toBeInTheDocument();
  });

  it("a refused minutes change goes to a toast and the field shows the minutes the schedule holds", async () => {
    saveQuickState(tightNovemberState());
    const { user } = renderQuick();
    const minutes = within(taskGroup("Clean Bath")).getByRole("textbox", { name: "Minutes per day" });
    await user.clear(minutes);
    await user.type(minutes, "40");
    await user.keyboard("{Enter}");
    const toasts = await screen.findAllByText("That would put November 2026 over the 17 units Fusion authorizes.");
    expect(toasts.length).toBeGreaterThan(0);
    expect(minutes).toHaveValue("20");
  });

  it("removing a task returns focus to the picker", async () => {
    const { user } = renderQuick();
    await startByHand(user);
    await addTask(user, "trash", "Trash");
    await user.click(screen.getByRole("button", { name: "Remove Trash" }));
    expect(screen.queryByRole("group", { name: "Trash" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Add a task" })).toHaveFocus());
  });
});
