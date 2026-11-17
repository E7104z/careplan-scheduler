import { useMemo } from "react";
import {
  ACCRUAL_FOOTNOTE,
  ACCRUAL_NOTE,
  ACCRUAL_SECTION_TITLE,
  accrualRemainingText,
  accrualSentence,
  accrualUnitText,
  serviceAccrual,
} from "./accrual";
import type { QuickModel, QuickState } from "./types";

/** APP-SPEC accrual: one service's read-only projection for the month being viewed. */
export function AccrualPanel({ state, model }: { state: QuickState; model: QuickModel }) {
  const month = state.viewMonth;
  const projection = useMemo(() => serviceAccrual(model, month), [model, month]);
  const remaining = accrualRemainingText(projection);
  const headingId = `accrual-${model.svc.code}-${month}`;

  return (
    <section aria-labelledby={headingId} className="mt-5 grid gap-1.5 rounded-md border border-line bg-surface px-4 py-4 sm:px-5">
      <h2 id={headingId} className="text-lg font-bold text-ink">
        {ACCRUAL_SECTION_TITLE}
      </h2>
      <p className="text-sm text-ink-2">{ACCRUAL_NOTE}</p>
      <p className="mt-1.5 text-ink">{accrualSentence(month, projection)}</p>
      {projection.potentialAmvUnits > 0 ? (
        <ul className="mt-1 space-y-0.5 text-sm text-ink-2">
          {projection.units.map((unit) => (
            <li key={unit.number}>{accrualUnitText(unit)}</li>
          ))}
        </ul>
      ) : null}
      {remaining ? <p className="mt-1.5 text-sm text-ink-2">{remaining}</p> : null}
      <p className="mt-1.5 text-[13px] text-ink-3">{ACCRUAL_FOOTNOTE}</p>
    </section>
  );
}
