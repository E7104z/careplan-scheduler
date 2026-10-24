import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

/** A text, email or password input styled with the tokens. Use inside Field for its label. */
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-10 w-full rounded-sm border border-line-2 bg-surface px-3 text-ink placeholder:text-ink-3 focus:border-brand read-only:bg-sunk",
        className,
      )}
      {...rest}
    />
  );
});
