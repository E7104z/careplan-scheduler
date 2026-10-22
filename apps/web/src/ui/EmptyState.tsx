import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line-2 bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm text-ink-2">{title}</p>
      {action}
    </div>
  );
}
