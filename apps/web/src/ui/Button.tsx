import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-on hover:bg-brand-hover",
  secondary: "border border-line-2 bg-surface text-ink hover:bg-sunk",
  quiet: "bg-transparent text-brand hover:bg-brand-tint",
  danger: "bg-block text-block-on hover:opacity-90",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "h-10 px-4",
  sm: "h-8 px-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      busy = false,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-sm font-semibold leading-none transition-colors max-sm:min-h-11 max-sm:min-w-11 disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...rest}
      >
        <span className={cn("inline-flex items-center gap-2", busy && "opacity-0")}>
          {children}
        </span>
        {busy ? (
          <Spinner className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2" />
        ) : null}
      </button>
    );
  },
);
