import { createContext, useContext } from "react";
import type { AgencyContextValue } from "./types";

export const AgencyContext = createContext<AgencyContextValue | null>(null);

export function useAgency(): AgencyContextValue {
  const value = useContext(AgencyContext);
  if (!value) throw new Error("useAgency needs an AgencyProvider above it");
  return value;
}
