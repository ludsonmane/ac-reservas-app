'use client';

import s from '../reserva.module.css';
import { UNIT_META, HIDDEN_SLUGS, detectSlug, type UnitMeta } from '../_lib/units';

export type UnitOption = { id: string; name: string; slug?: string | null; minPeople?: number | null };

/**
 * Cartões grandes, sempre visíveis (menos as casas em HIDDEN_SLUGS). As casas vêm da API; as que a API ainda não tem
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
  const visible = UNIT_META.filter((m) => !HIDDEN_SLUGS.includes(m.slug));
  const byMeta = visible.map((meta) => {
    const u = units.find((x) => detectSlug(x.slug, x.name) === meta.slug) || null;
    return { meta, u };
  });

  if (loading && units.length === 0) {
    return (
      <div className={s.units} aria-busy="true">
        {visible.map((_, i) => <div key={i} className={s.skeleton} style={{ height: 64 }} />)}
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
