import { factorFor, type DaysPerWeek } from "./factors.js";

export interface TransportAllowance {
  minutesPerMonth: number;
  units: number;
  unallocatedMinutes: number;
}

/** F-4: transport allowance. */
export function transportAllowance(minPerTrip: number, tripsPerWeek: DaysPerWeek): TransportAllowance {
  const minutesPerMonth = minPerTrip * factorFor(tripsPerWeek);
  const units = Math.floor(minutesPerMonth / 15);
  const unallocatedMinutes = minutesPerMonth - units * 15;
  return { minutesPerMonth, units, unallocatedMinutes };
}
