import { type SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-sm border border-line-2 bg-surface px-3 text-ink focus:border-brand",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}
