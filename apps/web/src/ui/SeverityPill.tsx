import { CircleHelp, Info, OctagonX, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";

export type Severity = "BLOCK" | "REVIEW" | "WARN" | "INFO";

const SEVERITY_CONFIG: Record<
  Severity,
  { icon: LucideIcon; label: string; className: string }
> = {
  BLOCK: { icon: OctagonX, label: "Must fix", className: "bg-block-bg text-block" },
  REVIEW: { icon: CircleHelp, label: "Needs review", className: "bg-review-bg text-review" },
  WARN: { icon: TriangleAlert, label: "Check", className: "bg-warn-bg text-warn" },
  INFO: { icon: Info, label: "Good to know", className: "bg-info-bg text-info" },
};

export interface SeverityPillProps {
  severity: Severity;
}

export function SeverityPill({ severity }: SeverityPillProps) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium",
        config.className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {config.label}
    </span>
  );
}
