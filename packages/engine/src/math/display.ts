export interface DayUnits {
  units: number;
  remainder: number;
}

/** F-5: display-only day units. */
export function dayUnits(minutes: number): DayUnits {
  return { units: Math.floor(minutes / 15), remainder: minutes % 15 };
}
