// Pure field rules for the agency form (APP-SPEC 6.3), kept here so tests exercise them.

export const AGENCY_NAME_MIN = 2;
export const AGENCY_NAME_MAX = 120;

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WORKWEEK_OPTIONS: { value: number; label: string }[] = WEEKDAYS.map((label, value) => ({
  value,
  label,
}));

export const WORKWEEK_HINT = "Used for overtime checks";

/** The sentence for an invalid agency name, or null when it's fine. */
export function validateAgencyName(value: string): string | null {
  if (!value.trim()) return "Enter an agency name.";
  if (value.trim().length < AGENCY_NAME_MIN || value.trim().length > AGENCY_NAME_MAX) {
    return "Use 2 to 120 characters.";
  }
  return null;
}
