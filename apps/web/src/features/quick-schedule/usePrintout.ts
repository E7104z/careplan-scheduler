import { useEffect, useRef, useState } from "react";
import type { RulePack } from "@careplan/engine";
import { hasSchedule } from "./model";
import { printSchedulePdf, saveSchedulePdf, SHELL_PRINT_EVENT } from "./printSchedule";
import type { CarePlan, QuickModel } from "./types";

export type PrintAction = "print" | "save";

export interface Printout {
  /** The printout being made, or null. */
  printing: PrintAction | null;
  /** False with no tasks yet: there's nothing to print. */
  canPrint: boolean;
  /** ACC-06: the agency's copy adds each service's projected accrual pages. */
  agency: boolean;
  setAgency: (agency: boolean) => void;
  /** Makes the printout; false when there's nothing to print. */
  makePrintout: (action: PrintAction) => boolean;
}

/**
 * APP-SPEC 5.4 Print for Quick Schedule: "Print schedule", "Save as PDF", and Ctrl+P and the Windows
 * app's File > Print, which make the printout rather than print the page.
 */
export function usePrintout(plan: CarePlan, models: QuickModel[], pack: RulePack, onFailed: () => void): Printout {
  const [printing, setPrinting] = useState<PrintAction | null>(null);
  const [agency, setAgency] = useState(false);
  // Set at once (state waits for a render): Ctrl+P can reach the page and the Windows app's menu
  // in the same moment, and that is one printout.
  const making = useRef(false);
  const canPrint = models.some(hasSchedule);

  const makePrintout = (action: PrintAction): boolean => {
    if (!canPrint) return false;
    if (making.current) return true;
    making.current = true;
    setPrinting(action);
    const source = { plan, models, pack };
    const options = { agency };
    (action === "print" ? printSchedulePdf(source, options) : saveSchedulePdf(source, options))
      .catch(onFailed)
      .finally(() => {
        making.current = false;
        setPrinting(null);
      });
    return true;
  };

  // The key and the menu read the latest plan and the agency box through this ref.
  const latest = useRef(makePrintout);
  useEffect(() => {
    latest.current = makePrintout;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "p") return;
      if (latest.current("print")) event.preventDefault();
    };
    const onShellPrint = (event: Event) => {
      if (latest.current("print")) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(SHELL_PRINT_EVENT, onShellPrint);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(SHELL_PRINT_EVENT, onShellPrint);
    };
  }, []);

  return { printing, canPrint, agency, setAgency, makePrintout };
}
