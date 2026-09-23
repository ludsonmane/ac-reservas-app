'use client';

import s from '../reserva.module.css';
import { UNIT_META, detectSlug, type UnitMeta } from '../_lib/units';

export type UnitOption = { id: string; name: string; slug?: string | null; minPeople?: number | null };

/**
 * Quatro cartões grandes, sempre visíveis. As casas vêm da API; as que a API ainda não tem
 * (Partage antes da abertura) aparecem desabilitadas com a data.
 */
export function UnitPicker({
  units, loading, value, onChange,
}: {
  units: UnitOption[];
  loading: boolean;
  value: string | null;
  onChange: (u: UnitOption, meta: UnitMeta | null) => void;
}) {
  const byMeta = UNIT_META.map((meta) => {
    const u = units.find((x) => detectSlug(x.slug, x.name) === meta.slug) || null;
    return { meta, u };
  });

  if (loading && units.length === 0) {
    return (
      <div className={s.units} aria-busy="true">
        {[0, 1, 2, 3].map((i) => <div key={i} className={s.skeleton} style={{ height: 64 }} />)}
      </div>
    );
  }

  return (
    <div className={s.units} role="radiogroup" aria-label="Em qual Mané?">
      {byMeta.map(({ meta, u }) => {
        const disabled = !u;
        const on = !!u && u.id === value;
        return (
          <button
            key={meta.slug}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            className={s.unit}
            onClick={() => u && onChange(u, meta)}
          >
            <b>{meta.short}</b>
            <small>{on ? 'selecionada' : meta.sub}</small>
          </button>
        );
      })}
    </div>
  );
}
