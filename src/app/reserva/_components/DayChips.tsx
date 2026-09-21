'use client';

import * as React from 'react';
import dayjs from 'dayjs';
import s from '../reserva.module.css';
import { earliestBookable, fmtDayLabel, isClosedDay } from '../_lib/rules';

/** Próximos 6 dias em chips (Hoje, Amanhã, Qui 24...) mais "Outra data" que abre o calendário nativo. */
export function DayChips({
  value, onChange, sp,
}: {
  value: string | null;
  onChange: (ymd: string | null) => void;
  sp: boolean;
}) {
  const today = dayjs().format('YYYY-MM-DD');
  const earliest = earliestBookable();
  const days = Array.from({ length: 6 }, (_, i) => dayjs(today).add(i, 'day').format('YYYY-MM-DD'));
  const inChips = value ? days.includes(value) : true;
  const [other, setOther] = React.useState(!inChips);

  return (
    <div className={s.block}>
      <div className={s.chips} role="radiogroup" aria-label="Que dia">
        {days.map((d) => {
          const closed = isClosedDay(d, sp);
          const tooEarly = d < earliest.dateYMD;
          const on = value === d;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={closed || tooEarly}
              className={s.chip}
              title={closed ? 'Fechado nesse dia' : tooEarly ? earliest.reason : undefined}
              onClick={() => { setOther(false); onChange(d); }}
            >
              {fmtDayLabel(d, today)}
              {d !== today && d !== days[1] ? ` ${dayjs(d).format('D')}` : ''}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={other}
          className={s.chip}
          onClick={() => { setOther(true); if (inChips) onChange(null); }}
        >
          Outra data
        </button>
      </div>
      {other && (
        <input
          id="reserva-outra-data"
          className={s.dateInput}
          type="date"
          aria-label="Escolher outra data"
          min={earliest.dateYMD}
          max={dayjs(today).add(120, 'day').format('YYYY-MM-DD')}
          value={value && !inChips ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )}
    </div>
  );
}
