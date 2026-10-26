import {
  cloneElement,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from "react";
import { cn } from "../lib/cn";

export interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "false" | "true" | "grammar" | "spelling";
  required?: boolean;
}

type ControlProps =
  | InputHTMLAttributes<HTMLInputElement>
  | TextareaHTMLAttributes<HTMLTextAreaElement>
  | SelectHTMLAttributes<HTMLSelectElement>;

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactElement<ControlProps>;
}

export function Field({
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: FieldProps) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  const hintText = [hint, required ? "Required" : null]
    .filter((part): part is string => part !== null)
    .join(", ");

  const describedBy =
    [hintText ? hintId : null, error ? errorId : null]
      .filter((part): part is string => part !== null)
      .join(" ") || undefined;

  const control = cloneElement(children as ReactElement<FieldControlProps>, {
    id: inputId,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    ...(required ? { required: true } : {}),
  });

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {control}
      {hintText ? (
        <p id={hintId} className="text-[13px] text-ink-3">
          {hintText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-[13px] text-block">
          {error}
        </p>
      ) : null}
    </div>
  );
}
