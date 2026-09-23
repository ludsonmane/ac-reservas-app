'use client';

import s from '../reserva.module.css';

export type ChipOption<T> = { value: T; label: string; disabled?: boolean };

/** Grupo de chips de escolha única, acessível como radiogroup. */
export function ChipGroup<T extends string | number>({
  label, options, value, onChange, soft = false, ariaLabel,
}: {
  label?: string;
  options: ChipOption<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
  soft?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className={s.chips} role="radiogroup" aria-label={ariaLabel || label}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            className={`${s.chip} ${soft ? s.chipSoft : ''}`}
            onClick={() => onChange(on && soft ? null : o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
