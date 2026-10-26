import type { ReactNode } from "react";

export interface PaneSectionProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

/** One section of the care plan pane: an h2 with an optional hint beside it, then its body. */
export function PaneSection({ title, hint, children }: PaneSectionProps) {
  return (
    <section className="grid gap-3 border-t border-line px-5 py-[18px] first:border-t-0 max-sm:px-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        {hint ? <span className="text-[13px] text-ink-3">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}
