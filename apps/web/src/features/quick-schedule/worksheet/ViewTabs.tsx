import { useRef, type KeyboardEvent } from "react";
import { cn } from "../../../lib/cn";

export type QuickView = "schedule" | "worksheet";

const TABS: { view: QuickView; label: string }[] = [
  { view: "schedule", label: "Schedule" },
  { view: "worksheet", label: "Worksheet" },
];

export const viewTabId = (view: QuickView): string => `qs-tab-${view}`;
export const viewPanelId = (view: QuickView): string => `qs-panel-${view}`;

/**
 * The schedule pane's two views (Phase 3, Prompt 5): a `tablist` with one tab stop; the arrow keys,
 * Home and End move between the tabs and select them.
 */
export function ViewTabs({ view, onChange }: { view: QuickView; onChange: (view: QuickView) => void }) {
  const refs = useRef<Record<QuickView, HTMLButtonElement | null>>({ schedule: null, worksheet: null });
  const select = (next: QuickView) => {
    onChange(next);
    refs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((tab) => tab.view === view);
    const last = TABS.length - 1;
    const target = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(TABS[target]!.view);
  };
  return (
    <div role="tablist" aria-label="Quick Schedule views" className="flex gap-1 border-b border-line print:hidden">
      {TABS.map((tab) => {
        const selected = tab.view === view;
        return (
          <button
            key={tab.view}
            ref={(element) => {
              refs.current[tab.view] = element;
            }}
            type="button"
            role="tab"
            id={viewTabId(tab.view)}
            aria-selected={selected}
            aria-controls={viewPanelId(tab.view)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.view)}
            onKeyDown={onKeyDown}
            className={cn(
              "-mb-px min-h-10 rounded-t-sm border-b-2 px-4 font-semibold max-sm:min-h-11",
              selected ? "border-brand text-ink" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
