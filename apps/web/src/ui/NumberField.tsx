import { type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface NumberFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  min?: number;
  max?: number;
  step?: number;
}

export function NumberField({ className, ...rest }: NumberFieldProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      className={cn(
        "h-10 w-full rounded-sm border border-line-2 bg-surface px-3 text-ink placeholder:text-ink-3 focus:border-pine",
        className,
      )}
      {...rest}
    />
  );
}
