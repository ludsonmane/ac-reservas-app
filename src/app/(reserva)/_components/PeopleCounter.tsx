'use client';

import * as React from 'react';
import { IconMinus, IconPlus, IconPencil } from '@tabler/icons-react';
import s from '../reserva.module.css';

/**
 * Contador de pessoas em duas colunas: à esquerda rótulo, ajuda e atalhos; à direita a pílula
 * (menos, número digitável, mais) centralizada na altura do bloco. O campo é a fonte da verdade.
 */
export function PeopleCounter({
  id, label, helper, value, min = 0, max = 200, quick, onChange,
}: {
  id: string;
  label: string;
  helper?: string;
  value: number;
  min?: number;
  max?: number;
  quick: number[];
  onChange: (n: number) => void;
}) {
  const [text, setText] = React.useState(value ? String(value) : '');
  React.useEffect(() => { setText(value ? String(value) : ''); }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = (raw: string) => {
    const n = parseInt(raw.replace(/\D+/g, ''), 10);
    if (Number.isNaN(n)) { onChange(min); setText(min ? String(min) : ''); return; }
    const c = clamp(n);
    onChange(c);
    setText(String(c));
  };

  return (
    <div className={s.counter}>
      <label htmlFor={id} className={s.counterLabel}>
        <b>{label}</b>
        {helper && <small>{helper}</small>}
      </label>

      <div className={s.controls}>
        <div className={s.quick} role="group" aria-label={`Atalhos de ${label.toLowerCase()}`}>
          {quick.map((n) => (
            <button key={n} type="button" className={s.quickChip} aria-pressed={value === n}
              onClick={() => onChange(clamp(n))}>
              {n === 0 ? 'Nenhuma' : n}
            </button>
          ))}
        </div>

        <div className={s.stepperWrap}>
          <div className={s.stepper}>
            <button type="button" className={s.stepBtn} aria-label={`Menos um em ${label.toLowerCase()}`}
              disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>
              <IconMinus size={20} stroke={2.4} />
            </button>
            <input
              id={id}
              className={s.stepInput}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              aria-label={label}
              placeholder="0"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/D+/g, '').slice(0, 3))}
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              onFocus={(e) => e.target.select()}
            />
            <button type="button" className={s.stepBtn} aria-label={`Mais um em ${label.toLowerCase()}`}
              disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>
              <IconPlus size={20} stroke={2.4} />
            </button>
          </div>
          <button type="button" className={s.stepHint} onClick={() => document.getElementById(id)?.focus()}>
            <IconPencil size={13} stroke={2.2} /> toque para digitar
          </button>
        </div>
      </div>
    </div>
  );
}
