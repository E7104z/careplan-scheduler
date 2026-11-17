import { useEffect, useState } from "react";
import { useAgency } from "./agencyContext";
import { phiStorageEnabled } from "./savedPlans";
import { storageGate, type StorageGate } from "./storageGate";

/**
 * The saved-plans gate for the current agency. The deployment flag is read once per page; a flag
 * that can't be read counts as off, so nothing is offered that the rules would refuse.
 */
export function useStorageGate(): StorageGate {
  const { state } = useAgency();
  const [phiStorage, setPhiStorage] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    phiStorageEnabled()
      .then((enabled) => live && setPhiStorage(enabled))
      .catch(() => live && setPhiStorage(false));
    return () => {
      live = false;
    };
  }, []);
  return storageGate(state.tenant, phiStorage);
}
