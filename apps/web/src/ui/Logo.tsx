import { cn } from "../lib/cn";

export interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="h-7 w-7 text-brand"
        fill="currentColor"
      >
        <rect x="2" y="2" width="13" height="13" rx="2" />
        <rect x="17" y="2" width="13" height="13" rx="2" />
        <rect x="2" y="17" width="13" height="13" rx="2" />
        <rect
          x="17"
          y="17"
          width="13"
          height="13"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      {showWordmark ? (
        <span className="text-[17px] font-bold text-ink">CarePlan Scheduler</span>
      ) : null}
    </span>
  );
}
