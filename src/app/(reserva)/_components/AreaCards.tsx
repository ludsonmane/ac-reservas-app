'use client';

import s from '../reserva.module.css';
import { isBeforeManecoMin, isManecoArea } from '../_lib/rules';

export type AreaCard = {
  id: string;
  name: string;
  description?: string | null;
  photoUrl?: string | null;
  available: number; // vagas no período
  blocked?: boolean;
};

/** Frase curta de benefício a partir da descrição longa da API. */
export function benefitLine(a: AreaCard) {
  const d = (a.description || '').trim();
  if (!d) return '';
  const first = d.split(/(?<=[.!?])\s/)[0];
  return first.length > 70 ? `${first.slice(0, 67).trim()}…` : first;
}

export function AreaCards({
  areas, value, suggestedId, time, people, onChange,
}: {
  areas: AreaCard[];
  value: string | null;
  suggestedId: string | null;
  time: string;
  people: number;
  onChange: (a: AreaCard) => void;
}) {
  return (
    <div className={s.areas} role="radiogroup" aria-label="Onde vocês querem ficar">
      {areas.map((a) => {
        const maneco = isManecoArea(a.name) && isBeforeManecoMin(time);
        const full = a.available < people;
        const disabled = maneco || full || !!a.blocked;
        const on = value === a.id;
        const badge = on ? 'Escolhida' : maneco ? 'Só a partir das 18h' : full ? 'Lotou' : a.id === suggestedId ? 'Sugestão' : null;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            className={s.area}
            onClick={() => onChange(a)}
          >
            {a.photoUrl ? (
              <img className={s.areaImg} src={a.photoUrl} alt="" loading="lazy" />
            ) : (
              <div className={s.areaImg} />
            )}
            {badge && (
              <span className={`${s.badge} ${on ? s.badgeOn : disabled ? s.badgeOff : ''}`}>{badge}</span>
            )}
            <span className={s.areaBody}>
              <b>{a.name.replace(/^Ala\s+/i, '')}</b>
              <small>{benefitLine(a) || (full ? 'Sem lugar para o grupo nesse horário' : 'Área do Mané')}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
