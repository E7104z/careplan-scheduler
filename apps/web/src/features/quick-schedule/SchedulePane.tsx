import { useCallback, useState, type Dispatch } from "react";
import { Link } from "react-router";
import type { RulePack } from "@careplan/engine";
import { niceDate } from "../../lib/format";
import { ChecksPanel } from "./ChecksPanel";
import { DailyTaskList } from "./DailyTaskList";
import { MonthPanel } from "./MonthPanel";
import { ReviewSection } from "./ReviewSection";
import { StatusPanel } from "./StatusPanel";
import { WeeklyPanel } from "./WeeklyPanel";
import type { QuickAction } from "./state";
import type { QuickModel, QuickState } from "./types";
import type { QuickFeedback } from "./useQuickStore";

const FOOTNOTE =
  'Unit math follows DHSS rules for 15-minute units: weekly frequency factors, short-month proration for daily tasks, and whole units only. A change that would break a rule isn\'t accepted; you\'ll see the limit instead. Checks marked "Needs review" use a rule DHSS hasn\'t confirmed yet, so they never count as passing.';

function todayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

interface SchedulePaneProps {
  state: QuickState;
  model: QuickModel;
  pack: RulePack;
  feedback: QuickFeedback | null;
  dispatch: Dispatch<QuickAction>;
}

/**
 * APP-SPEC 5.4 schedule pane: status, week, daily task list, month, checks, the review with the
 * participant and the footnote, plus the print header and footer (shown only in print).
 */
export function SchedulePane({ state, model, pack, feedback, dispatch }: SchedulePaneProps) {
  const [highlight, setHighlight] = useState<string | null>(null);
  const clearHighlight = useCallback(() => setHighlight(null), []);

  return (
    // "Skip to the schedule" lands here; the margin keeps the status clear of the sticky header.
    <div id="qs-schedule" className="grid min-w-0 scroll-mt-24 gap-5">
      {/* APP-SPEC 5.4 print header: name and DCN (if read), service, plan dates, PA. */}
      <div className="hidden print:block">
        {state.identity ? (
          <p className="text-lg font-bold text-ink">
            {state.identity.name} · DCN {state.identity.dcn}
          </p>
        ) : null}
        <p className="text-sm text-ink-2">{model.svc.name}</p>
        <p className="text-sm text-ink-2">
          {niceDate(state.plan.start)} to {niceDate(state.plan.end)}
          {state.pa ? ` · PA ${state.pa}` : ""}
        </p>
      </div>

      <StatusPanel state={state} model={model} />
      <WeeklyPanel
        state={state}
        model={model}
        pack={pack}
        dispatch={dispatch}
        seq={feedback?.seq ?? 0}
        highlight={highlight}
        onHighlightDone={clearHighlight}
      />
      <DailyTaskList state={state} model={model} />
      <MonthPanel state={state} model={model} dispatch={dispatch} />
      <ChecksPanel state={state} model={model} onShowInWeek={setHighlight} />
      {model.tasks.length > 0 ? <ReviewSection state={state} dispatch={dispatch} /> : null}

      <p className="text-[13px] text-ink-3 print:hidden">
        {FOOTNOTE}{" "}
        <Link to="/rules" className="font-semibold text-brand underline hover:text-brand-hover">
          See every rule and its source
        </Link>
      </p>

      <p className="hidden text-sm text-ink-2 print:block">
        Checked with CarePlan Scheduler under rule pack {pack.id} on {niceDate(todayIso())}
      </p>
    </div>
  );
}
