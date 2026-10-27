import { useEffect, useState, type ReactNode } from "react";
import { Field } from "../../../ui/Field";
import { NumberField } from "../../../ui/NumberField";
import { Select } from "../../../ui/Select";

export function Checkbox({ label, checked, onChange, disabled, hint }: {
  label: string; checked: boolean; onChange?: (checked: boolean) => void; disabled?: boolean; hint?: ReactNode;
}) {
  return (
    <label className="flex min-h-10 items-start gap-2.5 text-sm text-ink max-sm:min-h-11">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 flex-none accent-brand"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span>
        {label}
        {hint ? <span className="block text-[13px] text-ink-2">{hint}</span> : null}
      </span>
    </label>
  );
}

/**
 * A whole number for a worksheet-only entry (nurse visits, meals, a line's minutes, ILW units).
 * Empty is "not entered" (null); anything that isn't a whole number keeps its text and shows `error`
 * until it is fixed. `max` is only the field's own sanity limit; the engine checks the rules.
 */
export function CountField({ label, value, onChange, error, hint, max }: {
  label: string; value: number | null; onChange: (value: number | null) => void; error: string; hint?: string; max?: number;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setDraft(value === null ? "" : String(value));
    setBad(false);
  }, [value]);
  return (
    <Field label={label} hint={hint} error={bad ? error : undefined}>
      <NumberField
        value={draft}
        onChange={(event) => {
          const text = event.target.value.trim();
          setDraft(event.target.value);
          if (text === "") {
            setBad(false);
            onChange(null);
            return;
          }
          const number = /^\d+$/.test(text) ? Number(text) : Number.NaN;
          const ok = Number.isSafeInteger(number) && (max === undefined || number <= max);
          setBad(!ok);
          if (ok) onChange(number);
        }}
      />
    </Field>
  );
}

/** Days a week, 1–7, or none. */
export function DaysField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <Field label={label}>
      <Select value={value === null ? "" : String(value)} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}>
        <option value="">Not entered</option>
        {[1, 2, 3, 4, 5, 6, 7].map((days) => (
          <option key={days} value={days}>{days}</option>
        ))}
      </Select>
    </Field>
  );
}
