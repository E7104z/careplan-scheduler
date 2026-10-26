import { LoaderCircle } from "lucide-react";
import { cn } from "../lib/cn";

export interface SpinnerProps {
  className?: string;
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn("animate-spin", className)}
    />
  );
}
