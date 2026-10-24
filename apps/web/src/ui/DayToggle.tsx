import { cn } from "../lib/cn";

const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface DayToggleProps {
  value: boolean[];
  auto?: boolean[];
  onChange?: (index: number) => void;
  disabled?: boolean;
  /** The group's accessible name: "Care days", or a task's days ("Bathing days"). */
  label?: string;
  className?: string;
}

export function DayToggle({
  value,
  auto,
  onChange,
  disabled = false,
  label = "Care days",
  className,
}: DayToggleProps) {
  return (
    <div className={cn("flex gap-1", className)} role="group" aria-label={label}>
      {DAY_ABBR.map((abbr, index) => {
        const selected = value[index] ?? false;
        const isAuto = auto?.[index] ?? false;
        const name = DAY_NAMES[index] ?? `Day ${index + 1}`;

        return (
          <button
            key={abbr}
            type="button"
            aria-label={name}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange?.(index)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-sm border text-sm font-semibold transition-colors max-sm:h-11 max-sm:w-11",
              selected && isAuto && "border-brand bg-brand-tint text-brand",
              selected && !isAuto && "border-brand bg-brand text-brand-on",
              !selected && "border-line-2 bg-surface text-ink-2 hover:bg-sunk",
            )}
          >
            {abbr}
          </button>
        );
      })}
    </div>
  );
}
