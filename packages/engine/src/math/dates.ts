// Pure civil-calendar date arithmetic (no timezone, no luxon).

export interface Ymd {
  year: number;
  month: number;
  day: number;
}

// Days since 1970-01-01 (civil calendar; 1970-01-01 -> 0).
export function daysFromCivil(year: number, month: number, day: number): number {
  let y = year;
  y -= month <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function ymdFromDays(z: number): Ymd {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { year: m <= 2 ? y + 1 : y, month: m, day: d };
}

// 0 = Sunday .. 6 = Saturday.
export function weekdayOf(year: number, month: number, day: number): number {
  return (((daysFromCivil(year, month, day) + 4) % 7) + 7) % 7;
}

export function daysInMonth(year: number, month: number): number {
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return daysFromCivil(next.y, next.m, 1) - daysFromCivil(year, month, 1);
}

export function parseYmd(date: string): Ymd {
  const [year, month, day] = date.split("-").map((n) => Number(n));
  return { year: year!, month: month!, day: day! };
}

export function formatYmd(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function addDays(date: string, n: number): string {
  const { year, month, day } = parseYmd(date);
  const z = daysFromCivil(year, month, day) + n;
  const next = ymdFromDays(z);
  return formatYmd(next.year, next.month, next.day);
}
