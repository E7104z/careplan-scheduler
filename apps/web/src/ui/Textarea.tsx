import { type TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      spellCheck={false}
      autoComplete="off"
      className={cn(
        "min-h-[150px] w-full resize-y rounded-sm border border-line-2 bg-surface px-3 py-2 text-ink placeholder:text-ink-3 focus:border-brand",
        className,
      )}
      {...rest}
    />
  );
}
