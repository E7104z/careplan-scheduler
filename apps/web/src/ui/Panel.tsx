import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface PanelProps {
  title: string;
  meta?: string;
  tools?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Panel({ title, meta, tools, children, className }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-md border border-line bg-surface shadow-panel",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        <div className="flex items-center gap-3">
          {meta ? <span className="text-sm text-ink-3">{meta}</span> : null}
          {tools}
        </div>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
