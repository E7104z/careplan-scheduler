import type { ServiceCode } from "@careplan/engine";

/**
 * IMP-11: Fusion service labels we have seen in a real plan. Add a label only after seeing it
 * in a real plan (IMPORT-SPEC section 6); any other label is left for the person to choose.
 */
const SERVICE_LABELS: ReadonlyMap<string, ServiceCode> = new Map<string, ServiceCode>([
  ["PC - CDS", "T1019U2"],
  ["PC - Agency", "T1019"], // Fusion's care plan report, Oct 2026
  ["HC", "S5130"], // Homemaker, Fusion's care plan report, Oct 2026
]);

/** The engine service for a Fusion label, or null for a label we haven't seen yet. */
export function serviceCodeForLabel(label: string): ServiceCode | null {
  return SERVICE_LABELS.get(label) ?? null;
}

/** A paste with no group row is read as State Plan CDS (IMP-T03). */
export const ROWS_ONLY_SERVICE_CODE: ServiceCode = "T1019U2";
