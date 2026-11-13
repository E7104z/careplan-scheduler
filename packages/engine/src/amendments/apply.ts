import { daysInMonth, formatYmd, parseYmd } from "../math/dates.js";
import type { AmendmentDirection, AuthorizationChain, ScheduleTemplate, ServiceAuthorization } from "../types.js";
import { addVersion } from "./versions.js";

/**
 * Where a care plan amendment takes effect (Manual 4.20). An increase takes effect on its date,
 * which may be mid-month. A participant-requested reduction takes effect on its date. A decrease
 * takes effect on the first day of a month: dated the 1st, that day; dated later in a month, the
 * first of the next month.
 */
export function amendmentEffectiveDate(direction: AmendmentDirection, date: string): string {
  if (direction !== "decrease") return date;
  const { year, month, day } = parseYmd(date);
  if (day === 1) return date;
  return month === 12 ? formatYmd(year + 1, 1, 1) : formatYmd(year, month + 1, 1);
}

/** A care plan amendment as the person recorded it: what kind, the date, and the plan from then on. */
export interface AmendmentRequest {
  amendmentId: string;
  direction: AmendmentDirection;
  /** The date as entered (YYYY-MM-DD). The Manual 4.20 behavior may move a decrease to a month's first day. */
  date: string;
  /** The date the amendment was made, when known. */
  recordedOn?: string;
  /** True only when the person says the care plan shows the effective date. Never set by the engine. */
  dateConfirmed?: boolean;
  /** The authorization and weekly pattern from the effective date on. */
  authorization: ServiceAuthorization;
  template: ScheduleTemplate;
}

/**
 * Add an amendment to a chain with its Manual 4.20 behavior applied: the effective date is
 * resolved, the date as entered is kept when it moved, and the version is added with `addVersion`
 * (so it can only take effect after every version before it, inside the authorization). Scheduled
 * occurrences are then recalculated from the effective date forward only; nothing before it
 * changes. Returns a new chain.
 */
export function applyAmendment(chain: AuthorizationChain, request: AmendmentRequest): AuthorizationChain {
  const { year, month, day } = parseYmd(request.date);
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month))) {
    throw new Error(`${request.date} is not a date`);
  }
  const effectiveFrom = amendmentEffectiveDate(request.direction, request.date);
  return addVersion(chain, {
    amendmentId: request.amendmentId,
    direction: request.direction,
    effectiveFrom,
    ...(effectiveFrom !== request.date ? { requestedDate: request.date } : {}),
    ...(request.recordedOn !== undefined ? { recordedOn: request.recordedOn } : {}),
    ...(request.dateConfirmed === true ? { dateConfirmed: true } : {}),
    authorization: request.authorization,
    template: request.template,
  });
}
